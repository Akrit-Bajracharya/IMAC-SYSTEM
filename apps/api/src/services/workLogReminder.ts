import { db } from '../db.js';
import { logger } from '../logger.js';
import { config } from '../config.js';
import { NOTIFICATION_TYPES } from '../constants/notificationTypes.js';
import { getSetting } from './settings.js';
import { createNotification } from './notifications.js';
import {
  publishAfterCommit,
  type PendingStreamNotification,
} from './notificationStream.js';

export const REMINDER_TICK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
export const REMINDER_BATCH_SIZE = 100;
export const DEFAULT_REMINDER_ENABLED = 'false';
export const DEFAULT_REMINDER_TIME = '17:00';

const KATHMANDU_OFFSET_MS = 345 * 60 * 1000; // UTC+05:45 (Nepal has no DST)

/**
 * Weekday mapping by workingDaysPerWeek (0 = Sunday .. 6 = Saturday).
 * ASSUMPTION (Step 18b): EmployeeProfile currently stores only workingDaysPerWeek
 * (default 5) with no explicit weekday list. When workingDaysPerWeek is 5,
 * Monday to Friday [1, 2, 3, 4, 5] are treated as working days — the Nepal
 * Sunday-to-Friday workweek is NOT applied here and is tracked in open-policy-questions.md.
 */
export const WORKING_DAYS_BY_COUNT: Record<number, readonly number[]> = {
  1: [1],
  2: [1, 2],
  3: [1, 2, 3],
  4: [1, 2, 3, 4],
  5: [1, 2, 3, 4, 5], // Mon-Fri assumption (Nepal Sun-Fri week NOT applied)
  6: [1, 2, 3, 4, 5, 6],
  7: [0, 1, 2, 3, 4, 5, 6],
};

export interface KathmanduDateTime {
  dateStr: string;
  timeStr: string;
  dayOfWeek: number; // 0 = Sun .. 6 = Sat
}

/**
 * Pure helper returning the current Asia/Kathmandu calendar date (YYYY-MM-DD),
 * 24h clock time (HH:mm), and day of week (0..6) for a given UTC Date.
 */
export function getKathmanduDateTime(now: Date): KathmanduDateTime {
  const ktm = new Date(now.getTime() + KATHMANDU_OFFSET_MS);
  const year = ktm.getUTCFullYear();
  const month = String(ktm.getUTCMonth() + 1).padStart(2, '0');
  const day = String(ktm.getUTCDate()).padStart(2, '0');
  const hour = String(ktm.getUTCHours()).padStart(2, '0');
  const minute = String(ktm.getUTCMinutes()).padStart(2, '0');

  return {
    dateStr: `${year}-${month}-${day}`,
    timeStr: `${hour}:${minute}`,
    dayOfWeek: ktm.getUTCDay(),
  };
}

export function startOfKathmanduDayUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map((n) => parseInt(n, 10));
  return new Date(Date.UTC(y!, m! - 1, d!, 0, 0, 0, 0) - KATHMANDU_OFFSET_MS);
}

export function startOfNextKathmanduDayUtc(dateStr: string): Date {
  return new Date(startOfKathmanduDayUtc(dateStr).getTime() + 24 * 60 * 60 * 1000);
}

export interface ParsedReminderConfig {
  valid: boolean;
  enabled: boolean;
  timeStr: string;
  reason?: string;
}

/**
 * Validates raw SystemSetting strings for worklog.reminder.enabled and worklog.reminder.time.
 * Any invalid value disables the run (valid: false).
 */
export function parseReminderConfig(
  rawEnabled: string,
  rawTime: string
): ParsedReminderConfig {
  const trimmedEnabled = rawEnabled.trim().toLowerCase();
  if (trimmedEnabled !== 'true' && trimmedEnabled !== 'false') {
    return {
      valid: false,
      enabled: false,
      timeStr: DEFAULT_REMINDER_TIME,
      reason: `Invalid worklog.reminder.enabled value: "${rawEnabled}"`,
    };
  }

  const trimmedTime = rawTime.trim();
  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(trimmedTime)) {
    return {
      valid: false,
      enabled: false,
      timeStr: DEFAULT_REMINDER_TIME,
      reason: `Invalid worklog.reminder.time value: "${rawTime}"`,
    };
  }

  return {
    valid: true,
    enabled: trimmedEnabled === 'true',
    timeStr: trimmedTime,
  };
}

