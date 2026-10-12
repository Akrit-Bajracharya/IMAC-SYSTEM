import { Router } from 'express';
import { loginSchema, changePasswordSchema } from '@imac/shared';
import { db } from '../db.js';
import { config } from '../config.js';
import { verifyPassword, hashPassword } from '../services/password.js';
import { getSettingNumber } from '../services/settings.js';
import { createSession, deleteSession } from '../services/session.js';
import { createAuditEntry } from '../services/auditLog.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { generateToken } from '../lib/csrf.js';

export const authRouter = Router();

// GET /csrf
authRouter.get('/csrf', (req, res) => {
  const token = generateToken(req, res);
  res.json({ csrfToken: token });
});

// POST /login
authRouter.post('/login', validate(loginSchema), async (req, res) => {
  const { username, password } = req.body;
  const ipAddress = req.ip;

  const user = await db.user.findFirst({
    where: {
      username: {
        equals: username,
        mode: 'insensitive',
      },
    },
  });

  if (!user || !user.isActive) {
    await createAuditEntry({
      action: 'auth.login.failed',
      entityType: 'User',
      entityId: user?.id ?? null,
      ipAddress,
      beforeSnapshot: { username },
    });
    return res.status(401).json({
      error: 'invalid_credentials',
      message: 'Invalid username or password',
    });
  }

  const now = new Date();
  if (user.lockedUntil && user.lockedUntil > now) {
    return res.status(423).json({
      error: 'account_locked',
      lockedUntil: user.lockedUntil,
      message: 'Account is temporarily locked due to failed login attempts',
    });
  }

  const isValid = await verifyPassword(user.passwordHash, password);

  if (!isValid) {
    const lockoutThreshold = await getSettingNumber('auth.lockoutThreshold', 5);
    const lockoutDurationMinutes = await getSettingNumber('auth.lockoutDurationMinutes', 15);
    const newFailedCount = user.failedLoginCount + 1;

    if (newFailedCount >= lockoutThreshold) {
      const lockedUntil = new Date(now.getTime() + lockoutDurationMinutes * 60 * 1000);
      await db.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: 0,
          lockedUntil,
        },
      });
      await createAuditEntry({
        actorUserId: user.id,
        action: 'auth.login.locked',
        entityType: 'User',
        entityId: user.id,
        ipAddress,
        afterSnapshot: { lockedUntil },
      });
    } else {
      await db.user.update({
        where: { id: user.id },
        data: { failedLoginCount: newFailedCount },
      });
      await createAuditEntry({
        actorUserId: user.id,
        action: 'auth.login.failed',
        entityType: 'User',
        entityId: user.id,
        ipAddress,
        afterSnapshot: { failedLoginCount: newFailedCount },
      });
    }

    return res.status(401).json({
      error: 'invalid_credentials',
      message: 'Invalid username or password',
    });
  }

  // Reset failed login count and clear lockout
  await db.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });

  const userAgent = req.headers['user-agent'] as string | undefined;
  const sessionId = await createSession(user.id, ipAddress, userAgent);

  res.cookie(config.sessionCookieName, sessionId, {
    httpOnly: true,
    path: '/',
    sameSite: 'strict',
    secure: config.isProduction,
  });

  await createAuditEntry({
    actorUserId: user.id,
    action: 'auth.login.success',
    entityType: 'User',
    entityId: user.id,
    ipAddress,
  });

  return res.status(200).json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      systemRole: user.systemRole,
      mustChangePassword: user.mustChangePassword,
    },
  });
});

// POST /logout
authRouter.post('/logout', requireAuth, async (req: AuthRequest, res) => {
  if (req.sessionId) {
    await deleteSession(req.sessionId);
  }

  res.clearCookie(config.sessionCookieName, { path: '/' });

  await createAuditEntry({
    actorUserId: req.user?.id,
    action: 'auth.logout',
    entityType: 'Session',
    entityId: req.sessionId,
    ipAddress: req.ip,
  });

  return res.status(200).json({ ok: true });
});

// GET /me
authRouter.get('/me', requireAuth, (req: AuthRequest, res) => {
  return res.status(200).json({ user: req.user });
});

// POST /change-password
authRouter.post('/change-password', requireAuth, validate(changePasswordSchema), async (req: AuthRequest, res) => {
  const { currentPassword, newPassword } = req.body;
  const minPasswordLength = await getSettingNumber('auth.minPasswordLength', 10);

  if (newPassword.length < minPasswordLength) {
    return res.status(400).json({
      error: 'validation_error',
      message: `Password must be at least ${minPasswordLength} characters long`,
    });
  }

  const user = await db.user.findUnique({
    where: { id: req.user!.id },
  });

  if (!user) {
    return res.status(401).json({ error: 'unauthenticated', message: 'User not found' });
  }

  const isCurrentValid = await verifyPassword(user.passwordHash, currentPassword);
  if (!isCurrentValid) {
    return res.status(400).json({
      error: 'wrong_current_password',
      message: 'Current password is incorrect',
    });
  }

  const newHash = await hashPassword(newPassword);

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newHash,
      mustChangePassword: false,
    },
  });

  await createAuditEntry({
    actorUserId: user.id,
    action: 'auth.password.changed',
    entityType: 'User',
    entityId: user.id,
    ipAddress: req.ip,
  });

  return res.status(200).json({ ok: true });
});
