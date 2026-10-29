import { db } from '../db.js';
import { getWorkLogPolicies } from './workLogPolicies.js';
import type { WorkLogEntryInput } from '@imac/shared';
import { isValidUuid } from './projectAccess.js';

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
export interface ProjectTaskValidationResult {
  valid: boolean;
  errorCode?: 'invalid_project' | 'invalid_task';
  errorMessage?: string;
}

/**
 * Validates projectId and taskId across an array of work log entries for daily work log write paths.
 * - If projectId is provided: must be a valid UUID, project must exist, and caller must have a ProjectMember row
 *   (unless isAdminOverride=true, in which case caller only needs project to exist). Otherwise 400 invalid_project.
 * - If taskId is provided: projectId must also be provided, task must exist and belong to that project;
 *   otherwise 400 invalid_task.
 * - Empty or missing values stay allowed.
 * - Free-text values (not valid UUIDs) are refused on new writes (invalid_project / invalid_task).
 */
export async function validateWorkLogEntriesProjectAndTask(
  entries: Array<{ projectId?: string | null; taskId?: string | null }>,
  userId: string,
  isAdminOverride: boolean = false,
): Promise<ProjectTaskValidationResult> {
  for (const entry of entries) {
    const rawProjectId = entry.projectId ? entry.projectId.trim() : null;
    const rawTaskId = entry.taskId ? entry.taskId.trim() : null;

    // 1. taskId requires projectId
    if (rawTaskId && !rawProjectId) {
      return {
        valid: false,
        errorCode: 'invalid_task',
        errorMessage: 'taskId cannot be provided without a projectId',
      };
    }

    // 2. If projectId provided, validate UUID
    if (rawProjectId && !isValidUuid(rawProjectId)) {
      return {
        valid: false,
        errorCode: 'invalid_project',
        errorMessage: 'projectId must be a valid UUID',
      };
    }

    // 3. If taskId provided, validate UUID
    if (rawTaskId && !isValidUuid(rawTaskId)) {
      return {
        valid: false,
        errorCode: 'invalid_task',
        errorMessage: 'taskId must be a valid UUID',
      };
    }
  }

  // Collect unique valid project IDs and task IDs
  const projectIds = [
    ...new Set(
      entries
        .map((e) => (e.projectId ? e.projectId.trim() : null))
        .filter((id): id is string => Boolean(id && isValidUuid(id))),
    ),
  ];

  const taskIds = [
    ...new Set(
      entries
        .map((e) => (e.taskId ? e.taskId.trim() : null))
        .filter((id): id is string => Boolean(id && isValidUuid(id))),
    ),
  ];

  if (projectIds.length === 0 && taskIds.length === 0) {
    return { valid: true };
  }

  // Verify all projects exist
  if (projectIds.length > 0) {
    const existingProjects = await db.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true },
    });
    const existingProjectIds = new Set(existingProjects.map((p) => p.id));
    for (const pId of projectIds) {
      if (!existingProjectIds.has(pId)) {
        return {
          valid: false,
          errorCode: 'invalid_project',
          errorMessage: `Project ${pId} does not exist`,
        };
      }
    }

    // If not admin override, verify caller has a ProjectMember row on each project
    if (!isAdminOverride) {
      const memberships = await db.projectMember.findMany({
        where: {
          projectId: { in: projectIds },
          userId,
        },
        select: { projectId: true },
      });
      const memberProjectIds = new Set(memberships.map((m) => m.projectId));
      for (const pId of projectIds) {
        if (!memberProjectIds.has(pId)) {
          return {
            valid: false,
            errorCode: 'invalid_project',
            errorMessage: `Caller is not a member of project ${pId}`,
          };
        }
      }
    }
  }

  // Verify all tasks exist and belong to their respective project
  if (taskIds.length > 0) {
    const existingTasks = await db.task.findMany({
      where: { id: { in: taskIds } },
      select: { id: true, projectId: true },
    });
    const taskMap = new Map(existingTasks.map((t) => [t.id, t.projectId]));

    for (const entry of entries) {
      const rawTaskId = entry.taskId ? entry.taskId.trim() : null;
      const rawProjectId = entry.projectId ? entry.projectId.trim() : null;

      if (rawTaskId) {
        const associatedProjectId = taskMap.get(rawTaskId);
        if (!associatedProjectId || associatedProjectId !== rawProjectId) {
          return {
            valid: false,
            errorCode: 'invalid_task',
            errorMessage: `Task ${rawTaskId} does not exist or does not belong to project ${rawProjectId}`,
          };
        }
      }
    }
  }

  return { valid: true };
}

