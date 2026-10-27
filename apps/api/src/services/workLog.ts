import { db } from '../db.js';
import { getWorkLogPolicies } from './workLogPolicies.js';
import type { WorkLogEntryInput } from '@imac/shared';

export const MAX_FUTURE_DAYS = 1;
export const MAX_PAST_DAYS = 90;

/**
 * Returns the current date formatted as 'YYYY-MM-DD' in Asia/Kathmandu time zone.
 */
export function getKathmanduTodayDateString(refDate: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kathmandu' }).format(refDate);
}

/**
 * Converts a YYYY-MM-DD string into a Date at UTC midnight.
 */
export function parseDateOnlyUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Validates that a date is within [-MAX_PAST_DAYS, +MAX_FUTURE_DAYS] relative to Asia/Kathmandu today.
 */
export function validateKathmanduDateRange(
  dateStr: string,
  refDate: Date = new Date(),
): { valid: boolean; reason?: string } {
  const todayStr = getKathmanduTodayDateString(refDate);
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const todayUtc = Date.UTC(ty, tm - 1, td);

  const [y, m, d] = dateStr.split('-').map(Number);
  const targetUtc = Date.UTC(y, m - 1, d);

  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((targetUtc - todayUtc) / msPerDay);

  if (diffDays > MAX_FUTURE_DAYS) {
    return {
      valid: false,
      reason: `Date cannot be more than ${MAX_FUTURE_DAYS} day in the future (Asia/Kathmandu)`,
    };
  }
  if (diffDays < -MAX_PAST_DAYS) {
    return {
      valid: false,
      reason: `Date cannot be older than ${MAX_PAST_DAYS} days in the past (Asia/Kathmandu)`,
    };
  }
  return { valid: true };
}

/**
 * HOOK: Check if the employee has approved leave on the given date.
 * Empty stub returning no-leave for Step 8b. Do not call in request pipeline.
 */
export async function checkApprovedLeave(
  _employeeProfileId: string,
  _date: Date,
): Promise<{ hasApprovedLeave: boolean; leaveDetails?: unknown }> {
  return { hasApprovedLeave: false };
}

/**
 * HOOK: Handle overtime flow when hours exceed shift length.
 * Empty stub for Step 8b. Do not call in request pipeline.
 */
export async function handleOvertimeFlow(
  _totalHours: number,
  _standardShiftHours: number,
): Promise<{ isOvertime: boolean; overtimeHours: number }> {
  return { isOvertime: false, overtimeHours: 0 };
}

/**
 * Resolves the EmployeeProfile for an authenticated User ID.
 */
export async function getEmployeeProfile(userId: string) {
  return db.employeeProfile.findUnique({
    where: { userId },
    include: {
      workRoles: {
        include: { workRole: true },
      },
    },
  });
}

/**
 * Validates that all workRoleId values in the given entries belong to the employee's active assigned work roles.
 */
export async function validateAssignedWorkRoles(
  employeeProfileId: string,
  entries: WorkLogEntryInput[],
): Promise<{ valid: boolean; invalidRoleId?: string }> {
  const assignments = await db.employeeWorkRole.findMany({
    where: {
      employeeProfileId,
      workRole: { isActive: true },
    },
    select: { workRoleId: true },
  });

  const assignedRoleIds = new Set(assignments.map((a) => a.workRoleId));

  for (const entry of entries) {
    if (!assignedRoleIds.has(entry.workRoleId)) {
      return { valid: false, invalidRoleId: entry.workRoleId };
    }
  }

  return { valid: true };
}

/**
 * Validates that all workRoleId values exist and are active in the system.
 */
export async function validateActiveWorkRoles(
  entries: WorkLogEntryInput[],
): Promise<{ valid: boolean; invalidRoleId?: string }> {
  const roleIds = [...new Set(entries.map((e) => e.workRoleId))];
  const activeRoles = await db.workRole.findMany({
    where: {
      id: { in: roleIds },
      isActive: true,
    },
    select: { id: true },
  });

  const activeSet = new Set(activeRoles.map((r) => r.id));
  for (const id of roleIds) {
    if (!activeSet.has(id)) {
      return { valid: false, invalidRoleId: id };
    }
  }

  return { valid: true };
}

/**
 * Helper to calculate total hours from an entries array.
 */
export function calculateTotalHours(entries: { hours: number }[]): number {
  return Math.round(entries.reduce((sum, e) => sum + e.hours, 0) * 100) / 100;
}
