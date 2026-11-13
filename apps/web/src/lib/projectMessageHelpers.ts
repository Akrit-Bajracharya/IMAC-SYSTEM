import type { ProjectRole, ProjectMessage, ProjectMessageListResponse } from '../types/index.js';
import { canEditTask } from './taskPermissions.js';

/**
 * Pure helper functions for Project Messages subsystem.
 *
 * Source Permissions:
 * - apps/api/src/lib/permissions.ts:
 *   - message:create: ['system_admin', 'project_manager', 'employee', 'hr_admin']
 *   - message:pin:    ['system_admin', 'project_manager', 'employee', 'hr_admin']
 *   - task:write:      ['system_admin', 'project_manager', 'employee', 'hr_admin']
 * - apps/api/src/routes/messages.ts:
 *   - POST /api/projects/:id/messages (lines 29-44)
 *   - POST /api/projects/:id/messages/:messageId/pin (lines 147-164)
 *   - POST /api/projects/:id/messages/:messageId/to-task (lines 285-303)
 */

export const ALLOWED_MESSAGE_SYSTEM_ROLES = [
  'system_admin',
  'project_manager',
  'employee',
  'hr_admin',
] as const;

/**
 * Evaluates whether a user can post a project message.
 * Source: apps/api/src/lib/permissions.ts:83-85 & apps/api/src/routes/messages.ts:29-44
 * - Must hold an allowed systemRole (system-role 'viewer' returns false).
 * - system_admin can post even without a member row.
 * - Project managers and members can post.
 * - Project viewers, undefined, or unknown roles cannot post.
 */
export function canPostMessage(
  callerProjectRole?: ProjectRole | string | null,
  systemRole?: string | null
): boolean {
  if (!systemRole || !ALLOWED_MESSAGE_SYSTEM_ROLES.includes(systemRole as any)) {
    return false;
  }
  if (systemRole === 'system_admin') {
    return true;
  }
  if (callerProjectRole === 'manager' || callerProjectRole === 'member') {
    return true;
  }
  return false;
}

/**
 * Evaluates whether a user can pin or unpin a project message.
 * Source: apps/api/src/lib/permissions.ts:83-85 & apps/api/src/routes/messages.ts:147-164
 * - Must hold an allowed systemRole (system-role 'viewer' returns false).
 * - Allowed only for system_admin or project managers.
 * - Project members, viewers, undefined, or unknown roles cannot pin.
 */
export function canPinMessage(
  callerProjectRole?: ProjectRole | string | null,
  systemRole?: string | null
): boolean {
  if (!systemRole || !ALLOWED_MESSAGE_SYSTEM_ROLES.includes(systemRole as any)) {
    return false;
  }
  if (systemRole === 'system_admin' || callerProjectRole === 'manager') {
    return true;
  }
  return false;
}

/**
 * Evaluates whether a user can convert a project message into a task.
 * Source: apps/api/src/lib/permissions.ts:79-85 (task:write) & apps/api/src/routes/messages.ts:285-303
 * - Must hold an allowed systemRole for task:write (system-role 'viewer' returns false).
 * - Delegates directly to existing canEditTask helper with 'create' action.
 * - For a project member, missing or empty userId returns false (fail-closed).
 */
export function canConvertToTask(
  callerProjectRole?: ProjectRole | string | null,
  systemRole?: string | null,
  userId?: string | null
): boolean {
  if (!systemRole || !ALLOWED_MESSAGE_SYSTEM_ROLES.includes(systemRole as any)) {
    return false;
  }
  const isSystemAdmin = systemRole === 'system_admin';
  return canEditTask(
    callerProjectRole as ProjectRole,
    isSystemAdmin,
    'create',
    null,
    userId ?? undefined
  );
}

/**
 * Flattens infinite query message pages and deduplicates by message id,
 * preserving server order (pinned first, then descending chronological).
 */
export function deduplicateMessagesById(pages: ProjectMessageListResponse[]): ProjectMessage[] {
  const seen = new Set<string>();
  const result: ProjectMessage[] = [];

  for (const page of pages) {
    if (!page || !Array.isArray(page.items)) continue;
    for (const msg of page.items) {
      if (msg && msg.id && !seen.has(msg.id)) {
        seen.add(msg.id);
        result.push(msg);
      }
    }
  }

  return result;
}

/**
 * Builds a session tracking key for converted messages scoped by project and message.
 */
export function getConvertedMessageKey(projectId: string, messageId: string): string {
  return `${projectId}:${messageId}`;
}

export interface ConvertedMessageInfo {
  taskId?: string;
  taskTitle?: string;
}

/**
 * Checks whether a message has already been converted in the current UI session.
 */
export function isMessageConverted(
  convertedMap: Record<string, ConvertedMessageInfo>,
  projectId: string,
  messageId: string
): boolean {
  const key = getConvertedMessageKey(projectId, messageId);
  return Boolean(convertedMap[key]);
}

/**
 * Maps API error responses for project messages into user-friendly translation keys / messages.
 */
export function mapProjectMessageError(err: any): {
  code: string;
  messageKey: string;
  defaultMessage: string;
} {
  const status = err?.response?.status ?? 500;
  const errorCode = err?.response?.data?.error;

  if (status === 409 || errorCode === 'already_converted') {
    return {
      code: 'already_converted',
      messageKey: 'projects.messages.errors.alreadyConverted',
      defaultMessage: 'Message has already been converted to a task',
    };
  }

  if (errorCode === 'invalid_cursor') {
    return {
      code: 'invalid_cursor',
      messageKey: 'projects.messages.errors.invalidCursor',
      defaultMessage: 'Message list was refreshed due to an updated cursor',
    };
  }

  if (errorCode === 'validation_error' || status === 400) {
    return {
      code: 'validation_error',
      messageKey: 'projects.messages.errors.validationError',
      defaultMessage: 'Message body must be between 1 and 5000 characters',
    };
  }

  if (status === 403 || errorCode === 'forbidden') {
    return {
      code: 'forbidden',
      messageKey: 'projects.messages.errors.forbidden',
      defaultMessage: 'You do not have permission to perform this action',
    };
  }

  if (status === 404 || errorCode === 'not_found') {
    return {
      code: 'not_found',
      messageKey: 'projects.messages.errors.notFound',
      defaultMessage: 'Message or project not found',
    };
  }

  return {
    code: 'unknown_error',
    messageKey: 'projects.messages.errors.unexpected',
    defaultMessage: 'An unexpected error occurred. Please try again.',
  };
}
