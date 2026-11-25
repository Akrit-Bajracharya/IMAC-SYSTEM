/**
 * Pure helper functions for the Notifications Bell and Notification Centre (Step 17b).
 * All logic is purely functional, side-effect free, and unit tested in Node.
 */

import { NOTIFICATION_TYPES } from '../constants/notificationTypes.js';
import { getTaskDetailPath } from './taskLinks.js';
import { resolveWorkLogErrorInfo } from './workLogReviewHelpers.js';

export interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  entityType: string | null;
  entityId: string | null;
  projectId: string | null;
  payload: Record<string, string | number | boolean | null>;
  readAt: string | null;
  createdAt: string;
}

export interface FetchNotificationsParams {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}

export interface NotificationsListResponse {
  items: NotificationItem[];
  total: number;
  unreadCount: number;
  limit: number;
  offset: number;
}

export interface UnreadCountResponse {
  unreadCount: number;
}

export interface MarkReadResponse {
  success: boolean;
}

export interface MarkAllReadResponse {
  updated: number;
}

/**
 * Shared React Query key family (Amendment B) so bell dropdown and page caches
 * stay consistent and are both invalidated on mark-read and mark-all.
 */
export const notificationKeys = {
  all: ['notifications'] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
  list: (params: { unreadOnly?: boolean; limit?: number; offset?: number }) =>
    ['notifications', 'list', params] as const,
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(val: unknown): val is string {
  return typeof val === 'string' && UUID_REGEX.test(val);
}

/**
 * Builds clean query params for GET /api/notifications.
 * - Never sends empty or undefined values.
 * - Explicitly preserves offset: 0 (no falsy check).
 * - Sends unreadOnly only when true.
 */
export function buildNotificationQueryParams(
  params: FetchNotificationsParams
): Record<string, string | number> {
  const result: Record<string, string | number> = {};

  if (
    typeof params.limit === 'number' &&
    Number.isFinite(params.limit) &&
    params.limit > 0
  ) {
    result['limit'] = params.limit;
  }

  // offset 0 is valid and must be sent
  if (
    typeof params.offset === 'number' &&
    Number.isFinite(params.offset) &&
    params.offset >= 0
  ) {
    result['offset'] = params.offset;
  }

  if (params.unreadOnly === true) {
    result['unreadOnly'] = 'true';
  }

  return result;
}

/**
 * Formats the unread badge label for the notification bell:
 * - 0 (or <= 0) -> null (badge hidden)
 * - 1..99 -> "1".."99"
 * - > 99 -> "99+"
 */
export function formatUnreadBadge(count: number): string | null {
  if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) {
    return null;
  }
  const floored = Math.floor(count);
  if (floored <= 0) return null;
  if (floored > 99) return '99+';
  return String(floored);
}

/**
 * Returns the role-appropriate notifications page path for top-level /notifications redirect.
 */
export function getNotificationsRedirectPath(systemRole?: string): string {
  if (systemRole === 'system_admin' || systemRole === 'hr_admin') {
    return '/admin/notifications';
  }
  return '/employee/notifications';
}

