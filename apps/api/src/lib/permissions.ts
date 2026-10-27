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
  | 'worklog:exportAll';

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
