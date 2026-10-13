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

    it('security weakness: login does not delete pre-existing sessions from the database', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.user.findFirst).mockResolvedValue(mockAdminUser as any);
      vi.mocked(passwordService.verifyPassword).mockResolvedValue(true);
      vi.mocked(db.user.update).mockResolvedValue(mockAdminUser as any);
      vi.mocked(db.session.create).mockResolvedValue({ id: 'new-session-id' } as any);

      await request(app)
        .post('/api/auth/login')
        .set('Cookie', ['IMAC_SESSION=existing-prior-session-id'])
        .send({ username: 'boss', password: 'correct_password' });

      // Verifies weakness: db.session.delete or deleteMany is NOT invoked for the old session cookie upon login
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

    it('security weakness: Secure flag is omitted in non-production environments', async () => {
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
      // In NODE_ENV=test (non-production), Secure flag is missing, even though local network HTTPS is required
      expect(cookieStr).not.toMatch(/;\s*Secure/i);
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
      // findFirst is queried with mode: 'insensitive'
      (vi.mocked(db.user.findFirst) as any).mockImplementation(async ({ where }: any) => {
        if (where.username.mode === 'insensitive' && where.username.equals.toLowerCase() === 'boss') {
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

    it('security weakness: trailing whitespace in username creates lockout inconsistency', async () => {
      const app = createApp({ csrfDisabled: true });
      // When user enters "boss ", Prisma findFirst searches for exact string "boss "
      (vi.mocked(db.user.findFirst) as any).mockImplementation(async ({ where }: any) => {
        if (where.username.equals === 'boss') {
          return mockAdminUser as any;
        }
        // "boss " does not match DB username "boss"
        return null;
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'boss ', password: 'wrong_password' });

      // Unsanitized whitespace fails username lookup instead of being trimmed
      expect(res.status).toBe(401);
      // Because findFirst returned null, the real user's failedLoginCount was NOT incremented
      expect(db.user.update).not.toHaveBeenCalled();
    });

    it('security weakness: response timing difference between valid and invalid usernames', async () => {
      const app = createApp({ csrfDisabled: true });
      // When username is invalid: returns immediately without verifyPassword
      vi.mocked(db.user.findFirst).mockResolvedValue(null);

      const resInvalid = await request(app)
        .post('/api/auth/login')
        .send({ username: 'nonexistent_user', password: 'wrong_password' });

      expect(resInvalid.status).toBe(401);
      expect(passwordService.verifyPassword).not.toHaveBeenCalled();

      // When username is valid: verifyPassword IS called
      vi.mocked(db.user.findFirst).mockResolvedValue(mockAdminUser as any);
      vi.mocked(passwordService.verifyPassword).mockResolvedValue(false);
      vi.mocked(db.user.update).mockResolvedValue(mockAdminUser as any);

      const resValid = await request(app)
        .post('/api/auth/login')
        .send({ username: 'boss', password: 'wrong_password' });

      expect(resValid.status).toBe(401);
      expect(passwordService.verifyPassword).toHaveBeenCalled();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 4. CSRF Protection & Surface Audit                                         */
  /* -------------------------------------------------------------------------- */
  describe('4. CSRF Protection & Route Coverage', () => {
    it('security weakness: administrative routes (/api/admin/*) lack CSRF protection middleware', async () => {
      // createApp with default settings (CSRF middleware mounted)
      const app = createApp();
      vi.mocked(db.session.findUnique).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.user.findUnique).mockResolvedValue(mockEmployeeUser as any);
      vi.mocked(db.user.update).mockResolvedValue({ ...mockEmployeeUser, isActive: false } as any);
      vi.mocked(db.session.deleteMany).mockResolvedValue({ count: 1 });

      // Call state-changing admin endpoint WITHOUT any CSRF token header or cookie
      const res = await request(app)
        .patch('/api/admin/users/employee-uuid-2/deactivate')
        .set('Cookie', [`IMAC_SESSION=${mockAdminSession.id}`]);

      // Weakness: The request succeeds because csrfMiddleware was NOT mounted on adminUsersRouter in app.ts!
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('security weakness: settings admin route (/api/admin/settings) lacks CSRF protection', async () => {
      const app = createApp();
      vi.mocked(db.session.findUnique).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.systemSetting.findUnique).mockResolvedValue({ key: 'auth.lockoutThreshold', value: '5' } as any);
      vi.mocked(db.systemSetting.upsert).mockResolvedValue({ key: 'auth.lockoutThreshold', value: '10' } as any);

      // State-changing PATCH request to /api/admin/settings/:key WITHOUT CSRF token
      const res = await request(app)
        .patch('/api/admin/settings/auth.lockoutThreshold')
        .set('Cookie', [`IMAC_SESSION=${mockAdminSession.id}`])
        .send({ value: '10' });

      // Weakness: adminSettingsRouter is unprotected by CSRF middleware
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
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
      expect(passwordService.verifyPassword).not.toHaveBeenCalled();
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

    it('password reset invalidates all active sessions and sets mustChangePassword', async () => {
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

    it('security weakness: admin can reset their own password via admin reset endpoint without self-reset block', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.user.findUnique).mockResolvedValue(mockAdminUser as any);
      vi.mocked(db.user.update).mockResolvedValue({ ...mockAdminUser, mustChangePassword: true } as any);
      vi.mocked(db.session.deleteMany).mockResolvedValue({ count: 1 });

      // Admin targets their own ID: /api/admin/users/:adminId/reset-password
      const res = await request(app)
        .post(`/api/admin/users/${mockAdminUser.id}/reset-password`)
        .set('Cookie', [`IMAC_SESSION=${mockAdminSession.id}`]);

      // Weakness: Unlike deactivate and role change, reset-password lacks self-target check (req.user.id === targetId)
      expect(res.status).toBe(200);
      expect(res.body.temporaryPassword).toBeDefined();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 9. Async Unhandled Errors & Process Resilience                             */
  /* -------------------------------------------------------------------------- */
  describe('9. Async Unhandled Errors & Server Resilience', () => {
    it('errorHandler middleware logs error and returns HTTP 500 without crashing', async () => {
      // Test the central errorHandler middleware directly
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

      // Verifies requirements: logs error, returns 500, never crashes
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

    it('security weakness: async routes in Express 4 omit try/catch, resulting in unhandledRejection events', async () => {
      // Intercept unhandledRejection temporarily so Vitest runner does not crash
      const originalListeners = process.rawListeners('unhandledRejection');
      process.removeAllListeners('unhandledRejection');

      let capturedRejection: unknown = null;
      const rejectionPromise = new Promise((resolve) => {
        process.once('unhandledRejection', (reason) => {
          capturedRejection = reason;
          resolve(reason);
        });
      });

      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.user.findFirst).mockRejectedValue(new Error('Connection terminated: DB down'));

      try {
        // Trigger async route that rejects
        request(app)
          .post('/api/auth/login')
          .send({ username: 'boss', password: 'password' })
          .end(() => {
            // Callback intentionally empty; request hangs or rejects in Express 4
          });

        // Await the unhandledRejection event emitted by Node.js due to Express 4's async gap
        await Promise.race([
          rejectionPromise,
          new Promise((resolve) => setTimeout(resolve, 500)),
        ]);
      } finally {
        // Restore Vitest's process listeners
        process.removeAllListeners('unhandledRejection');
        for (const listener of originalListeners) {
          process.on('unhandledRejection', listener as any);
        }
      }

      // Verifies critical weakness: An unhandled rejection was produced because Express 4 does not catch async errors
      expect(capturedRejection).toBeInstanceOf(Error);
      expect((capturedRejection as Error).message).toContain('DB down');
    });
  });
});
