import { describe, it, expect } from 'vitest';
import { can, type Action } from '../lib/permissions.js';
import type { AuthUser, SystemRole } from '@imac/shared';

describe('Permissions - can() policy matrix', () => {
  const createUserWithRole = (role: SystemRole): AuthUser => ({
    id: 'user-id',
    username: 'testuser',
    displayName: 'Test User',
    systemRole: role,
    mustChangePassword: false,
  });

  const allAdminActions: Action[] = [
    'user:create',
    'user:read',
    'user:update',
    'user:deactivate',
    'user:reactivate',
    'user:resetPassword',
    'user:changeRole',
    'settings:read',
    'settings:update',
    'auditlog:read',
  ];

  describe('system_admin role', () => {
    const admin = createUserWithRole('system_admin');

    it('can perform all administrative actions', () => {
      for (const action of allAdminActions) {
        expect(can(admin, action), `system_admin should be permitted action: ${action}`).toBe(true);
      }
    });

    it('can reactivate users (user:reactivate)', () => {
      expect(can(admin, 'user:reactivate')).toBe(true);
    });

    it('can manage own work logs and perform admin override', () => {
      expect(can(admin, 'worklog:readOwn')).toBe(true);
      expect(can(admin, 'worklog:writeOwn')).toBe(true);
      expect(can(admin, 'worklog:adminOverride')).toBe(true);
    });

    it('can export own logs and export organisation-wide', () => {
      expect(can(admin, 'worklog:exportOwn')).toBe(true);
      expect(can(admin, 'worklog:exportAll')).toBe(true);
    });

    it('can perform all project and task actions', () => {
      expect(can(admin, 'project:create')).toBe(true);
      expect(can(admin, 'project:read')).toBe(true);
      expect(can(admin, 'project:update')).toBe(true);
      expect(can(admin, 'project:manageMembers')).toBe(true);
      expect(can(admin, 'project:changeStatus')).toBe(true);
      expect(can(admin, 'task:read')).toBe(true);
      expect(can(admin, 'task:write')).toBe(true);
      expect(can(admin, 'comment:write')).toBe(true);
      expect(can(admin, 'milestone:manage')).toBe(true);
    });
  });

  describe('hr_admin role', () => {
    const hr = createUserWithRole('hr_admin');

    it('can read and update users', () => {
      expect(can(hr, 'user:read')).toBe(true);
      expect(can(hr, 'user:update')).toBe(true);
    });

    it('CANNOT create, deactivate, reactivate, reset password, or change user role', () => {
      expect(can(hr, 'user:create')).toBe(false);
      expect(can(hr, 'user:deactivate')).toBe(false);
      expect(can(hr, 'user:reactivate')).toBe(false);
      expect(can(hr, 'user:resetPassword')).toBe(false);
      expect(can(hr, 'user:changeRole')).toBe(false);
    });

    it('CANNOT read or update settings', () => {
      expect(can(hr, 'settings:read')).toBe(false);
      expect(can(hr, 'settings:update')).toBe(false);
    });

    it('CANNOT read audit logs', () => {
      expect(can(hr, 'auditlog:read')).toBe(false);
    });

    it('can read and write own work logs, but CANNOT perform admin override', () => {
      expect(can(hr, 'worklog:readOwn')).toBe(true);
      expect(can(hr, 'worklog:writeOwn')).toBe(true);
      expect(can(hr, 'worklog:adminOverride')).toBe(false);
    });

    it('can export own logs, but CANNOT export organisation-wide', () => {
      expect(can(hr, 'worklog:exportOwn')).toBe(true);
      expect(can(hr, 'worklog:exportAll')).toBe(false);
    });

    it('can read projects/tasks and pass route guards for project/task mutations (handler is manager gate), but CANNOT create projects', () => {
      expect(can(hr, 'project:create')).toBe(false);
      expect(can(hr, 'project:read')).toBe(true);
      expect(can(hr, 'project:update')).toBe(true);
      expect(can(hr, 'project:manageMembers')).toBe(true);
      expect(can(hr, 'project:changeStatus')).toBe(true);
      expect(can(hr, 'task:read')).toBe(true);
      expect(can(hr, 'task:write')).toBe(true);
      expect(can(hr, 'comment:write')).toBe(true);
      expect(can(hr, 'milestone:manage')).toBe(true);
    });
  });

  describe('project_manager role', () => {
    const pm = createUserWithRole('project_manager');

    it('CANNOT perform any user administration actions', () => {
      expect(can(pm, 'user:create')).toBe(false);
      expect(can(pm, 'user:read')).toBe(false);
      expect(can(pm, 'user:update')).toBe(false);
      expect(can(pm, 'user:deactivate')).toBe(false);
      expect(can(pm, 'user:reactivate')).toBe(false);
      expect(can(pm, 'user:resetPassword')).toBe(false);
      expect(can(pm, 'user:changeRole')).toBe(false);
    });

    it('CANNOT perform any settings or auditlog actions', () => {
      expect(can(pm, 'settings:read')).toBe(false);
      expect(can(pm, 'settings:update')).toBe(false);
      expect(can(pm, 'auditlog:read')).toBe(false);
    });

    it('can read and write own work logs, but CANNOT perform admin override', () => {
      expect(can(pm, 'worklog:readOwn')).toBe(true);
      expect(can(pm, 'worklog:writeOwn')).toBe(true);
      expect(can(pm, 'worklog:adminOverride')).toBe(false);
    });

    it('can export own logs, but CANNOT export organisation-wide', () => {
      expect(can(pm, 'worklog:exportOwn')).toBe(true);
      expect(can(pm, 'worklog:exportAll')).toBe(false);
    });

    it('can create projects and perform all project management & task actions', () => {
      expect(can(pm, 'project:create')).toBe(true);
      expect(can(pm, 'project:read')).toBe(true);
      expect(can(pm, 'project:update')).toBe(true);
      expect(can(pm, 'project:manageMembers')).toBe(true);
      expect(can(pm, 'project:changeStatus')).toBe(true);
      expect(can(pm, 'task:read')).toBe(true);
      expect(can(pm, 'task:write')).toBe(true);
      expect(can(pm, 'comment:write')).toBe(true);
      expect(can(pm, 'milestone:manage')).toBe(true);
    });
  });

  describe('employee role', () => {
    const employee = createUserWithRole('employee');

    it('CANNOT perform any administrative actions', () => {
      for (const action of allAdminActions) {
        expect(can(employee, action), `employee should be denied action: ${action}`).toBe(false);
      }
    });

    it('can read and write own work logs, but CANNOT perform admin override', () => {
      expect(can(employee, 'worklog:readOwn')).toBe(true);
      expect(can(employee, 'worklog:writeOwn')).toBe(true);
      expect(can(employee, 'worklog:adminOverride')).toBe(false);
    });

    it('can export own logs, but CANNOT export organisation-wide', () => {
      expect(can(employee, 'worklog:exportOwn')).toBe(true);
      expect(can(employee, 'worklog:exportAll')).toBe(false);
    });

    it('CANNOT create projects, but holds project & task mutating actions so handler can enforce projectRole', () => {
      expect(can(employee, 'project:create')).toBe(false);
      expect(can(employee, 'project:read')).toBe(true);
      expect(can(employee, 'project:update')).toBe(true);
      expect(can(employee, 'project:manageMembers')).toBe(true);
      expect(can(employee, 'project:changeStatus')).toBe(true);
      expect(can(employee, 'task:read')).toBe(true);
      expect(can(employee, 'task:write')).toBe(true);
      expect(can(employee, 'comment:write')).toBe(true);
      expect(can(employee, 'milestone:manage')).toBe(true);
    });
  });

  describe('viewer role', () => {
    const viewer = createUserWithRole('viewer');

    it('CANNOT perform any administrative actions', () => {
      for (const action of allAdminActions) {
        expect(can(viewer, action), `viewer should be denied action: ${action}`).toBe(false);
      }
    });

    it('can read own work logs, but CANNOT write own logs and CANNOT override', () => {
      expect(can(viewer, 'worklog:readOwn')).toBe(true);
      expect(can(viewer, 'worklog:writeOwn')).toBe(false);
      expect(can(viewer, 'worklog:adminOverride')).toBe(false);
    });

    it('CANNOT export own logs and CANNOT export organisation-wide', () => {
      expect(can(viewer, 'worklog:exportOwn')).toBe(false);
      expect(can(viewer, 'worklog:exportAll')).toBe(false);
    });

    it('can read projects & tasks, but CANNOT create, update, manage members, write tasks, comment, or manage milestones (viewer cannot write)', () => {
      expect(can(viewer, 'project:read')).toBe(true);
      expect(can(viewer, 'project:create')).toBe(false);
      expect(can(viewer, 'project:update')).toBe(false);
      expect(can(viewer, 'project:manageMembers')).toBe(false);
      expect(can(viewer, 'project:changeStatus')).toBe(false);
      expect(can(viewer, 'task:read')).toBe(true);
      expect(can(viewer, 'task:write')).toBe(false);
      expect(can(viewer, 'comment:write')).toBe(false);
      expect(can(viewer, 'milestone:manage')).toBe(false);
    });
  });

  describe('time log permissions across all 5 system roles (Step 10d)', () => {
    it('allows timeLog:read for all 5 roles', () => {
      for (const role of ['system_admin', 'hr_admin', 'project_manager', 'employee', 'viewer'] as const) {
        const u = createUserWithRole(role);
        expect(can(u, 'timeLog:read'), `${role} should have timeLog:read`).toBe(true);
      }
    });

    it('allows timeLog:write for system_admin, project_manager, hr_admin, employee, but DENIES viewer', () => {
      for (const role of ['system_admin', 'project_manager', 'hr_admin', 'employee'] as const) {
        const u = createUserWithRole(role);
        expect(can(u, 'timeLog:write'), `${role} should have timeLog:write`).toBe(true);
      }
      const v = createUserWithRole('viewer');
      expect(can(v, 'timeLog:write'), 'viewer must NOT have timeLog:write').toBe(false);
    });
  });

  describe('project message permissions across all 5 system roles (Step 10e)', () => {
    it('allows message:read for all 5 roles', () => {
      for (const role of ['system_admin', 'hr_admin', 'project_manager', 'employee', 'viewer'] as const) {
        const u = createUserWithRole(role);
        expect(can(u, 'message:read'), `${role} should have message:read`).toBe(true);
      }
    });

    it('allows message:create for system_admin, project_manager, hr_admin, employee, but DENIES viewer', () => {
      for (const role of ['system_admin', 'project_manager', 'hr_admin', 'employee'] as const) {
        const u = createUserWithRole(role);
        expect(can(u, 'message:create'), `${role} should have message:create`).toBe(true);
      }
      const v = createUserWithRole('viewer');
      expect(can(v, 'message:create'), 'viewer must NOT have message:create').toBe(false);
    });

    it('allows message:pin for system_admin, project_manager, hr_admin, employee, but DENIES viewer', () => {
      for (const role of ['system_admin', 'project_manager', 'hr_admin', 'employee'] as const) {
        const u = createUserWithRole(role);
        expect(can(u, 'message:pin'), `${role} should have message:pin`).toBe(true);
      }
      const v = createUserWithRole('viewer');
      expect(can(v, 'message:pin'), 'viewer must NOT have message:pin').toBe(false);
    });
  });

  describe('unrecognized action fallback', () => {
    const admin = createUserWithRole('system_admin');

    it('denies unrecognized actions', () => {
      expect(can(admin, 'unknown:action' as Action)).toBe(false);
    });
  });
});
