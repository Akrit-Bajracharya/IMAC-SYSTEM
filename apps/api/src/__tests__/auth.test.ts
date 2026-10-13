import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db.js';
import * as passwordService from '../services/password.js';

// Mock password service to avoid slow hashing in unit tests
vi.mock('../services/password.js', () => ({
  verifyPassword: vi.fn(),
  hashPassword: vi.fn().mockResolvedValue('hashed_new_password'),
  generateTempPassword: vi.fn().mockReturnValue('temp-pass-12345'),
  // SEC-05: getDummyHash is used by the login route for constant-time comparisons
  getDummyHash: vi.fn().mockResolvedValue('dummy-hash-for-timing'),
}));

const app = createApp({ csrfDisabled: true });

describe('Auth Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockUser = {
    id: 'user-uuid-1',
    username: 'boss',
    displayName: 'Boss',
    passwordHash: 'hashed_password',
    systemRole: 'system_admin',
    isActive: true,
    mustChangePassword: false,
    failedLoginCount: 0,
    lockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSession = {
    id: 'valid-session-id',
    userId: 'user-uuid-1',
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    lastActiveAt: new Date(),
    user: mockUser,
  };

  // 1. POST /api/auth/login - 200 on valid credentials
  it('POST /api/auth/login - 200 on valid credentials', async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue(mockUser as any);
    vi.mocked(passwordService.verifyPassword).mockResolvedValue(true);
    vi.mocked(db.user.update).mockResolvedValue(mockUser as any);
    vi.mocked(db.session.create).mockResolvedValue({ id: 'new-session-id' } as any);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'boss', password: 'correct_password' });

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.username).toBe('boss');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  // 2. POST /api/auth/login - 401 on wrong password
  it('POST /api/auth/login - 401 on wrong password', async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue(mockUser as any);
    vi.mocked(passwordService.verifyPassword).mockResolvedValue(false);
    vi.mocked(db.user.update).mockResolvedValue(mockUser as any);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'boss', password: 'wrong_password' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_credentials');
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: mockUser.id },
        data: { failedLoginCount: 1 },
      }),
    );
  });

  // 3. POST /api/auth/login - 401 on unknown username
  it('POST /api/auth/login - 401 on unknown username', async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nonexistent', password: 'password' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_credentials');
  });

  // 4. POST /api/auth/login - 423 when lockedUntil is in the future
  it('POST /api/auth/login - 423 when lockedUntil is in the future', async () => {
    const lockedUser = {
      ...mockUser,
      lockedUntil: new Date(Date.now() + 10 * 60 * 1000), // locked for 10 min
    };
    vi.mocked(db.user.findFirst).mockResolvedValue(lockedUser as any);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'boss', password: 'password' });

    expect(res.status).toBe(423);
    expect(res.body.error).toBe('account_locked');
  });

  // 5. POST /api/auth/login - account gets locked after reaching lockout threshold
  it('POST /api/auth/login - account gets locked after 5 failures', async () => {
    const nearLockoutUser = {
      ...mockUser,
      failedLoginCount: 4,
    };
    vi.mocked(db.user.findFirst).mockResolvedValue(nearLockoutUser as any);
    vi.mocked(passwordService.verifyPassword).mockResolvedValue(false);
    vi.mocked(db.user.update).mockResolvedValue(nearLockoutUser as any);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'boss', password: 'wrong_password' });

    expect(res.status).toBe(401);
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: nearLockoutUser.id },
        data: expect.objectContaining({
          failedLoginCount: 0,
          lockedUntil: expect.any(Date),
        }),
      }),
    );
  });

  // 6. POST /api/auth/login - 400 on validation error (missing username)
  it('POST /api/auth/login - 400 on validation error', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'password_only' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  // 7. POST /api/auth/logout - 200 and session deleted
  it('POST /api/auth/logout - 200 and session deleted', async () => {
    vi.mocked(db.session.findUnique).mockResolvedValue(mockSession as any);
    vi.mocked(db.session.update).mockResolvedValue(mockSession as any);
    vi.mocked(db.session.deleteMany).mockResolvedValue({ count: 1 });

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', [`IMAC_SESSION=${mockSession.id}`]);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(db.session.deleteMany).toHaveBeenCalledWith({ where: { id: mockSession.id } });
  });

  // 8. GET /api/auth/me - 200 with valid session
  it('GET /api/auth/me - 200 with valid session', async () => {
    vi.mocked(db.session.findUnique).mockResolvedValue(mockSession as any);
    vi.mocked(db.session.update).mockResolvedValue(mockSession as any);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', [`IMAC_SESSION=${mockSession.id}`]);

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.username).toBe('boss');
  });

  // 9. GET /api/auth/me - 401 with no session cookie
  it('GET /api/auth/me - 401 with no session cookie', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthenticated');
  });

  // 10. POST /api/auth/change-password - 200 on valid current password
  it('POST /api/auth/change-password - 200 on valid current password', async () => {
    vi.mocked(db.session.findUnique).mockResolvedValue(mockSession as any);
    vi.mocked(db.session.update).mockResolvedValue(mockSession as any);
    vi.mocked(db.user.findUnique).mockResolvedValue(mockUser as any);
    vi.mocked(passwordService.verifyPassword).mockResolvedValue(true);
    vi.mocked(db.user.update).mockResolvedValue(mockUser as any);

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', [`IMAC_SESSION=${mockSession.id}`])
      .send({
        currentPassword: 'current_password',
        newPassword: 'new_long_secure_password',
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: mockUser.id },
        data: expect.objectContaining({ mustChangePassword: false }),
      }),
    );
  });

  // 11. POST /api/auth/change-password - 400 on wrong current password
  it('POST /api/auth/change-password - 400 on wrong current password', async () => {
    vi.mocked(db.session.findUnique).mockResolvedValue(mockSession as any);
    vi.mocked(db.session.update).mockResolvedValue(mockSession as any);
    vi.mocked(db.user.findUnique).mockResolvedValue(mockUser as any);
    vi.mocked(passwordService.verifyPassword).mockResolvedValue(false);

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', [`IMAC_SESSION=${mockSession.id}`])
      .send({
        currentPassword: 'wrong_current_password',
        newPassword: 'new_long_secure_password',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('wrong_current_password');
  });

  // 12. POST /api/auth/change-password - 400 when new password too short
  it('POST /api/auth/change-password - 400 when new password too short', async () => {
    vi.mocked(db.session.findUnique).mockResolvedValue(mockSession as any);
    vi.mocked(db.session.update).mockResolvedValue(mockSession as any);

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', [`IMAC_SESSION=${mockSession.id}`])
      .send({
        currentPassword: 'current_password',
        newPassword: 'short', // shorter than default 10 chars
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  // 13. Protected route with mustChangePassword=true - 403 with password_change_required
  it('Protected route with mustChangePassword=true - 403 with password_change_required', async () => {
    const forcedPasswordChangeSession = {
      ...mockSession,
      user: {
        ...mockUser,
        mustChangePassword: true,
      },
    };
    vi.mocked(db.session.findUnique).mockResolvedValue(forcedPasswordChangeSession as any);
    vi.mocked(db.session.update).mockResolvedValue(forcedPasswordChangeSession as any);

    const res = await request(app)
      .get('/api/admin/users')
      .set('Cookie', [`IMAC_SESSION=${mockSession.id}`]);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('password_change_required');
  });
});
