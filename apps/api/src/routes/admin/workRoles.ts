import { Router } from 'express';
import { db } from '../../db.js';
import { createAuditEntry } from '../../services/auditLog.js';
import { requireAuth, requirePasswordChanged, requirePermission, type AuthRequest } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { createWorkRoleSchema, updateWorkRoleSchema, assignWorkRoleSchema } from '@imac/shared';

export const adminWorkRolesRouter = Router();

// Apply auth and password-change requirement to all admin work-role routes
adminWorkRolesRouter.use(requireAuth);
adminWorkRolesRouter.use(requirePasswordChanged);

/**
 * Helper to resolve EmployeeProfile by either employeeProfileId or userId.
 */
async function resolveEmployeeProfile(employeeId: string) {
  let profile = await db.employeeProfile.findFirst({
    where: {
      OR: [
        { id: employeeId },
        { userId: employeeId },
      ],
    },
  });

  if (!profile) {
    const user = await db.user.findUnique({ where: { id: employeeId } });
    if (!user) return null;

    // Create an employee profile if one does not exist for the user yet
    profile = await db.employeeProfile.create({
      data: {
        userId: user.id,
        employeeCode: `EMP-${user.username.toUpperCase()}`,
      },
    });
  }

  return profile;
}

// ── 1. Create Work Role ────────────────────────────────────────────────────────
adminWorkRolesRouter.post(
  '/',
  requirePermission('workrole:create'),
  validate(createWorkRoleSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const { name, description } = req.body as { name: string; description?: string };

    const existing = await db.workRole.findUnique({
      where: { name },
    });

    if (existing) {
      return res.status(409).json({
        error: 'conflict',
        message: 'A work role with this name already exists',
      });
    }

    const newRole = await db.workRole.create({
      data: {
        name,
        description: description || null,
        isActive: true,
      },
    });

    await createAuditEntry({
      actorUserId: req.user?.id,
      action: 'work_role.created',
      entityType: 'WorkRole',
      entityId: newRole.id,
      ipAddress: req.ip,
      afterSnapshot: { name: newRole.name, description: newRole.description, isActive: newRole.isActive },
    });

    return res.status(201).json({ workRole: newRole });
  }),
);

// ── 2. List All Work Roles ─────────────────────────────────────────────────────
adminWorkRolesRouter.get(
  '/',
  requirePermission('workrole:read'),
  asyncHandler(async (_req: AuthRequest, res) => {
    const roles = await db.workRole.findMany({
      orderBy: { name: 'asc' },
    });

    return res.status(200).json(roles);
  }),
);

// ── 3. Get Single Work Role ────────────────────────────────────────────────────
adminWorkRolesRouter.get(
  '/:id',
  requirePermission('workrole:read'),
  asyncHandler(async (req: AuthRequest, res) => {
    const role = await db.workRole.findUnique({
      where: { id: req.params['id'] },
    });

    if (!role) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Work role not found',
      });
    }

    return res.status(200).json(role);
  }),
);

// ── 4. Edit Work Role ──────────────────────────────────────────────────────────
adminWorkRolesRouter.patch(
  '/:id',
  requirePermission('workrole:update'),
  validate(updateWorkRoleSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const targetId = req.params['id'];
    const { name, description, isActive } = req.body as { name?: string; description?: string; isActive?: boolean };

    const targetRole = await db.workRole.findUnique({
      where: { id: targetId },
    });

    if (!targetRole) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Work role not found',
      });
    }

    if (name && name !== targetRole.name) {
      const existing = await db.workRole.findUnique({
        where: { name },
      });
      if (existing) {
        return res.status(409).json({
          error: 'conflict',
          message: 'A work role with this name already exists',
        });
      }
    }

    const updated = await db.workRole.update({
      where: { id: targetId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    await createAuditEntry({
      actorUserId: req.user?.id,
      action: 'work_role.updated',
      entityType: 'WorkRole',
      entityId: targetId,
      ipAddress: req.ip,
      beforeSnapshot: { name: targetRole.name, description: targetRole.description, isActive: targetRole.isActive },
      afterSnapshot: { name: updated.name, description: updated.description, isActive: updated.isActive },
    });

    return res.status(200).json({ workRole: updated });
  }),
);

// ── 5. Deactivate Work Role ────────────────────────────────────────────────────
adminWorkRolesRouter.patch(
  '/:id/deactivate',
  requirePermission('workrole:deactivate'),
  asyncHandler(async (req: AuthRequest, res) => {
    const targetId = req.params['id'];

    const targetRole = await db.workRole.findUnique({
      where: { id: targetId },
    });

    if (!targetRole) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Work role not found',
      });
    }

    await db.workRole.update({
      where: { id: targetId },
      data: { isActive: false },
    });

    await createAuditEntry({
      actorUserId: req.user?.id,
      action: 'work_role.deactivated',
      entityType: 'WorkRole',
      entityId: targetId,
      ipAddress: req.ip,
      beforeSnapshot: { isActive: targetRole.isActive },
      afterSnapshot: { isActive: false },
    });

    return res.status(200).json({ ok: true });
  }),
);