/**
 * Enriches work log entries with projectName and taskTitle using one bounded lookup per request.
 * - Resolves projectName when project exists and caller has access (member or system_admin).
 * - Resolves taskTitle when task exists and belongs to that project and caller has access.
 * - Resolves to null when unresolvable or when caller is not a member of that project (prevents leakage).
 * - Free-text or non-UUID projectId/taskId in historical logs cleanly resolve to null without errors.
 */
export async function enrichWorkLogsWithProjectAndTask<T extends { entries: any[] }>(
  logs: T[],
  callerUserId: string,
  callerSystemRole?: string,
): Promise<T[]> {
  const allEntries: any[] = [];
  for (const log of logs) {
    if (Array.isArray(log.entries)) {
      for (const entry of log.entries) {
        allEntries.push(entry);
      }
    }
  }

  if (allEntries.length === 0) {
    return logs;
  }

  const validProjectIds = [
    ...new Set(
      allEntries
        .map((e) => (typeof e.projectId === 'string' ? e.projectId.trim() : null))
        .filter((id): id is string => Boolean(id && isValidUuid(id))),
    ),
  ];

  const validTaskIds = [
    ...new Set(
      allEntries
        .map((e) => (typeof e.taskId === 'string' ? e.taskId.trim() : null))
        .filter((id): id is string => Boolean(id && isValidUuid(id))),
    ),
  ];

  let projectMap = new Map<string, string>();
  let accessibleProjectSet = new Set<string>();
  let taskMap = new Map<string, { projectId: string; title: string }>();

  if (validProjectIds.length > 0) {
    const projects = await db.project.findMany({
      where: { id: { in: validProjectIds } },
      select: { id: true, name: true },
    });
    projectMap = new Map(projects.map((p) => [p.id, p.name]));

    if (callerSystemRole === 'system_admin') {
      accessibleProjectSet = new Set(projects.map((p) => p.id));
    } else {
      const memberships = await db.projectMember.findMany({
        where: {
          projectId: { in: validProjectIds },
          userId: callerUserId,
        },
        select: { projectId: true },
      });
      accessibleProjectSet = new Set(memberships.map((m) => m.projectId));
    }
  }

  if (validTaskIds.length > 0) {
    const tasks = await db.task.findMany({
      where: { id: { in: validTaskIds } },
      select: { id: true, projectId: true, title: true },
    });
    taskMap = new Map(tasks.map((t) => [t.id, { projectId: t.projectId, title: t.title }]));
  }

  for (const log of logs) {
    if (Array.isArray(log.entries)) {
      log.entries = log.entries.map((entry) => {
        const rawProjectId = typeof entry.projectId === 'string' ? entry.projectId.trim() : null;
        const rawTaskId = typeof entry.taskId === 'string' ? entry.taskId.trim() : null;

        let projectName: string | null = null;
        let taskTitle: string | null = null;

        if (rawProjectId && isValidUuid(rawProjectId) && accessibleProjectSet.has(rawProjectId)) {
          projectName = projectMap.get(rawProjectId) ?? null;

          if (rawTaskId && isValidUuid(rawTaskId)) {
            const task = taskMap.get(rawTaskId);
            if (task && task.projectId === rawProjectId) {
              taskTitle = task.title;
            }
          }
        }

        return {
          ...entry,
          projectName,
          taskTitle,
        };
      });
    }
  }

  return logs;
}

export async function enrichSingleWorkLogWithProjectAndTask<T extends { entries: any[] }>(
  log: T | null | undefined,
  callerUserId: string,
  callerSystemRole?: string,
): Promise<T | null> {
  if (!log || typeof log !== 'object' || !('entries' in log)) return null;
  const [enriched] = await enrichWorkLogsWithProjectAndTask([log as T], callerUserId, callerSystemRole);
  return enriched ?? null;
}
