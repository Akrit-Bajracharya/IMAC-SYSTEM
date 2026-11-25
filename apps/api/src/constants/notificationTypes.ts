/**
 * Canonical notification type strings for backend triggers and API routes (Step 17c).
 * Synchronized with apps/web/src/constants/notificationTypes.ts.
 */

export const NOTIFICATION_TYPES = {
  TASK_ASSIGNED: 'task.assigned',
  TASK_STATUS_CHANGED: 'task.status_changed',
  MESSAGE_CONVERTED_TO_TASK: 'message.converted_to_task',
  PROJECT_MEMBER_ADDED: 'project.member_added',
  WORK_LOG_REMINDER: 'work_log.reminder',
} as const;

export type KnownNotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export const ALL_NOTIFICATION_TYPES: readonly KnownNotificationType[] =
  Object.values(NOTIFICATION_TYPES);
