import { extractDatePart, getKathmanduToday } from './dateUtils.js';
import type { ProjectTask, ProjectRole } from '../types/index.js';

export interface MilestoneTaskCounts {
  total: number;
  done: number;
}

/**
 * Determines whether a milestone is overdue:
 * - Completed milestones are never overdue (completedAt !== null).
 * - Milestones without a due date are never overdue.
 * - Compares calendar date part YYYY-MM-DD against Asia/Kathmandu reference date.
 * - Defaults referenceToday to getKathmanduToday().
 */
export function isMilestoneOverdue(
  dueDate: string | null | undefined,
  completedAt: string | null | undefined,
  today?: string
): boolean {
  if (completedAt) return false;
  const dueDatePart = extractDatePart(dueDate);
  if (!dueDatePart) return false;
  const referenceToday = today ?? getKathmanduToday();
  return dueDatePart < referenceToday;
}

/**
 * Computes task counts (total tasks and done tasks) grouped by milestoneId.
 */
export function computeMilestoneTaskCounts(
  tasks: ProjectTask[]
): Record<string, MilestoneTaskCounts> {
  const counts: Record<string, MilestoneTaskCounts> = {};

  for (const task of tasks) {
    if (task.milestoneId) {
      if (!counts[task.milestoneId]) {
        counts[task.milestoneId] = { total: 0, done: 0 };
      }
      counts[task.milestoneId]!.total += 1;
      if (task.status === 'done') {
        counts[task.milestoneId]!.done += 1;
      }
    }
  }

  return counts;
}

/**
 * Filters project tasks belonging to a specific milestone.
 */
export function getTasksForMilestone(
  tasks: ProjectTask[],
  milestoneId: string
): ProjectTask[] {
  return tasks.filter((t) => t.milestoneId === milestoneId);
}

/**
 * Milestone mutation permission check:
 * Managers and system_admin only. Members and viewers are denied.
 */
export function canManageMilestones(
  projectRole?: ProjectRole,
  isSystemAdmin?: boolean
): boolean {
  if (isSystemAdmin || projectRole === 'manager') {
    return true;
  }
  return false;
}

export interface MilestoneErrorInfo {
  key: string;
  defaultMessage: string;
  isNotFoundOrForbidden: boolean;
}

/**
 * Maps milestone error codes to friendly localized messages.
 */
export function mapMilestoneError(errInfo: {
  status: number;
  error: string;
  message?: string;
}): MilestoneErrorInfo {
  if (errInfo.error === 'already_completed') {
    return {
      key: 'projects.milestones.errors.alreadyCompleted',
      defaultMessage: 'Milestone is already completed.',
      isNotFoundOrForbidden: false,
    };
  }

  if (errInfo.error === 'already_open') {
    return {
      key: 'projects.milestones.errors.alreadyOpen',
      defaultMessage: 'Milestone is already open.',
      isNotFoundOrForbidden: false,
    };
  }

  if (errInfo.error === 'validation_error') {
    return {
      key: 'projects.milestones.errors.validation',
      defaultMessage: 'Invalid milestone data. Please check form values.',
      isNotFoundOrForbidden: false,
    };
  }

  if (errInfo.status === 403) {
    return {
      key: 'projects.milestones.errors.forbidden',
      defaultMessage: 'You do not have permission to manage milestones on this project.',
      isNotFoundOrForbidden: true,
    };
  }

  if (errInfo.status === 404) {
    return {
      key: 'projects.milestones.errors.notFound',
      defaultMessage: 'Milestone or project not found.',
      isNotFoundOrForbidden: true,
    };
  }

  return {
    key: 'projects.milestones.errors.generic',
    defaultMessage: errInfo.message || 'Failed to update milestone.',
    isNotFoundOrForbidden: false,
  };
}