function safePayloadStr(val: unknown): string | null {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export type TranslateFn = (
  key: string,
  options?: Record<string, unknown>
) => string;

/**
 * Builds user-facing notification message text from item.type + item.payload
 * via i18n translation keys.
 * - Missing payload keys never print "undefined" or "null".
 * - Unknown types return a neutral translated fallback and never crash.
 * - Plain text only (never HTML).
 */
export function notificationText(item: NotificationItem, t: TranslateFn): string {
  const payload = item.payload ?? {};
  const taskTitle = safePayloadStr(payload['taskTitle']);
  const projectName = safePayloadStr(payload['projectName']);
  const status = safePayloadStr(payload['toStatus']) ?? safePayloadStr(payload['status']);

  switch (item.type) {
    case NOTIFICATION_TYPES.TASK_ASSIGNED:
      if (taskTitle) {
        return t('notifications.types.taskAssigned', {
          taskTitle,
          defaultValue: 'You were assigned to task "{{taskTitle}}"',
        });
      }
      return t('notifications.types.taskAssignedNoTitle', {
        defaultValue: 'You were assigned to a task',
      });

    case NOTIFICATION_TYPES.TASK_STATUS_CHANGED:
      if (taskTitle && status) {
        return t('notifications.types.taskStatusChanged', {
          taskTitle,
          status,
          defaultValue: 'Task "{{taskTitle}}" moved to {{status}}',
        });
      }
      if (taskTitle) {
        return t('notifications.types.taskStatusChangedNoStatus', {
          taskTitle,
          defaultValue: 'Status updated on task "{{taskTitle}}"',
        });
      }
      if (status) {
        return t('notifications.types.taskStatusChangedNoTitle', {
          status,
          defaultValue: 'A task status changed to {{status}}',
        });
      }
      return t('notifications.types.taskStatusChangedGeneric', {
        defaultValue: 'A task status was updated',
      });

    case NOTIFICATION_TYPES.MESSAGE_CONVERTED_TO_TASK:
      if (taskTitle) {
        return t('notifications.types.messageConvertedToTask', {
          taskTitle,
          defaultValue: 'A project message was converted to task "{{taskTitle}}"',
        });
      }
      return t('notifications.types.messageConvertedToTaskNoTitle', {
        defaultValue: 'A project message was converted to a task',
      });

    case NOTIFICATION_TYPES.PROJECT_MEMBER_ADDED:
      if (projectName) {
        return t('notifications.types.projectMemberAdded', {
          projectName,
          defaultValue: 'You were added to project "{{projectName}}"',
        });
      }
      return t('notifications.types.projectMemberAddedNoName', {
        defaultValue: 'You were added to a project',
      });

    case NOTIFICATION_TYPES.WORK_LOG_REMINDER:
      return t('notifications.types.workLogReminder', {
        defaultValue: 'Reminder: please submit your daily work log',
      });

    default:
      return t('notifications.types.fallback', {
        defaultValue: 'You have a new notification',
      });
  }
}

const TASK_NOTIFICATION_TYPES = new Set<string>([
  NOTIFICATION_TYPES.TASK_ASSIGNED,
  NOTIFICATION_TYPES.TASK_STATUS_CHANGED,
  NOTIFICATION_TYPES.MESSAGE_CONVERTED_TO_TASK,
]);

const PROJECT_NOTIFICATION_TYPES = new Set<string>([
  NOTIFICATION_TYPES.PROJECT_MEMBER_ADDED,
]);

/**
 * Computes the navigation target for a notification item (Amendment C).
 * - Validates projectId, entityId, and payload.taskId as strict UUIDs before building a path.
 * - Reuses getTaskDetailPath from taskLinks.ts for task notifications.
 * - Returns null for invalid UUIDs, path traversal strings ("../"), or non-linkable types.
 */
export function notificationLink(
  item: NotificationItem,
  role?: string
): string | null {
  const payload = item.payload ?? {};
  const rawProjectId = item.projectId ?? payload['projectId'];
  const rawEntityId = item.entityId;
  const rawPayloadTaskId = payload['taskId'];

  // If a projectId value is provided at all, it must be a valid UUID
  if (
    rawProjectId !== undefined &&
    rawProjectId !== null &&
    !isValidUuid(rawProjectId)
  ) {
    return null;
  }

  // If an entityId value is provided at all, it must be a valid UUID
  if (
    rawEntityId !== undefined &&
    rawEntityId !== null &&
    !isValidUuid(rawEntityId)
  ) {
    return null;
  }

  // If payload.taskId is provided at all, it must be a valid UUID
  if (
    rawPayloadTaskId !== undefined &&
    rawPayloadTaskId !== null &&
    !isValidUuid(rawPayloadTaskId)
  ) {
    return null;
  }

  const projectId = isValidUuid(rawProjectId) ? rawProjectId : null;
  const entityId = isValidUuid(rawEntityId) ? rawEntityId : null;
  const payloadTaskId = isValidUuid(rawPayloadTaskId) ? rawPayloadTaskId : null;

  const isTaskType =
    TASK_NOTIFICATION_TYPES.has(item.type) ||
    item.entityType?.toLowerCase() === 'task';

  if (isTaskType) {
    const taskId = entityId ?? payloadTaskId;
    if (projectId && taskId) {
      return getTaskDetailPath(projectId, taskId, role);
    }
    return null;
  }

  const isProjectType =
    PROJECT_NOTIFICATION_TYPES.has(item.type) ||
    item.entityType?.toLowerCase() === 'project';

  if (isProjectType) {
    const resolvedProjectId = projectId ?? entityId;
    if (resolvedProjectId) {
      if (role === 'system_admin') {
        return `/admin/projects/${resolvedProjectId}`;
      }
      if (role) {
        return `/employee/projects/${resolvedProjectId}`;
      }
      return `/projects/${resolvedProjectId}`;
    }
    return null;
  }

  return null;
}

/**
 * Merges paginated notification lists while deduplicating by id and preserving order.
 */
export function mergeNotificationPages(
  existing: NotificationItem[],
  incoming: NotificationItem[]
): NotificationItem[] {
  const seen = new Set<string>();
  const merged: NotificationItem[] = [];

  for (const item of existing) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      merged.push(item);
    }
  }

  for (const item of incoming) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      merged.push(item);
    }
  }

  return merged;
}

