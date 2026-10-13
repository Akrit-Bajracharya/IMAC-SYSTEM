import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';
import { createApp } from '../app.js';
import { db } from '../db.js';
import * as passwordService from '../services/password.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { logger } from '../logger.js';

// Mock password service to avoid slow Argon2 hashing in tests
vi.mock('../services/password.js', () => ({
  verifyPassword: vi.fn(),
  hashPassword: vi.fn().mockResolvedValue('hashed_test_password'),
  generateTempPassword: vi.fn().mockReturnValue('temp-password-12345'),
  getDummyHash: vi.fn().mockResolvedValue('dummy-argon2-hash-for-timing'),
}));

// Mock logger to verify error logging
vi.mock('../logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
  },
}));

describe('Security & Vulnerability Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockAdminUser = {
    id: 'admin-uuid-1',
    username: 'boss',
    displayName: 'Boss Admin',
    passwordHash: 'hashed_password',
    systemRole: 'system_admin',
    isActive: true,
    mustChangePassword: false,
    failedLoginCount: 0,
    lockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockEmployeeUser = {
    id: 'employee-uuid-2',
    username: 'john_doe',
    displayName: 'John Doe',
    passwordHash: 'hashed_password',
    systemRole: 'employee',
    isActive: true,
    mustChangePassword: false,
    failedLoginCount: 0,
    lockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockHrUser = {
    id: 'hr-uuid-3',
    username: 'hr_manager',
    displayName: 'HR Manager',
    passwordHash: 'hashed_password',
    systemRole: 'hr_admin',
    isActive: true,
    mustChangePassword: false,
    failedLoginCount: 0,
    lockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockViewerUser = {
    id: 'viewer-uuid-4',
    username: 'auditor',
    displayName: 'Auditor Viewer',
    passwordHash: 'hashed_password',
    systemRole: 'viewer',
    isActive: true,
    mustChangePassword: false,
    failedLoginCount: 0,
    lockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAdminSession = {
    id: 'admin-session-id',
    userId: mockAdminUser.id,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    lastActiveAt: new Date(),
    user: mockAdminUser,
  };

  const mockEmployeeSession = {
    id: 'employee-session-id',
    userId: mockEmployeeUser.id,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    lastActiveAt: new Date(),
    user: mockEmployeeUser,
  };

  const mockHrSession = {
    id: 'hr-session-id',
    userId: mockHrUser.id,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    lastActiveAt: new Date(),
    user: mockHrUser,
  };

  /* -------------------------------------------------------------------------- */
  /* 1. Session Fixation & Session Management                                  */
  /* -------------------------------------------------------------------------- */
  describe('1. Session Fixation & Session Management', () => {
    it('generates a fresh session ID on login and overwrites pre-existing session cookies', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.user.findFirst).mockResolvedValue(mockAdminUser as any);
      vi.mocked(passwordService.verifyPassword).mockResolvedValue(true);
      vi.mocked(db.user.update).mockResolvedValue(mockAdminUser as any);
      vi.mocked(db.session.create).mockResolvedValue({ id: 'brand-new-session-id' } as any);

      // Attacker pre-supplies an attacker-controlled cookie
      const res = await request(app)
        .post('/api/auth/login')
        .set('Cookie', ['IMAC_SESSION=attacker-fixed-session-id'])
        .send({ username: 'boss', password: 'correct_password' });

      expect(res.status).toBe(200);
      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
      // Must issue a fresh 64-char nanoid session token and NOT keep attacker-fixed-session-id
      expect(cookieStr).toMatch(/^IMAC_SESSION=[A-Za-z0-9_-]{64};/);
      expect(cookieStr).not.toContain('attacker-fixed-session-id');
    });

    it('security policy status (SEC-07): login preserves concurrent session policy as documented in open questions', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.user.findFirst).mockResolvedValue(mockAdminUser as any);
      vi.mocked(passwordService.verifyPassword).mockResolvedValue(true);
      vi.mocked(db.user.update).mockResolvedValue(mockAdminUser as any);
      vi.mocked(db.session.create).mockResolvedValue({ id: 'new-session-id' } as any);

      await request(app)
        .post('/api/auth/login')
        .set('Cookie', ['IMAC_SESSION=existing-prior-session-id'])
        .send({ username: 'boss', password: 'correct_password' });

      // Verifies documented policy: db.session.delete is not called upon login
      // until multi-session vs single-session policy decision is confirmed by IMAC.
      expect(db.session.delete).not.toHaveBeenCalled();
      expect(db.session.deleteMany).not.toHaveBeenCalled();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 2. Cookie Flags & Attributes                                               */
  /* -------------------------------------------------------------------------- */
  describe('2. Cookie Flags & Attributes', () => {
    it('sets HttpOnly, Path=/, and SameSite=Strict on session cookies', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.user.findFirst).mockResolvedValue(mockAdminUser as any);
      vi.mocked(passwordService.verifyPassword).mockResolvedValue(true);
      vi.mocked(db.user.update).mockResolvedValue(mockAdminUser as any);
      vi.mocked(db.session.create).mockResolvedValue({ id: 'test-session-id' } as any);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'boss', password: 'correct_password' });

      expect(res.status).toBe(200);
      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;

      expect(cookieStr).toMatch(/HttpOnly/i);
      expect(cookieStr).toMatch(/SameSite=Strict/i);
      expect(cookieStr).toMatch(/Path=\//i);
    });

    it('SEC-08: Secure flag is omitted in non-production development by default', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.user.findFirst).mockResolvedValue(mockAdminUser as any);
      vi.mocked(passwordService.verifyPassword).mockResolvedValue(true);
      vi.mocked(db.user.update).mockResolvedValue(mockAdminUser as any);
      vi.mocked(db.session.create).mockResolvedValue({ id: 'test-session-id' } as any);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'boss', password: 'correct_password' });

      const setCookie = res.headers['set-cookie'];
      const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
      // In default test/dev, Secure is false so HTTP dev environments work
      expect(cookieStr).not.toMatch(/;\s*Secure/i);
    });

    it('SEC-08: Secure flag is enforced when NODE_ENV=production or SESSION_COOKIE_SECURE=true', async () => {
      const originalEnv = process.env['SESSION_COOKIE_SECURE'];
      process.env['SESSION_COOKIE_SECURE'] = 'true';

      try {
        const app = createApp({ csrfDisabled: true });
        vi.mocked(db.user.findFirst).mockResolvedValue(mockAdminUser as any);
        vi.mocked(passwordService.verifyPassword).mockResolvedValue(true);
        vi.mocked(db.user.update).mockResolvedValue(mockAdminUser as any);
        vi.mocked(db.session.create).mockResolvedValue({ id: 'secure-session-id' } as any);

        const res = await request(app)
          .post('/api/auth/login')
          .send({ username: 'boss', password: 'correct_password' });

        const setCookie = res.headers['set-cookie'];
        expect(setCookie).toBeDefined();
        const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
        expect(cookieStr).toMatch(/;\s*Secure/i);
      } finally {
        if (originalEnv === undefined) {
          delete process.env['SESSION_COOKIE_SECURE'];
        } else {
          process.env['SESSION_COOKIE_SECURE'] = originalEnv;
        }
      }
    });

    it('CSRF cookie includes HttpOnly, SameSite=Strict, and Path=/ attributes', async () => {
      const app = createApp({ csrfDisabled: true });
      const res = await request(app).get('/api/auth/csrf');

      expect(res.status).toBe(200);
      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
      expect(cookieStr).toMatch(/x-csrf-token=/);
      expect(cookieStr).toMatch(/HttpOnly/i);
      expect(cookieStr).toMatch(/SameSite=Strict/i);
      expect(cookieStr).toMatch(/Path=\//i);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 3. Brute-Force & Lockout Bypass Attempts                                   */
  /* -------------------------------------------------------------------------- */
  describe('3. Brute-Force & Lockout Bypass Attempts', () => {
    it('enforces lockout threshold after 5 consecutive failed attempts', async () => {
      const app = createApp({ csrfDisabled: true });
      const userState = { ...mockAdminUser, failedLoginCount: 4 };
      vi.mocked(db.user.findFirst).mockResolvedValue(userState as any);
      vi.mocked(passwordService.verifyPassword).mockResolvedValue(false);
      vi.mocked(db.user.update).mockResolvedValue(userState as any);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'boss', password: 'wrong_password_5' });

      expect(res.status).toBe(401);
      expect(db.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockAdminUser.id },
          data: expect.objectContaining({
            failedLoginCount: 0,
            lockedUntil: expect.any(Date),
          }),
        }),
      );
    });

    it('blocks login during active lockout window with HTTP 423', async () => {
      const app = createApp({ csrfDisabled: true });
      const lockedUser = {
        ...mockAdminUser,
        lockedUntil: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes in future
      };
      vi.mocked(db.user.findFirst).mockResolvedValue(lockedUser as any);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'boss', password: 'any_password' });

      expect(res.status).toBe(423);
      expect(res.body.error).toBe('account_locked');
      // Must not check password when locked
      expect(passwordService.verifyPassword).not.toHaveBeenCalled();
    });

    it('case-insensitivity prevents username case-variation lockout bypass', async () => {
      const app = createApp({ csrfDisabled: true });
      const lockedUser = {
        ...mockAdminUser,
        lockedUntil: new Date(Date.now() + 10 * 60 * 1000),
      };
      (vi.mocked(db.user.findFirst) as any).mockImplementation(async ({ where }: any) => {
        if (where.username.equals.toLowerCase() === 'boss') {
          return lockedUser as any;
        }
        return null;
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'BoSs', password: 'any_password' });

      expect(res.status).toBe(423);
      expect(res.body.error).toBe('account_locked');
    });

    it('SEC-09: trailing and leading whitespace in username is trimmed and correctly matches user', async () => {
      const app = createApp({ csrfDisabled: true });
      (vi.mocked(db.user.findFirst) as any).mockImplementation(async ({ where }: any) => {
        if (where.username.equals === 'boss') {
          return mockAdminUser as any;
        }
        return null;
      });
      vi.mocked(passwordService.verifyPassword).mockResolvedValue(false);
      vi.mocked(db.user.update).mockResolvedValue(mockAdminUser as any);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: '  boss  ', password: 'wrong_password' });

      // Sanitized whitespace successfully matches the user and increments lockout count
      expect(res.status).toBe(401);
      expect(db.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockAdminUser.id },
          data: { failedLoginCount: 1 },
        }),
      );
    });

    it('SEC-05: password verification runs dummy hash check when username does not exist', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.user.findFirst).mockResolvedValue(null);
      vi.mocked(passwordService.verifyPassword).mockResolvedValue(false);

      const resInvalid = await request(app)
        .post('/api/auth/login')
        .send({ username: 'nonexistent_user', password: 'any_password' });

      expect(resInvalid.status).toBe(401);
      // Dummy hash is verified to prevent timing differences
      expect(passwordService.getDummyHash).toHaveBeenCalled();
      expect(passwordService.verifyPassword).toHaveBeenCalledWith('dummy-argon2-hash-for-timing', 'any_password');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 4. CSRF Protection & Surface Audit                                         */
  /* -------------------------------------------------------------------------- */
  describe('4. CSRF Protection & Route Coverage', () => {
    it('SEC-01 & SEC-04: administrative routes (/api/admin/*) enforce CSRF and return 403 when token is missing', async () => {
      // createApp with csrfEnabled: true
      const app = createApp({ csrfEnabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockAdminSession as any);

      // Call state-changing admin endpoint WITHOUT any CSRF token header or cookie
      const res = await request(app)
        .patch('/api/admin/users/employee-uuid-2/deactivate')
        .set('Cookie', [`IMAC_SESSION=${mockAdminSession.id}`]);

      // Safe behaviour: 403 Forbidden with csrf_invalid
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('csrf_invalid');
    });

    it('SEC-01 & SEC-04: settings admin route (/api/admin/settings) enforces CSRF and returns 403', async () => {
      const app = createApp({ csrfEnabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockAdminSession as any);

      const res = await request(app)
        .patch('/api/admin/settings/auth.lockoutThreshold')
        .set('Cookie', [`IMAC_SESSION=${mockAdminSession.id}`])
        .send({ value: '10' });

      // Safe behaviour: 403 Forbidden with csrf_invalid
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('csrf_invalid');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 5. Privilege Escalation (Employees & HR Admins calling Admin Endpoints)    */
  /* -------------------------------------------------------------------------- */
  describe('5. Privilege Escalation Prevention', () => {
    const adminEndpoints = [
      { method: 'post', path: '/api/admin/users', body: { username: 'evil', displayName: 'Evil', systemRole: 'employee' } },
      { method: 'get', path: '/api/admin/users', body: null },
      { method: 'get', path: '/api/admin/users/target-uuid', body: null },
      { method: 'patch', path: '/api/admin/users/target-uuid/deactivate', body: null },
      { method: 'post', path: '/api/admin/users/target-uuid/reset-password', body: null },
      { method: 'patch', path: '/api/admin/users/target-uuid/role', body: { systemRole: 'system_admin' } },
      { method: 'get', path: '/api/admin/settings', body: null },
      { method: 'patch', path: '/api/admin/settings/auth.lockoutThreshold', body: { value: '99' } },
    ];

    adminEndpoints.forEach(({ method, path, body }) => {
      it(`blocks regular employee from ${method.toUpperCase()} ${path} with 403 Forbidden`, async () => {
        const app = createApp({ csrfDisabled: true });
        vi.mocked(db.session.findUnique).mockResolvedValue(mockEmployeeSession as any);
        vi.mocked(db.session.update).mockResolvedValue(mockEmployeeSession as any);

        const req = (request(app) as any)[method](path)
          .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`]);

        if (body) req.send(body);
        const res = await req;

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('forbidden');
      });
    });

    adminEndpoints.forEach(({ method, path, body }) => {
      it(`blocks viewer from ${method.toUpperCase()} ${path} with 403 Forbidden`, async () => {
        const app = createApp({ csrfDisabled: true });
        const mockViewerSession = {
          id: 'viewer-session-id',
          userId: mockViewerUser.id,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          lastActiveAt: new Date(),
          user: mockViewerUser,
        };
        vi.mocked(db.session.findUnique).mockResolvedValue(mockViewerSession as any);
        vi.mocked(db.session.update).mockResolvedValue(mockViewerSession as any);

        const req = (request(app) as any)[method](path)
          .set('Cookie', [`IMAC_SESSION=${mockViewerSession.id}`]);

        if (body) req.send(body);
        const res = await req;

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('forbidden');
      });
    });

    const hrBlockedEndpoints = [
      { method: 'post', path: '/api/admin/users', body: { username: 'new_user', displayName: 'New User', systemRole: 'employee' } },
      { method: 'patch', path: '/api/admin/users/target-uuid/deactivate', body: null },
      { method: 'post', path: '/api/admin/users/target-uuid/reset-password', body: null },
      { method: 'patch', path: '/api/admin/users/target-uuid/role', body: { systemRole: 'system_admin' } },
      { method: 'get', path: '/api/admin/settings', body: null },
      { method: 'patch', path: '/api/admin/settings/auth.lockoutThreshold', body: { value: '99' } },
    ];

    hrBlockedEndpoints.forEach(({ method, path, body }) => {
      it(`blocks hr_admin from system_admin-only ${method.toUpperCase()} ${path} with 403 Forbidden`, async () => {
        const app = createApp({ csrfDisabled: true });
        vi.mocked(db.session.findUnique).mockResolvedValue(mockHrSession as any);
        vi.mocked(db.session.update).mockResolvedValue(mockHrSession as any);

        const req = (request(app) as any)[method](path)
          .set('Cookie', [`IMAC_SESSION=${mockHrSession.id}`]);

        if (body) req.send(body);
        const res = await req;

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('forbidden');
      });
    });

    it('allows hr_admin to read user records (user:read)', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockHrSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockHrSession as any);
      vi.mocked(db.user.findMany).mockResolvedValue([mockEmployeeUser as any]);

      const res = await request(app)
        .get('/api/admin/users')
        .set('Cookie', [`IMAC_SESSION=${mockHrSession.id}`]);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 6. Insecure Direct Object Reference (IDOR) Attempts                        */
  /* -------------------------------------------------------------------------- */
  describe('6. Insecure Direct Object Reference (IDOR) Attempts', () => {
    it('prevents an employee from reading another user by substituting UUID in /api/admin/users/:id', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockEmployeeSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockEmployeeSession as any);

      // Attempt to inspect admin record by targeting admin UUID
      const res = await request(app)
        .get(`/api/admin/users/${mockAdminUser.id}`)
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`]);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('forbidden');
      expect(db.user.findUnique).not.toHaveBeenCalled();
    });

    it('prevents an employee from deactivating another user via parameter substitution', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockEmployeeSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockEmployeeSession as any);

      const res = await request(app)
        .patch(`/api/admin/users/${mockAdminUser.id}/deactivate`)
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`]);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('forbidden');
    });

    it('GET /api/auth/me binds strictly to authenticated session user without URL ID parameter', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockEmployeeSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockEmployeeSession as any);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`]);

      expect(res.status).toBe(200);
      // Returns exclusively the caller's session identity
      expect(res.body.user.id).toBe(mockEmployeeUser.id);
      expect(res.body.user.username).toBe(mockEmployeeUser.username);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 7. Deactivated-User Session Reuse & Revocation                             */
  /* -------------------------------------------------------------------------- */
  describe('7. Deactivated-User Session Reuse & Revocation', () => {
    it('rejects login attempt by deactivated user with HTTP 401', async () => {
      const app = createApp({ csrfDisabled: true });
      const deactivatedUser = { ...mockEmployeeUser, isActive: false };
      vi.mocked(db.user.findFirst).mockResolvedValue(deactivatedUser as any);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'john_doe', password: 'password' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('invalid_credentials');
      expect(passwordService.getDummyHash).toHaveBeenCalled();
    });

    it('immediately rejects existing session when user becomes deactivated and clears cookie', async () => {
      const app = createApp({ csrfDisabled: true });
      const deactivatedUser = { ...mockEmployeeUser, isActive: false };
      const sessionWithDeactivatedUser = {
        ...mockEmployeeSession,
        user: deactivatedUser,
      };

      vi.mocked(db.session.findUnique).mockResolvedValue(sessionWithDeactivatedUser as any);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`]);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('unauthenticated');
      // Cookie must be cleared in response
      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
      expect(cookieStr).toMatch(/IMAC_SESSION=;/);
    });

    it('deactivating a user revokes all active sessions for that user', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.user.findUnique).mockResolvedValue(mockEmployeeUser as any);
      vi.mocked(db.user.update).mockResolvedValue({ ...mockEmployeeUser, isActive: false } as any);
      vi.mocked(db.session.deleteMany).mockResolvedValue({ count: 2 });

      const res = await request(app)
        .patch(`/api/admin/users/${mockEmployeeUser.id}/deactivate`)
        .set('Cookie', [`IMAC_SESSION=${mockAdminSession.id}`]);

      expect(res.status).toBe(200);
      expect(db.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockEmployeeUser.id },
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 8. Password-Reset Abuse                                                    */
  /* -------------------------------------------------------------------------- */
  describe('8. Password-Reset Abuse', () => {
    it('blocks non-admin from resetting user passwords with 403 Forbidden', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockEmployeeSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockEmployeeSession as any);

      const res = await request(app)
        .post(`/api/admin/users/${mockAdminUser.id}/reset-password`)
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`]);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('forbidden');
    });

    it('returns 404 Not Found when resetting password of non-existent user', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.user.findUnique).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/admin/users/non-existent-uuid/reset-password')
        .set('Cookie', [`IMAC_SESSION=${mockAdminSession.id}`]);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
    });

    it('password reset invalidates all active sessions, sets mustChangePassword, and sets Cache-Control: no-store (SEC-10)', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.user.findUnique).mockResolvedValue(mockEmployeeUser as any);
      vi.mocked(db.user.update).mockResolvedValue({ ...mockEmployeeUser, mustChangePassword: true } as any);
      vi.mocked(db.session.deleteMany).mockResolvedValue({ count: 1 });

      const res = await request(app)
        .post(`/api/admin/users/${mockEmployeeUser.id}/reset-password`)
        .set('Cookie', [`IMAC_SESSION=${mockAdminSession.id}`]);

      expect(res.status).toBe(200);
      expect(res.body.temporaryPassword).toBe('temp-password-12345');
      // SEC-10: Cache-Control: no-store header prevents proxy/browser caching
      expect(res.headers['cache-control']).toBe('no-store');
      expect(db.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockEmployeeUser.id },
          data: expect.objectContaining({ mustChangePassword: true }),
        }),
      );
      expect(db.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockEmployeeUser.id },
      });
    });

    it('SEC-06: blocks admin from resetting their own password via admin reset endpoint', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockAdminSession as any);

      // Admin targets their own ID: /api/admin/users/:adminId/reset-password
      const res = await request(app)
        .post(`/api/admin/users/${mockAdminUser.id}/reset-password`)
        .set('Cookie', [`IMAC_SESSION=${mockAdminSession.id}`]);

      // Safe behaviour: 400 invalid_action
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_action');
      expect(res.body.message).toContain('change-password');
    });

    it('SEC-10: user creation endpoint returns Cache-Control: no-store when temporary password is issued', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.user.findUnique).mockResolvedValue(null);
      vi.mocked(db.user.create).mockResolvedValue({
        id: 'new-user-uuid',
        username: 'new_hire',
        displayName: 'New Hire',
        systemRole: 'employee',
        isActive: true,
        mustChangePassword: true,
      } as any);

      const res = await request(app)
        .post('/api/admin/users')
        .set('Cookie', [`IMAC_SESSION=${mockAdminSession.id}`])
        .send({ username: 'new_hire', displayName: 'New Hire', systemRole: 'employee' });

      expect(res.status).toBe(201);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body.temporaryPassword).toBeDefined();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 9. Async Unhandled Errors & Process Resilience                             */
  /* -------------------------------------------------------------------------- */
  describe('9. Async Unhandled Errors & Server Resilience', () => {
    it('errorHandler middleware logs error and returns HTTP 500 without crashing', async () => {
      const mockReq = {} as Request;
      const mockJson = vi.fn();
      const mockStatus = vi.fn().mockReturnValue({ json: mockJson });
      const mockRes = {
        headersSent: false,
        status: mockStatus,
      } as unknown as Response;
      const mockNext = vi.fn() as NextFunction;

      const testError = new Error('Database connection pool exhausted: DB down');
      errorHandler(testError, mockReq, mockRes, mockNext);

      expect(logger.error).toHaveBeenCalledWith({ err: testError }, 'Unhandled error');
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'internal_error',
        message: 'An internal error occurred',
      });
    });

    it('errors forwarded to next(err) in middleware return HTTP 500 and structured error response', async () => {
      const testApp = express();
      testApp.use((_req, _res, next) => {
        next(new Error('Simulated middleware failure: DB down'));
      });
      testApp.use(errorHandler);

      const res = await request(testApp).get('/any-route');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        error: 'internal_error',
        message: 'An internal error occurred',
      });
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        'Unhandled error',
      );
    });

    it('SEC-02: unhandled async DB error in route returns HTTP 500 cleanly via asyncHandler', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.user.findFirst).mockRejectedValue(new Error('Connection terminated: DB down'));

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'boss', password: 'password' });

      // Safe behaviour: asyncHandler catches the error, passes to errorHandler, returns 500 cleanly
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('internal_error');
    });

    it('SEC-02: unhandled async DB error in requireAuth middleware returns HTTP 500 cleanly', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.session.findUnique).mockRejectedValue(new Error('DB pool exhausted during session lookup'));

      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', ['IMAC_SESSION=some-session-id']);

      // Safe behaviour: try/catch in requireAuth catches the error, passes to errorHandler, returns 500 cleanly
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('internal_error');
    });
  });
});
