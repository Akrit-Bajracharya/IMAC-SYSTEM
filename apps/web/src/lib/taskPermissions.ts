/**
 * Mirrors task permission rules from the backend API:
 * Source file: apps/api/src/services/projectAccess.ts (canEditTask function and DELETE route check)
 *
 * Permission Matrix:
 * - system_admin: can do everything (create, edit, changeStatus, manageDependencies, delete, comment)
 * - manager: can do everything (create, edit, changeStatus, manageDependencies, delete, comment)
 * - member:
 *   - create: allowed
 *   - edit: allowed ONLY if creator or assignee
 *   - changeStatus: allowed ONLY if assignee
 *   - manageDependencies: allowed ONLY if creator or assignee
 *   - delete: denied (manager or system_admin only)
 *   - comment: allowed
 * - viewer: denied for all mutating operations
 * - undefined role / missing userId: denied for all operations (fail-closed)
 */

import type { ProjectRole } from '../types/index.js';

export type TaskAction = 'create' | 'edit' | 'changeStatus' | 'manageDependencies';

export interface TaskPermissionSubject {
  createdByUserId: string;
  assigneeUserId?: string | null;
}

export function canEditTask(
  projectRole: ProjectRole | undefined,
  isSystemAdmin: boolean,
  action: TaskAction,
  task?: TaskPermissionSubject | null,
  userId?: string
): boolean {
  if (isSystemAdmin || projectRole === 'manager') {
    return true;
  }
  if (!projectRole || projectRole === 'viewer') {
    return false;
  }
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    return false;
  }
  if (projectRole === 'member') {
    if (action === 'create') {
      return true;
    }
    if (!task) {
      return false;
    }
    const isCreator = Boolean(task.createdByUserId && task.createdByUserId === userId);
    const isAssignee = Boolean(task.assigneeUserId && task.assigneeUserId === userId);

    if (action === 'edit' || action === 'manageDependencies') {
      return isCreator || isAssignee;
    }
    if (action === 'changeStatus') {
      return isAssignee;
    }
  }
  return false;
}

export function canDeleteTask(
  projectRole: ProjectRole | undefined,
  isSystemAdmin: boolean
): boolean {
  return isSystemAdmin || projectRole === 'manager';
}

export function canCommentOnTask(
  projectRole: ProjectRole | undefined,
  isSystemAdmin: boolean
): boolean {
  if (isSystemAdmin || projectRole === 'manager' || projectRole === 'member') {
    return true;
  }
  return false;
}