/**
 * Pure coordinator for clicking a notification row (Amendment E):
 * - Attempts mark-read if unread.
 * - Navigates even if mark-read fails.
 * - Reports the mark-read error ONLY if the user stays on the page (no link).
 */
export async function executeNotificationRowClick(params: {
  item: NotificationItem;
  role?: string;
  markRead: (id: string) => Promise<unknown>;
  navigate: (to: string) => void;
  onMarkReadError?: (error: unknown) => void;
}): Promise<void> {
  const link = notificationLink(params.item, params.role);

  if (!params.item.readAt) {
    try {
      await params.markRead(params.item.id);
    } catch (err) {
      if (!link) {
        params.onMarkReadError?.(err);
      }
    }
  }

  if (link) {
    params.navigate(link);
  }
}

export interface ResolvedNotificationError {
  code: string;
  messageKey: string;
  defaultMessage: string;
  isNetworkError: boolean;
  status?: number;
}

/**
 * Resolves notification API and network errors into notification-specific i18n keys.
 * Reuses resolveWorkLogErrorInfo solely for classifying the failure (network/400/403/404/other).
 * Never exposes raw err.message or raw JSON.
 */
export function resolveNotificationError(
  error: unknown
): ResolvedNotificationError {
  const base = resolveWorkLogErrorInfo(error);

  if (base.isNetworkError) {
    return {
      code: 'network_error',
      messageKey: 'notifications.errors.network',
      defaultMessage:
        'Unable to connect to the server. Please check your connection and try again.',
      isNetworkError: true,
      status: base.status,
    };
  }

  if (base.status === 400) {
    return {
      code: 'validation_error',
      messageKey: 'notifications.errors.validation',
      defaultMessage: 'Invalid notification request parameters.',
      isNetworkError: false,
      status: 400,
    };
  }

  if (base.status === 403) {
    return {
      code: 'forbidden',
      messageKey: 'notifications.errors.forbidden',
      defaultMessage: 'You do not have permission to view these notifications.',
      isNetworkError: false,
      status: 403,
    };
  }

  if (base.status === 404) {
    return {
      code: 'not_found',
      messageKey: 'notifications.errors.notFound',
      defaultMessage: 'Notification could not be found.',
      isNetworkError: false,
      status: 404,
    };
  }

  return {
    code: base.code || 'unknown_error',
    messageKey: 'notifications.errors.generic',
    defaultMessage: 'Could not load notifications. Please try again.',
    isNetworkError: false,
    status: base.status,
  };
}
