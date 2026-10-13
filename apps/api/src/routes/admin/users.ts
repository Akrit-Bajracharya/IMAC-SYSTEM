import { Router } from 'express';
import { createUserSchema, updateUserRoleSchema, type SystemRole } from '@imac/shared';
import { db } from '../../db.js';
import { generateTempPassword, hashPassword } from '../../services/password.js';
import { deleteUserSessions } from '../../services/session.js';
import { createAuditEntry } from '../../services/auditLog.js';
import { requireAuth, requirePasswordChanged, requirePermission, type AuthRequest } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';

export const adminUsersRouter = Router();

// Apply auth and password-change requirement to all admin user routes
adminUsersRouter.use(requireAuth);
adminUsersRouter.use(requirePasswordChanged);

const userSelectFields = {
  id: true,
  username: true,
  displayName: true,
  systemRole: true,
  isActive: true,
  mustChangePassword: true,
  failedLoginCount: true,
  lockedUntil: true,
  createdAt: true,
  updatedAt: true,
};

// POST / - Create user
adminUsersRouter.post('/', requirePermission('user:create'), validate(createUserSchema), asyncHandler(async (req: AuthRequest, res) => {
  const { username, displayName, systemRole } = req.body as { username: string; displayName: string; systemRole: SystemRole };

  const existing = await db.user.findUnique({
    where: { username },
  });

  if (existing) {
    return res.status(409).json({
      error: 'conflict',
      message: 'Username is already taken',
    });
  }

  const temporaryPassword = generateTempPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  const newUser = await db.user.create({
    data: {
      username,
      displayName,
      systemRole,
      passwordHash,
      isActive: true,
      mustChangePassword: true,
    },
    select: userSelectFields,
  });

  await createAuditEntry({
    actorUserId: req.user?.id,
    action: 'user.created',
    entityType: 'User',
    entityId: newUser.id,
    ipAddress: req.ip,
    // SEC-10: temporaryPassword is intentionally NOT included in the audit log snapshot.
    afterSnapshot: { username: newUser.username, displayName: newUser.displayName, systemRole: newUser.systemRole },
  });

  // SEC-10: Instruct clients (browsers, proxies) not to cache this response because it
  // contains a one-time temporary password. The password is returned once to the admin
  // so they can hand it to the new user; it must not persist in HTTP caches.
  res.setHeader('Cache-Control', 'no-store');

  return res.status(201).json({
    user: newUser,
    temporaryPassword,
  });
}));

// GET / - List users
adminUsersRouter.get('/', requirePermission('user:read'), asyncHandler(async (_req: AuthRequest, res) => {
  const users = await db.user.findMany({
    select: userSelectFields,
    orderBy: { createdAt: 'desc' },
  });

  return res.status(200).json(users);
}));

// GET /:id - Get user by ID
adminUsersRouter.get('/:id', requirePermission('user:read'), asyncHandler(async (req: AuthRequest, res) => {
  const user = await db.user.findUnique({
    where: { id: req.params['id'] },
    select: userSelectFields,
  });

  if (!user) {
    return res.status(404).json({
      error: 'not_found',
      message: 'User not found',
    });
  }

  return res.status(200).json(user);
}));

// PATCH /:id/deactivate - Deactivate user
adminUsersRouter.patch('/:id/deactivate', requirePermission('user:deactivate'), asyncHandler(async (req: AuthRequest, res) => {
  const targetId = req.params['id'];

  if (req.user?.id === targetId) {
    return res.status(400).json({
      error: 'invalid_action',
      message: 'Cannot deactivate your own account',
    });
  }

  const targetUser = await db.user.findUnique({
    where: { id: targetId },
  });

  if (!targetUser) {
    return res.status(404).json({
      error: 'not_found',
      message: 'User not found',
    });
  }

  await db.user.update({
    where: { id: targetId },
    data: { isActive: false },
  });

  await deleteUserSessions(targetId);

  await createAuditEntry({
    actorUserId: req.user?.id,
    action: 'user.deactivated',
    entityType: 'User',
    entityId: targetId,
    ipAddress: req.ip,
    beforeSnapshot: { isActive: targetUser.isActive },
    afterSnapshot: { isActive: false },
  });

  return res.status(200).json({ ok: true });
}));

// POST /:id/reset-password - Reset user password
adminUsersRouter.post('/:id/reset-password', requirePermission('user:resetPassword'), asyncHandler(async (req: AuthRequest, res) => {
  const targetId = req.params['id'];

  // SEC-06: An admin must not reset their own password via this endpoint.
  // Self-service password changes must go through POST /api/auth/change-password,
  // which requires the current password and keeps the existing session intact.
  if (req.user?.id === targetId) {
    return res.status(400).json({
      error: 'invalid_action',
      message: 'Cannot reset your own password via the admin endpoint. Use /api/auth/change-password instead.',
    });
  }

  const targetUser = await db.user.findUnique({
    where: { id: targetId },
  });

  if (!targetUser) {
    return res.status(404).json({
      error: 'not_found',
      message: 'User not found',
    });
  }

  const temporaryPassword = generateTempPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  await db.user.update({
    where: { id: targetId },
    data: {
      passwordHash,
      mustChangePassword: true,
    },
  });

  await deleteUserSessions(targetId);

  // SEC-10: temporaryPassword is intentionally NOT included in the audit log.
  await createAuditEntry({
    actorUserId: req.user?.id,
    action: 'auth.password.reset',
    entityType: 'User',
    entityId: targetId,
    ipAddress: req.ip,
  });

  // SEC-10: Instruct clients and proxies not to cache this response because it
  // contains a one-time temporary password.
  res.setHeader('Cache-Control', 'no-store');

  return res.status(200).json({ temporaryPassword });
}));

// PATCH /:id/role - Update user system role
adminUsersRouter.patch('/:id/role', requirePermission('user:changeRole'), validate(updateUserRoleSchema), asyncHandler(async (req: AuthRequest, res) => {
  const targetId = req.params['id'];
  const { systemRole } = req.body as { systemRole: SystemRole };

  if (req.user?.id === targetId) {
    return res.status(400).json({
      error: 'invalid_action',
      message: 'Cannot change your own role',
    });
  }

  const targetUser = await db.user.findUnique({
    where: { id: targetId },
  });

  if (!targetUser) {
    return res.status(404).json({
      error: 'not_found',
      message: 'User not found',
    });
  }

  const beforeRole = targetUser.systemRole;

  await db.user.update({
    where: { id: targetId },
    data: { systemRole },
  });

  await createAuditEntry({
    actorUserId: req.user?.id,
    action: 'user.role_changed',
    entityType: 'User',
    entityId: targetId,
    ipAddress: req.ip,
    beforeSnapshot: { systemRole: beforeRole },
    afterSnapshot: { systemRole },
  });

  return res.status(200).json({ ok: true });
}));
