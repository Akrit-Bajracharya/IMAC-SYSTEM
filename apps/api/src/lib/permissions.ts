import type { AuthUser } from '@imac/shared';

export type Action =
  | 'user:create'
  | 'user:read'
  | 'user:update'
  | 'user:deactivate'
  | 'user:resetPassword'
  | 'user:changeRole'
  | 'settings:read'
  | 'settings:update'
  | 'auditlog:read';

export function can(user: AuthUser, action: Action): boolean {
  const role = user.systemRole;

  switch (action) {
    case 'user:create':
    case 'user:deactivate':
    case 'user:resetPassword':
    case 'user:changeRole':
    case 'settings:read':
    case 'settings:update':
    case 'auditlog:read':
      return role === 'system_admin';

    case 'user:read':
    case 'user:update':
      return role === 'system_admin' || role === 'hr_admin';

    default:
      return false;
  }
}