/**
 * Pure helper determining whether dayOfWeek (0..6) is a working day
 * given EmployeeProfile.workingDaysPerWeek.
 */
export function isWorkingDayForProfile(
  dayOfWeek: number,
  workingDaysPerWeek: number
): boolean {
  const days = WORKING_DAYS_BY_COUNT[workingDaysPerWeek];
  if (!days) return false;
  return days.includes(dayOfWeek);
}

/**
 * Pure schedule decision helper:
 * Returns true when config is valid & enabled, today has not already completed
 * in memory, and Kathmandu clock time >= configured HH:mm.
 */
export function shouldRunReminderTick(params: {
  config: ParsedReminderConfig;
  currentTimeStr: string;
  currentDateStr: string;
  lastCompletedDateStr: string | null;
}): boolean {
  if (!params.config.valid || !params.config.enabled) {
    return false;
  }
  if (params.lastCompletedDateStr === params.currentDateStr) {
    return false;
  }
  return params.currentTimeStr >= params.config.timeStr;
}

/**
 * TODO (Phase 4 Leave): Check whether the user has an approved leave record on dateStr.
 * Leave management is not implemented yet; always returns false for now.
 */
export async function isOnApprovedLeave(
  _userId: string,
  _dateStr: string
): Promise<boolean> {
  return false;
}

// ── In-Process Scheduler State ────────────────────────────────────────────────

let reminderInterval: ReturnType<typeof setInterval> | null = null;
let isTickInFlight = false;
let lastCompletedDateStr: string | null = null;

/**
 * Resets in-memory scheduler state (used in tests).
 */
export function resetWorkLogReminderState(): void {
  isTickInFlight = false;
  lastCompletedDateStr = null;
}

/**
 * Executes one reminder tick.
 * - Skips if another tick is currently in flight.
 * - Skips immediately if today's Kathmandu date already completed in memory (Amendment C).
 * - Never throws out of the interval (all errors including getSetting DB failures are caught & logged).
 * - Processes eligible recipients in batches of at most 100 inside separate $transactions,
 *   re-checking already-notified-today inside each batch with one userId IN (...) query (Amendment B),
 *   and calling publishAfterCommit after each committed batch.
 */
