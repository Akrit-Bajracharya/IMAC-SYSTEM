// -- Constants for Audit Logs (Synced with apps/api/src/routes/auditLogs.ts)

export const PROJECT_ACTIONS = [
  'project.created',
  'project.updated',
  'project_member.added',
  'project_member.removed',
  'project.status_changed',
  'milestone.created',
  'milestone.updated',
  'milestone.completed',
  'milestone.reopened',
  'task.created',
  'task.updated',
  'task.assigned',
  'task.deleted',
  'task.status_changed',
  'task_dependency.added',
  'task_dependency.removed',
  'comment.created',
  'comment.edited',
  'comment.deleted',
  'project_message.pinned',
  'project_message.unpinned',
  'project_message.converted_to_task',
  'time_log.created',
  'time_log.updated',
] as const;

export const ADMIN_ONLY_ACTIONS = [
  'settings.updated',
  'user.created',
  'user.deactivated',
  'user.reactivated',
  'auth.password.reset',
  'user.role_changed',
  'auth.login.failed',
  'auth.login.locked',
  'auth.login.success',
  'auth.password.changed',
  'employee_profile.updated',
  'auth.logout',
  'work_role.created',
  'work_role.updated',
  'work_role.deactivated',
  'work_role.assigned',
  'work_role.removed',
  'work_log.admin_override',
  'work_log.exported',
  'work_log.edited_after_submit',
  'time_log.removed',
] as const;

export const ALL_KNOWN_ACTIONS = [
  ...PROJECT_ACTIONS,
  ...ADMIN_ONLY_ACTIONS,
] as const;

export const PROJECT_MAPPABLE_ENTITY_TYPES = [
  'project',
  'milestone',
  'task',
  'Task',
  'comment',
  'ProjectMessage',
  'time_log',
] as const;

export const ADMIN_ONLY_ENTITY_TYPES = [
  'SystemSetting',
  'User',
  'EmployeeProfile',
  'Session',
  'WorkRole',
  'EmployeeWorkRole',
  'WorkLogDay',
] as const;

export const ALL_KNOWN_ENTITY_TYPES = [
  ...PROJECT_MAPPABLE_ENTITY_TYPES,
  ...ADMIN_ONLY_ENTITY_TYPES,
] as const;

export type AuditLogAction = (typeof ALL_KNOWN_ACTIONS)[number];
export type AuditLogEntityType = (typeof ALL_KNOWN_ENTITY_TYPES)[number];
