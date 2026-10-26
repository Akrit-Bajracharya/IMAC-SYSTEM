import { Router } from 'express';
import {
  createUserSchema,
  updateUserRoleSchema,
  updateEmployeeProfileSchema,
  type SystemRole,
} from '@imac/shared';
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

// ── 1. Create User & Employee Profile ──────────────────────────────────────────
adminUsersRouter.post(
  '/',
  requirePermission('user:create'),
  validate(createUserSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const {
      username,
      displayName,
      systemRole,
      employeeCode,
      department,
      jobTitle,
      startDate,
      standardShiftHours,
      workingDaysPerWeek,
      managerUserId,
    } = req.body as {
      username: string;
      displayName: string;
      systemRole: SystemRole;
      employeeCode?: string;
      department?: string;
      jobTitle?: string;
      startDate?: string;
      standardShiftHours?: number;
      workingDaysPerWeek?: number;
      managerUserId?: string;
    };

    const existing = await db.user.findUnique({
      where: { username },
    });

    if (existing) {
      return res.status(409).json({
        error: 'conflict',
        message: 'Username is already taken',
      });
    }

    const assignedCode = employeeCode || `EMP-${username.toUpperCase()}`;
    const existingCode = await db.employeeProfile.findUnique({
      where: { employeeCode: assignedCode },
    });

    if (existingCode) {
      return res.status(409).json({
        error: 'conflict',
        message: 'Employee code is already taken',
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
        employeeProfile: {
          create: {
            employeeCode: assignedCode,
            department: department || null,
            jobTitle: jobTitle || null,
            startDate: startDate ? new Date(startDate) : null,
            standardShiftHours: standardShiftHours ?? 8,
            workingDaysPerWeek: workingDaysPerWeek ?? 5,
            managerUserId: managerUserId || null,
          },
        },
      },
      select: {
        ...userSelectFields,
        employeeProfile: true,
      },
    });

    await createAuditEntry({
      actorUserId: req.user?.id,
      action: 'user.created',
      entityType: 'User',
      entityId: newUser.id,
      ipAddress: req.ip,
      // SEC-10: temporaryPassword is intentionally NOT included in the audit log snapshot.
      afterSnapshot: {
        username: newUser.username,
        displayName: newUser.displayName,
        systemRole: newUser.systemRole,
        employeeCode: assignedCode,
      },
    });

    // SEC-10: Instruct clients (browsers, proxies) not to cache this response because it
    // contains a one-time temporary password.
    res.setHeader('Cache-Control', 'no-store');

    return res.status(201).json({
      user: newUser,
      temporaryPassword,
    });
  }),
);