export async function runWorkLogReminderTick(now: Date = new Date()): Promise<void> {
  if (isTickInFlight) {
    return;
  }

  isTickInFlight = true;
  try {
    const ktm = getKathmanduDateTime(now);

    // Amendment C: skip further DB queries for the rest of today once a full run succeeded
    if (lastCompletedDateStr === ktm.dateStr) {
      return;
    }

    const [rawEnabled, rawTime] = await Promise.all([
      getSetting('worklog.reminder.enabled', DEFAULT_REMINDER_ENABLED),
      getSetting('worklog.reminder.time', DEFAULT_REMINDER_TIME),
    ]);

    const parsedConfig = parseReminderConfig(rawEnabled, rawTime);
    if (!parsedConfig.valid) {
      logger.warn({ reason: parsedConfig.reason }, 'Work log reminder disabled due to invalid setting');
      return;
    }

    if (
      !shouldRunReminderTick({
        config: parsedConfig,
        currentTimeStr: ktm.timeStr,
        currentDateStr: ktm.dateStr,
        lastCompletedDateStr,
      })
    ) {
      return;
    }

    // Load active non-viewer users with an EmployeeProfile
    const candidateUsers = await db.user.findMany({
      where: {
        isActive: true,
        systemRole: { not: 'viewer' },
        employeeProfile: { isNot: null },
      },
      select: {
        id: true,
        employeeProfile: {
          select: {
            id: true,
            workingDaysPerWeek: true,
          },
        },
      },
    });

    const workingUsers = candidateUsers.filter(
      (u) =>
        u.employeeProfile &&
        isWorkingDayForProfile(ktm.dayOfWeek, u.employeeProfile.workingDaysPerWeek)
    );

    if (workingUsers.length === 0) {
      lastCompletedDateStr = ktm.dateStr;
      return;
    }

    // Check which employees already have a submitted or approved WorkLogDay for today
    const dateOnlyUtc = new Date(`${ktm.dateStr}T00:00:00.000Z`);
    const profileIds = workingUsers.map((u) => u.employeeProfile!.id);

    const completedLogs = await db.workLogDay.findMany({
      where: {
        employeeProfileId: { in: profileIds },
        date: dateOnlyUtc,
        status: { in: ['submitted', 'approved'] },
      },
      select: {
        employeeProfileId: true,
      },
    });

    const completedProfileSet = new Set(completedLogs.map((l) => l.employeeProfileId));

    const eligibleUserIds: string[] = [];
    for (const u of workingUsers) {
      if (completedProfileSet.has(u.employeeProfile!.id)) {
        continue;
      }
      if (await isOnApprovedLeave(u.id, ktm.dateStr)) {
        continue;
      }
      eligibleUserIds.push(u.id);
    }

    if (eligibleUserIds.length === 0) {
      lastCompletedDateStr = ktm.dateStr;
      return;
    }

    const dayStartUtc = startOfKathmanduDayUtc(ktm.dateStr);
    const nextDayStartUtc = startOfNextKathmanduDayUtc(ktm.dateStr);

    let allBatchesSucceeded = true;

    for (let i = 0; i < eligibleUserIds.length; i += REMINDER_BATCH_SIZE) {
      const batchIds = eligibleUserIds.slice(i, i + REMINDER_BATCH_SIZE);
      const pendingStreamNotifications: PendingStreamNotification[] = [];

      try {
        await db.$transaction(async (tx) => {
          // Amendment B: One query per batch inside tx to check already-notified-today
          const existingToday = await tx.notification.findMany({
            where: {
              type: NOTIFICATION_TYPES.WORK_LOG_REMINDER,
              userId: { in: batchIds },
              createdAt: {
                gte: dayStartUtc,
                lt: nextDayStartUtc,
              },
            },
            select: {
              userId: true,
            },
          });

          const alreadyNotifiedSet = new Set(existingToday.map((n) => n.userId));

          for (const userId of batchIds) {
            if (alreadyNotifiedSet.has(userId)) {
              continue;
            }

            const created = await createNotification(tx, {
              userId,
              type: NOTIFICATION_TYPES.WORK_LOG_REMINDER,
              entityType: 'work_log',
              entityId: ktm.dateStr,
              projectId: null,
              payload: { date: ktm.dateStr },
            });

            if (created) {
              pendingStreamNotifications.push({
                userId,
                notificationId: created.id,
              });
            }
          }
        });

        await publishAfterCommit(pendingStreamNotifications);
      } catch (batchErr) {
        // Amendment D: Keep earlier batches, log error, and allow next tick to retry remaining users
        allBatchesSucceeded = false;
        logger.error(
          { err: batchErr, date: ktm.dateStr, batchStart: i },
          'Failed to process work log reminder batch'
        );
      }
    }

    // Amendment C: Only mark today as done in memory if every batch succeeded
    if (allBatchesSucceeded) {
      lastCompletedDateStr = ktm.dateStr;
    }
  } catch (err) {
    // Amendment E: Catch getSetting failures and any unexpected tick errors
    logger.error({ err }, 'Error running daily work log reminder tick');
  } finally {
    isTickInFlight = false;
  }
}

/**
 * Starts the 5-minute work log reminder interval.
 * Never starts when NODE_ENV === 'test'.
 */
export function startWorkLogReminderJob(): ReturnType<typeof setInterval> | null {
  if (process.env['NODE_ENV'] === 'test' || config.nodeEnv === 'test') {
    return null;
  }
  if (reminderInterval) {
    return reminderInterval;
  }

  reminderInterval = setInterval(() => {
    void runWorkLogReminderTick();
  }, REMINDER_TICK_INTERVAL_MS);

  return reminderInterval;
}

/**
 * Stops the work log reminder interval on graceful shutdown.
 */
export function stopWorkLogReminderJob(): void {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
}
