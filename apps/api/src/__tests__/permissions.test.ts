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

  const allActions: Action[] = [
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

    it('can perform all actions', () => {
      for (const action of allActions) {
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
  });

  describe('employee role', () => {
    const employee = createUserWithRole('employee');

    it('CANNOT perform any administrative actions', () => {
      for (const action of allActions) {
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
  });

  describe('viewer role', () => {
    const viewer = createUserWithRole('viewer');

    it('CANNOT perform any administrative actions', () => {
      for (const action of allActions) {
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
  });

  describe('unrecognized action fallback', () => {
    const admin = createUserWithRole('system_admin');

    it('denies unrecognized actions', () => {
      expect(can(admin, 'unknown:action' as Action)).toBe(false);
    });
  });
});
