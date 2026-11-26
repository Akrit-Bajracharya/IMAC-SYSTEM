/**
 * Mock-Based Unit & Integration Tests for Daily Work Log Reminder Job (Step 18b).
 *
 * NOTE: These tests run against an in-memory mocked database (mockDb in setup.ts)
 * and Vitest fake timers.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../db.js';
import { logger } from '../logger.js';
import {
  getKathmanduDateTime,
  parseReminderConfig,
  isWorkingDayForProfile,
  shouldRunReminderTick,
  isOnApprovedLeave,
  runWorkLogReminderTick,
  startWorkLogReminderJob,
  resetWorkLogReminderState,
  REMINDER_BATCH_SIZE,
} from '../services/workLogReminder.js';

describe('Step 18b: Daily Work Log Reminder Job (Mock-Based)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWorkLogReminderState();
    (db.systemSetting.findUnique as any).mockResolvedValue(null);
    (db.user.findMany as any).mockResolvedValue([]);
    (db.workLogDay.findMany as any).mockResolvedValue([]);
    (db.notification.findMany as any).mockResolvedValue([]);
    (db.notification.create as any).mockImplementation(async (args: any) => ({
      id: `notif-${args.data.userId}`,
      ...args.data,
    }));
    (db.$transaction as any).mockImplementation(async (cb: any) => cb(db));
  });

  afterEach(() => {
    resetWorkLogReminderState();
    vi.useRealTimers();
  });

  // ── 1. Pure Decision Functions (Table-Driven) ───────────────────────────────

  describe('1. Pure Functions: getKathmanduDateTime & Midnight Boundaries', () => {
    it.each([
      {
        name: '18:14 UTC is 23:59 same Kathmandu day (before midnight)',
        iso: '2026-11-26T18:14:00.000Z',
        expectedDate: '2026-11-26',
        expectedTime: '23:59',
        expectedDow: 4, // Thursday
      },
      {
        name: '18:15 UTC is 00:00 next Kathmandu day (exact midnight rollover)',
        iso: '2026-11-26T18:15:00.000Z',
        expectedDate: '2026-11-27',
        expectedTime: '00:00',
        expectedDow: 5, // Friday
      },
      {
        name: '11:15 UTC is 17:00 Kathmandu',
        iso: '2026-11-26T11:15:00.000Z',
        expectedDate: '2026-11-26',
        expectedTime: '17:00',
        expectedDow: 4, // Thursday
      },
    ])('$name', ({ iso, expectedDate, expectedTime, expectedDow }) => {
      const res = getKathmanduDateTime(new Date(iso));
      expect(res).toEqual({
        dateStr: expectedDate,
        timeStr: expectedTime,
        dayOfWeek: expectedDow,
      });
    });
  });

  describe('2. Pure Functions: parseReminderConfig', () => {
    it.each([
      { rawEnabled: 'true', rawTime: '17:00', valid: true, enabled: true, timeStr: '17:00' },
      { rawEnabled: 'false', rawTime: '17:00', valid: true, enabled: false, timeStr: '17:00' },
      { rawEnabled: 'TRUE', rawTime: '09:30', valid: true, enabled: true, timeStr: '09:30' },
      { rawEnabled: 'yes', rawTime: '17:00', valid: false, enabled: false, timeStr: '17:00' },
      { rawEnabled: 'true', rawTime: '25:00', valid: false, enabled: false, timeStr: '17:00' },
      { rawEnabled: 'true', rawTime: '17:60', valid: false, enabled: false, timeStr: '17:00' },
      { rawEnabled: 'true', rawTime: 'invalid', valid: false, enabled: false, timeStr: '17:00' },
    ])(
      'enabled="$rawEnabled" time="$rawTime" -> valid=$valid, enabled=$enabled',
      ({ rawEnabled, rawTime, valid, enabled, timeStr }) => {
        const res = parseReminderConfig(rawEnabled, rawTime);
        expect(res.valid).toBe(valid);
        expect(res.enabled).toBe(enabled);
        expect(res.timeStr).toBe(timeStr);
      }
    );
  });

  describe('3. Pure Functions: isWorkingDayForProfile', () => {
    it.each([
      { dow: 0, count: 5, expected: false }, // Sunday (Mon-Fri assumption)
      { dow: 1, count: 5, expected: true }, // Monday
      { dow: 5, count: 5, expected: true }, // Friday
      { dow: 6, count: 5, expected: false }, // Saturday
      { dow: 6, count: 6, expected: true }, // Saturday for 6-day week
      { dow: 0, count: 6, expected: false }, // Sunday for 6-day week
      { dow: 0, count: 7, expected: true }, // Sunday for 7-day week
      { dow: 1, count: 0, expected: false }, // Invalid count
    ])('dayOfWeek=$dow workingDaysPerWeek=$count -> $expected', ({ dow, count, expected }) => {
      expect(isWorkingDayForProfile(dow, count)).toBe(expected);
    });
  });

  describe('4. Pure Functions: shouldRunReminderTick', () => {
    it.each([
      {
        name: 'disabled -> false',
        config: { valid: true, enabled: false, timeStr: '17:00' },
        currentTimeStr: '17:05',
        currentDateStr: '2026-11-26',
        lastCompletedDateStr: null,
        expected: false,
      },
      {
        name: 'invalid -> false',
        config: { valid: false, enabled: false, timeStr: '17:00' },
        currentTimeStr: '17:05',
        currentDateStr: '2026-11-26',
        lastCompletedDateStr: null,
        expected: false,
      },
      {
        name: 'before reminder time -> false',
        config: { valid: true, enabled: true, timeStr: '17:00' },
        currentTimeStr: '16:59',
        currentDateStr: '2026-11-26',
        lastCompletedDateStr: null,
        expected: false,
      },
      {
        name: 'at reminder time -> true',
        config: { valid: true, enabled: true, timeStr: '17:00' },
        currentTimeStr: '17:00',
        currentDateStr: '2026-11-26',
        lastCompletedDateStr: null,
        expected: true,
      },
      {
        name: 'already completed today -> false',
        config: { valid: true, enabled: true, timeStr: '17:00' },
        currentTimeStr: '17:05',
        currentDateStr: '2026-11-26',
        lastCompletedDateStr: '2026-11-26',
        expected: false,
      },
    ])('$name', ({ config, currentTimeStr, currentDateStr, lastCompletedDateStr, expected }) => {
      expect(
        shouldRunReminderTick({
          config,
          currentTimeStr,
          currentDateStr,
          lastCompletedDateStr,
        })
      ).toBe(expected);
    });
  });

  // ── 2. Tick Execution & Scheduling Rules ────────────────────────────────────

  describe('5. Tick Execution, Eligibility & Deduplication', () => {
    function mockSettings(enabled: string | null, time: string | null) {
      (db.systemSetting.findUnique as any).mockImplementation(async (args: any) => {
        if (args?.where?.key === 'worklog.reminder.enabled' && enabled !== null) {
          return { key: 'worklog.reminder.enabled', value: enabled };
        }
        if (args?.where?.key === 'worklog.reminder.time' && time !== null) {
          return { key: 'worklog.reminder.time', value: time };
        }
        return null;
      });
    }

    it('never starts interval in NODE_ENV=test', () => {
      expect(process.env['NODE_ENV']).toBe('test');
      expect(startWorkLogReminderJob()).toBeNull();
    });

    it('does nothing when disabled (default false)', async () => {
      mockSettings(null, null);
      await runWorkLogReminderTick(new Date('2026-11-26T12:00:00.000Z')); // 17:45 KTM Thursday
      expect(db.user.findMany).not.toHaveBeenCalled();
      expect(db.notification.create).not.toHaveBeenCalled();
    });

    it('does nothing before configured reminder time', async () => {
      mockSettings('true', '17:00');
      await runWorkLogReminderTick(new Date('2026-11-26T11:14:00.000Z')); // 16:59 KTM Thursday
      expect(db.user.findMany).not.toHaveBeenCalled();
      expect(db.notification.create).not.toHaveBeenCalled();
    });

    it('disables run and logs warning when time setting is invalid', async () => {
      const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
      mockSettings('true', '99:99');
      await runWorkLogReminderTick(new Date('2026-11-26T12:00:00.000Z'));
      expect(warnSpy).toHaveBeenCalled();
      expect(db.user.findMany).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('notifies eligible users after reminder time with payload { date } only and no audit log', async () => {
      mockSettings('true', '17:00');
      (db.user.findMany as any).mockResolvedValue([
        { id: 'u-1', employeeProfile: { id: 'p-1', workingDaysPerWeek: 5 } },
        { id: 'u-2', employeeProfile: { id: 'p-2', workingDaysPerWeek: 5 } },
      ]);
      // u-1 has a draft day (should STILL be reminded); u-2 has no day
      (db.workLogDay.findMany as any).mockResolvedValue([]);

      await runWorkLogReminderTick(new Date('2026-11-26T11:15:00.000Z')); // 17:00 KTM Thursday

      // Verify active, non-viewer, has-profile filter
      expect(db.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            systemRole: { not: 'viewer' },
            employeeProfile: { isNot: null },
          },
        })
      );

      expect(db.notification.create).toHaveBeenCalledTimes(2);
      expect((db.notification.create as any).mock.calls[0][0].data).toEqual({
        userId: 'u-1',
        type: 'work_log.reminder',
        entityType: 'work_log',
        entityId: '2026-11-26',
        projectId: null,
        payload: { date: '2026-11-26' },
      });
      expect(db.auditLog.create).not.toHaveBeenCalled();
      expect(await isOnApprovedLeave('u-1', '2026-11-26')).toBe(false);
    });

    it('skips weekend / non-working days', async () => {
      mockSettings('true', '17:00');
      (db.user.findMany as any).mockResolvedValue([
        { id: 'u-5day', employeeProfile: { id: 'p-5', workingDaysPerWeek: 5 } },
      ]);

      // 2026-11-28 is Saturday in Kathmandu
      await runWorkLogReminderTick(new Date('2026-11-28T11:30:00.000Z'));
      expect(db.notification.create).not.toHaveBeenCalled();
    });

    it('skips users with submitted or approved WorkLogDay, but reminds draft days', async () => {
      mockSettings('true', '17:00');
      (db.user.findMany as any).mockResolvedValue([
        { id: 'u-sub', employeeProfile: { id: 'p-sub', workingDaysPerWeek: 5 } },
        { id: 'u-draft', employeeProfile: { id: 'p-draft', workingDaysPerWeek: 5 } },
      ]);
      // Query filters status: { in: ['submitted', 'approved'] }, so only p-sub is returned
      (db.workLogDay.findMany as any).mockResolvedValue([{ employeeProfileId: 'p-sub' }]);

      await runWorkLogReminderTick(new Date('2026-11-26T11:30:00.000Z'));

      expect(db.notification.create).toHaveBeenCalledTimes(1);
      expect((db.notification.create as any).mock.calls[0][0].data.userId).toBe('u-draft');
    });

    it('second tick same day sends nothing new (in-memory cache & DB dedup after restart)', async () => {
      mockSettings('true', '17:00');
      (db.user.findMany as any).mockResolvedValue([
        { id: 'u-1', employeeProfile: { id: 'p-1', workingDaysPerWeek: 5 } },
      ]);

      await runWorkLogReminderTick(new Date('2026-11-26T11:20:00.000Z'));
      expect(db.notification.create).toHaveBeenCalledTimes(1);

      // Second tick same day -> skipped immediately without even querying DB (Amendment C)
      vi.clearAllMocks();
      await runWorkLogReminderTick(new Date('2026-11-26T11:25:00.000Z'));
      expect(db.user.findMany).not.toHaveBeenCalled();
      expect(db.notification.create).not.toHaveBeenCalled();

      // Simulate process restart -> DB dedup inside tx prevents duplicate (Amendment B)
      resetWorkLogReminderState();
      mockSettings('true', '17:00');
      (db.user.findMany as any).mockResolvedValue([
        { id: 'u-1', employeeProfile: { id: 'p-1', workingDaysPerWeek: 5 } },
      ]);
      (db.workLogDay.findMany as any).mockResolvedValue([]);
      (db.notification.findMany as any).mockResolvedValue([{ userId: 'u-1' }]);

      await runWorkLogReminderTick(new Date('2026-11-26T11:30:00.000Z'));
      expect(db.notification.create).not.toHaveBeenCalled();
    });

    it('Amendment F: midnight rollover at 18:15 UTC uses new Kathmandu date and never creates for previous date', async () => {
      mockSettings('true', '00:00');
      (db.user.findMany as any).mockResolvedValue([
        { id: 'u-1', employeeProfile: { id: 'p-1', workingDaysPerWeek: 5 } },
      ]);

      // 2026-11-26T18:15:00Z = 2026-11-27 00:00 Asia/Kathmandu (Friday)
      await runWorkLogReminderTick(new Date('2026-11-26T18:15:00.000Z'));

      expect(db.notification.create).toHaveBeenCalledTimes(1);
      const data = (db.notification.create as any).mock.calls[0][0].data;
      expect(data.entityId).toBe('2026-11-27');
      expect(data.payload).toEqual({ date: '2026-11-27' });
    });

    it('batches 250 recipients into 3 transactions (100 + 100 + 50)', async () => {
      mockSettings('true', '17:00');
      const users = Array.from({ length: 250 }, (_, idx) => ({
        id: `u-${idx}`,
        employeeProfile: { id: `p-${idx}`, workingDaysPerWeek: 5 },
      }));
      (db.user.findMany as any).mockResolvedValue(users);

      await runWorkLogReminderTick(new Date('2026-11-26T11:30:00.000Z'));

      expect(REMINDER_BATCH_SIZE).toBe(100);
      expect(db.$transaction).toHaveBeenCalledTimes(3);
      expect(db.notification.findMany).toHaveBeenCalledTimes(3);
      expect(db.notification.create).toHaveBeenCalledTimes(250);
    });

    it('Amendment D: if a batch fails, keeps earlier batches and retries only remaining users on next tick', async () => {
      const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
      mockSettings('true', '17:00');
      const users = Array.from({ length: 150 }, (_, idx) => ({
        id: `u-${idx}`,
        employeeProfile: { id: `p-${idx}`, workingDaysPerWeek: 5 },
      }));
      (db.user.findMany as any).mockResolvedValue(users);

      // Batch 1 (100) succeeds, Batch 2 (50) fails
      (db.$transaction as any)
        .mockImplementationOnce(async (cb: any) => cb(db))
        .mockRejectedValueOnce(new Error('Batch 2 DB error'));

      await runWorkLogReminderTick(new Date('2026-11-26T11:30:00.000Z'));

      expect(db.notification.create).toHaveBeenCalledTimes(100);
      expect(errorSpy).toHaveBeenCalled();

      // Next tick: Batch 1 users are already in DB, Batch 2 users are not -> only 50 created
      (db.notification.create as any).mockClear();
      (db.$transaction as any).mockImplementation(async (cb: any) => cb(db));
      (db.notification.findMany as any).mockImplementation(async (args: any) => {
        const ids: string[] = args?.where?.userId?.in ?? [];
        return ids
          .filter((id) => parseInt(id.split('-')[1]!, 10) < 100)
          .map((userId) => ({ userId }));
      });

      await runWorkLogReminderTick(new Date('2026-11-26T11:35:00.000Z'));
      expect(db.notification.create).toHaveBeenCalledTimes(50);
      errorSpy.mockRestore();
    });

    it('Amendment E: catches getSetting DB failures inside the tick without throwing', async () => {
      const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
      (db.systemSetting.findUnique as any).mockRejectedValueOnce(
        new Error('Database connection lost')
      );

      await expect(
        runWorkLogReminderTick(new Date('2026-11-26T11:30:00.000Z'))
      ).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('skips overlapping tick via in-flight flag', async () => {
      const resolvers: Array<(val: any) => void> = [];
      (db.systemSetting.findUnique as any).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvers.push(resolve);
          })
      );

      const firstTick = runWorkLogReminderTick(new Date('2026-11-26T11:30:00.000Z'));
      const secondTick = runWorkLogReminderTick(new Date('2026-11-26T11:30:01.000Z'));

      // Second tick returns immediately while first is still awaiting
      await secondTick;
      expect(db.systemSetting.findUnique).toHaveBeenCalledTimes(2); // only from firstTick

      for (const resolve of resolvers) {
        resolve(null);
      }
      await firstTick;
    });
  });
});