// ── 2. List Users ─────────────────────────────────────────────────────────────
adminUsersRouter.get(
  '/',
  requirePermission('user:read'),
  asyncHandler(async (_req: AuthRequest, res) => {
    const users = await db.user.findMany({
      select: {
        ...userSelectFields,
        employeeProfile: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json(users);
  }),
);

// ── 3. Get User by ID ─────────────────────────────────────────────────────────
adminUsersRouter.get(
  '/:id',
  requirePermission('user:read'),
  asyncHandler(async (req: AuthRequest, res) => {
    const user = await db.user.findUnique({
      where: { id: req.params['id'] },
      select: {
        ...userSelectFields,
        employeeProfile: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        error: 'not_found',
        message: 'User not found',
      });
    }

    return res.status(200).json(user);
  }),
);

// ── 4. Deactivate User ────────────────────────────────────────────────────────
adminUsersRouter.patch(
  '/:id/deactivate',
  requirePermission('user:deactivate'),
  asyncHandler(async (req: AuthRequest, res) => {
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
  }),
);

// ── 4b. Reactivate User ───────────────────────────────────────────────────────
adminUsersRouter.patch(
  '/:id/reactivate',
  requirePermission('user:reactivate'),
  asyncHandler(async (req: AuthRequest, res) => {
    const targetId = req.params['id'];

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
      data: {
        isActive: true,
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });

    await createAuditEntry({
      actorUserId: req.user?.id,
      action: 'user.reactivated',
      entityType: 'User',
      entityId: targetId,
      ipAddress: req.ip,
      beforeSnapshot: { isActive: targetUser.isActive },
      afterSnapshot: { isActive: true },
    });

    return res.status(200).json({ ok: true });
  }),
);

// ── 5. Reset User Password ────────────────────────────────────────────────────
adminUsersRouter.post(
  '/:id/reset-password',
  requirePermission('user:resetPassword'),
  asyncHandler(async (req: AuthRequest, res) => {
    const targetId = req.params['id'];

    // SEC-06: An admin must not reset their own password via this endpoint.
    // Self-service password changes must go through POST /api/auth/change-password.
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

    // SEC-10: Instruct clients and proxies not to cache this response.
    res.setHeader('Cache-Control', 'no-store');

    return res.status(200).json({ temporaryPassword });
  }),
);

// ── 6. Update User System Role ────────────────────────────────────────────────
adminUsersRouter.patch(
  '/:id/role',
  requirePermission('user:changeRole'),
  validate(updateUserRoleSchema),
  asyncHandler(async (req: AuthRequest, res) => {
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
  }),
);

// ── 7. Edit Employee Profile ──────────────────────────────────────────────────
adminUsersRouter.patch(
  '/:id/profile',
  requirePermission('user:update'),
  validate(updateEmployeeProfileSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const targetId = req.params['id'];

    const targetUser = await db.user.findUnique({
      where: { id: targetId },
      include: { employeeProfile: true },
    });

    if (!targetUser) {
      return res.status(404).json({
        error: 'not_found',
        message: 'User not found',
      });
    }

    const {
      department,
      jobTitle,
      startDate,
      standardShiftHours,
      workingDaysPerWeek,
      employeeCode,
      managerUserId,
    } = req.body as {
      department?: string;
      jobTitle?: string;
      startDate?: string | null;
      standardShiftHours?: number;
      workingDaysPerWeek?: number;
      employeeCode?: string;
      managerUserId?: string | null;
    };

    if (employeeCode && targetUser.employeeProfile && employeeCode !== targetUser.employeeProfile.employeeCode) {
      const existingCode = await db.employeeProfile.findUnique({
        where: { employeeCode },
      });
      if (existingCode) {
        return res.status(409).json({
          error: 'conflict',
          message: 'Employee code is already taken',
        });
      }
    }

    const beforeProfile = targetUser.employeeProfile;

    const updatedProfile = await db.employeeProfile.upsert({
      where: { userId: targetId },
      create: {
        userId: targetId,
        employeeCode: employeeCode || `EMP-${targetUser.username.toUpperCase()}`,
        department: department || null,
        jobTitle: jobTitle || null,
        startDate: startDate ? new Date(startDate) : null,
        standardShiftHours: standardShiftHours ?? 8,
        workingDaysPerWeek: workingDaysPerWeek ?? 5,
        managerUserId: managerUserId || null,
      },
      update: {
        ...(department !== undefined && { department: department || null }),
        ...(jobTitle !== undefined && { jobTitle: jobTitle || null }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(standardShiftHours !== undefined && { standardShiftHours }),
        ...(workingDaysPerWeek !== undefined && { workingDaysPerWeek }),
        ...(employeeCode !== undefined && { employeeCode }),
        ...(managerUserId !== undefined && { managerUserId: managerUserId || null }),
      },
    });

    await createAuditEntry({
      actorUserId: req.user?.id,
      action: 'employee_profile.updated',
      entityType: 'EmployeeProfile',
      entityId: updatedProfile.id,
      ipAddress: req.ip,
      beforeSnapshot: beforeProfile
        ? {
            department: beforeProfile.department,
            jobTitle: beforeProfile.jobTitle,
            startDate: beforeProfile.startDate,
            standardShiftHours: beforeProfile.standardShiftHours,
            workingDaysPerWeek: beforeProfile.workingDaysPerWeek,
            employeeCode: beforeProfile.employeeCode,
            managerUserId: beforeProfile.managerUserId,
          }
        : null,
      afterSnapshot: {
        department: updatedProfile.department,
        jobTitle: updatedProfile.jobTitle,
        startDate: updatedProfile.startDate,
        standardShiftHours: updatedProfile.standardShiftHours,
        workingDaysPerWeek: updatedProfile.workingDaysPerWeek,
        employeeCode: updatedProfile.employeeCode,
        managerUserId: updatedProfile.managerUserId,
      },
    });

    return res.status(200).json({ employeeProfile: updatedProfile });
  }),
);
