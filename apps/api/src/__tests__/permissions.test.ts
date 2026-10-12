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
  });

  describe('hr_admin role', () => {
    const hr = createUserWithRole('hr_admin');

    it('can read and update users', () => {
      expect(can(hr, 'user:read')).toBe(true);
      expect(can(hr, 'user:update')).toBe(true);
    });

    it('CANNOT create, deactivate, reset password, or change user role', () => {
      expect(can(hr, 'user:create')).toBe(false);
      expect(can(hr, 'user:deactivate')).toBe(false);
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
  });

  describe('project_manager role', () => {
    const pm = createUserWithRole('project_manager');

    it('CANNOT perform any user administration actions', () => {
      expect(can(pm, 'user:create')).toBe(false);
      expect(can(pm, 'user:read')).toBe(false);
      expect(can(pm, 'user:update')).toBe(false);
      expect(can(pm, 'user:deactivate')).toBe(false);
      expect(can(pm, 'user:resetPassword')).toBe(false);
      expect(can(pm, 'user:changeRole')).toBe(false);
    });

    it('CANNOT perform any settings or auditlog actions', () => {
      expect(can(pm, 'settings:read')).toBe(false);
      expect(can(pm, 'settings:update')).toBe(false);
      expect(can(pm, 'auditlog:read')).toBe(false);
    });
  });

  describe('employee role', () => {
    const employee = createUserWithRole('employee');

    it('CANNOT perform any administrative actions', () => {
      for (const action of allActions) {
        expect(can(employee, action), `employee should be denied action: ${action}`).toBe(false);
      }
    });
  });

  describe('viewer role', () => {
    const viewer = createUserWithRole('viewer');

    it('CANNOT perform any administrative actions', () => {
      for (const action of allActions) {
        expect(can(viewer, action), `viewer should be denied action: ${action}`).toBe(false);
      }
    });
  });

  describe('unrecognized action fallback', () => {
    const admin = createUserWithRole('system_admin');

    it('denies unrecognized actions', () => {
      expect(can(admin, 'unknown:action' as Action)).toBe(false);
    });
  });
});
