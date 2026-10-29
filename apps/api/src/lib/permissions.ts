import type { AuthUser } from '@imac/shared';

export type Action =
  | 'user:create'
  | 'user:read'
  | 'user:update'
  | 'user:deactivate'
  | 'user:reactivate'
  | 'user:resetPassword'
  | 'user:changeRole'
  | 'settings:read'
  | 'settings:update'
  | 'auditlog:read'
  | 'workrole:create'
  | 'workrole:read'
  | 'workrole:update'
  | 'workrole:deactivate'
  | 'workrole:assign'
  | 'workrole:remove'
  | 'workrole:readEmployee'
  | 'worklog:readOwn'
  | 'worklog:writeOwn'
  | 'worklog:adminOverride'
  | 'worklog:exportOwn'
  | 'worklog:exportAll'
  | 'project:create'
  | 'project:read'
  | 'project:update'
  | 'project:manageMembers'
  | 'project:changeStatus'
  | 'task:read'
  | 'task:write'
  | 'comment:write'
  | 'milestone:manage'
  | 'timeLog:read'
  | 'timeLog:write'
  | 'message:read'
  | 'message:create'
  | 'message:pin';

export function can(user: AuthUser, action: Action): boolean {
  const role = user.systemRole;

  switch (action) {
    case 'worklog:readOwn':
      return ['system_admin', 'hr_admin', 'project_manager', 'employee', 'viewer'].includes(role);

    case 'worklog:writeOwn':
      return ['system_admin', 'hr_admin', 'project_manager', 'employee'].includes(role);

    case 'worklog:adminOverride':
      return role === 'system_admin';

    case 'worklog:exportOwn':
      return ['system_admin', 'hr_admin', 'project_manager', 'employee'].includes(role);

    case 'worklog:exportAll':
      return role === 'system_admin';

    case 'project:create':
      return role === 'system_admin' || role === 'project_manager';

    case 'project:read':
    case 'task:read':
    case 'timeLog:read':
    case 'message:read':
      return ['system_admin', 'hr_admin', 'project_manager', 'employee', 'viewer'].includes(role);

    // Architectural Note:
    // 'employee', 'hr_admin', and 'project_manager' hold 'project:update', 'project:manageMembers',
    // 'project:changeStatus', 'task:write', 'comment:write', 'milestone:manage', and 'timeLog:write'
    // at the system role level only so that route guards can pass them to the route handlers,
    // where the actual project-level membership and role checks (isManager, canEditTask, comment
    // author checks, time log member write rights) are enforced.
    // 'viewer' is denied here at the system level. The handler is the real gate for mutating actions.
    case 'project:update':
    case 'project:manageMembers':
    case 'project:changeStatus':
    case 'task:write':
    case 'comment:write':
    case 'milestone:manage':
    case 'timeLog:write':
    case 'message:create':
    case 'message:pin':
      return ['system_admin', 'project_manager', 'employee', 'hr_admin'].includes(role);

    case 'user:create':
    case 'user:deactivate':
    case 'user:reactivate':
    case 'user:resetPassword':
    case 'user:changeRole':
    case 'settings:read':
    case 'settings:update':
    case 'auditlog:read':
    case 'workrole:create':
    case 'workrole:read':
    case 'workrole:update':
    case 'workrole:deactivate':
    case 'workrole:assign':
    case 'workrole:remove':
    case 'workrole:readEmployee':
      return role === 'system_admin';

    case 'user:read':
    case 'user:update':
      return role === 'system_admin' || role === 'hr_admin';

    default:
      return false;
  }
}