// ── 6. Assign Work Role to Employee ────────────────────────────────────────────
const handleAssign = asyncHandler(async (req: AuthRequest, res) => {
  const employeeId = req.params['employeeId'];
  const { workRoleId } = req.body as { workRoleId: string };

  const profile = await resolveEmployeeProfile(employeeId);
  if (!profile) {
    return res.status(404).json({
      error: 'not_found',
      message: 'Employee not found',
    });
  }

  const role = await db.workRole.findUnique({
    where: { id: workRoleId },
  });

  if (!role) {
    return res.status(404).json({
      error: 'not_found',
      message: 'Work role not found',
    });
  }

  // Business rule: Deactivated work roles cannot be newly assigned
  if (!role.isActive) {
    return res.status(400).json({
      error: 'invalid_action',
      message: 'Cannot assign a deactivated work role',
    });
  }

  // Business rule: Assigning the same role twice does not duplicate (returns 409 conflict)
  const existing = await db.employeeWorkRole.findUnique({
    where: {
      employeeProfileId_workRoleId: {
        employeeProfileId: profile.id,
        workRoleId: role.id,
      },
    },
  });

  if (existing) {
    return res.status(409).json({
      error: 'conflict',
      message: 'Work role is already assigned to this employee',
    });
  }

  const assignment = await db.employeeWorkRole.create({
    data: {
      employeeProfileId: profile.id,
      workRoleId: role.id,
    },
    include: {
      workRole: true,
    },
  });

  await createAuditEntry({
    actorUserId: req.user?.id,
    action: 'work_role.assigned',
    entityType: 'EmployeeWorkRole',
    entityId: assignment.id,
    ipAddress: req.ip,
    afterSnapshot: {
      employeeProfileId: profile.id,
      workRoleId: role.id,
      roleName: role.name,
    },
  });

  return res.status(201).json({ assignment });
});

adminWorkRolesRouter.post(
  '/employees/:employeeId/work-roles',
  requirePermission('workrole:assign'),
  validate(assignWorkRoleSchema),
  handleAssign,
);

adminWorkRolesRouter.post(
  '/employees/:employeeId/assign',
  requirePermission('workrole:assign'),
  validate(assignWorkRoleSchema),
  handleAssign,
);

// ── 7. Remove Assigned Work Role from Employee ─────────────────────────────────
const handleRemove = asyncHandler(async (req: AuthRequest, res) => {
  const { employeeId, workRoleId } = req.params as { employeeId: string; workRoleId: string };

  const profile = await resolveEmployeeProfile(employeeId);
  if (!profile) {
    return res.status(404).json({
      error: 'not_found',
      message: 'Employee not found',
    });
  }

  const assignment = await db.employeeWorkRole.findUnique({
    where: {
      employeeProfileId_workRoleId: {
        employeeProfileId: profile.id,
        workRoleId,
      },
    },
  });

  if (!assignment) {
    return res.status(404).json({
      error: 'not_found',
      message: 'Work role is not assigned to this employee',
    });
  }

  await db.employeeWorkRole.delete({
    where: { id: assignment.id },
  });

  await createAuditEntry({
    actorUserId: req.user?.id,
    action: 'work_role.removed',
    entityType: 'EmployeeWorkRole',
    entityId: assignment.id,
    ipAddress: req.ip,
    beforeSnapshot: {
      employeeProfileId: profile.id,
      workRoleId,
    },
  });

  return res.status(200).json({ ok: true });
});

adminWorkRolesRouter.delete(
  '/employees/:employeeId/work-roles/:workRoleId',
  requirePermission('workrole:remove'),
  handleRemove,
);

adminWorkRolesRouter.delete(
  '/employees/:employeeId/assign/:workRoleId',
  requirePermission('workrole:remove'),
  handleRemove,
);

// ── 8. List Work Roles Assigned to Specific Employee ───────────────────────────
const handleListAssigned = asyncHandler(async (req: AuthRequest, res) => {
  const employeeId = req.params['employeeId'];

  const profile = await resolveEmployeeProfile(employeeId);
  if (!profile) {
    return res.status(404).json({
      error: 'not_found',
      message: 'Employee not found',
    });
  }

  const assignments = await db.employeeWorkRole.findMany({
    where: { employeeProfileId: profile.id },
    include: { workRole: true },
    orderBy: { createdAt: 'asc' },
  });

  const roles = assignments.map((a) => a.workRole);

  return res.status(200).json({
    employeeProfileId: profile.id,
    workRoles: roles,
  });
});

adminWorkRolesRouter.get(
  '/employees/:employeeId/work-roles',
  requirePermission('workrole:readEmployee'),
  handleListAssigned,
);

adminWorkRolesRouter.get(
  '/employees/:employeeId',
  requirePermission('workrole:readEmployee'),
  handleListAssigned,
);
