import { Router, type Response } from 'express';
import { db } from '../db.js';
import {
  requireAuth,
  requirePasswordChanged,
  type AuthRequest,
} from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { can } from '../lib/permissions.js';
import {
  createMilestoneSchema,
  patchMilestoneSchema,
} from '@imac/shared';
import { parseDateOnlyUtc } from '../services/workLog.js';
import { resolveProjectAccess, isValidUuid } from '../services/projectAccess.js';

export const milestonesRouter = Router({ mergeParams: true });

milestonesRouter.use(requireAuth);
milestonesRouter.use(requirePasswordChanged);

/**
 * 1. GET /api/projects/:id/milestones
 * List milestones. Accessible to all project members and system_admin.
 */
milestonesRouter.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Step 1: Permission check
    if (!can(req.user!, 'task:read')) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
    }

    // Step 2 & 3: Project and membership check
    const access = await resolveProjectAccess(req.params['id'] as string, req.user!);
    if (access.notFound) {
      return res.status(404).json({ error: 'not_found', message: access.message ?? 'Project not found' });
    }

    const milestones = await db.milestone.findMany({
      where: { projectId: req.params['id'] as string },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    });

    return res.status(200).json(milestones);
  }),
);

/**
 * 2. POST /api/projects/:id/milestones
 * Create milestone. Permitted: project managers and system_admin.
 */
milestonesRouter.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Step 1: Permission check
    if (!can(req.user!, 'milestone:manage')) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
    }

    // Step 2 & 3: Project and membership check
    const access = await resolveProjectAccess(req.params['id'] as string, req.user!);
    if (access.notFound) {
      return res.status(404).json({ error: 'not_found', message: access.message ?? 'Project not found' });
    }

    // Step 4: Manager check
    if (!access.isManager) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'Requires project manager role on this project',
      });
    }

    const parseResult = createMilestoneSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid milestone data',
        details: parseResult.error.issues,
      });
    }

    const { name, dueDate } = parseResult.data;
    const projectId = req.params['id'] as string;

    const milestone = await db.$transaction(async (tx) => {
      const m = await tx.milestone.create({
        data: {
          projectId,
          name,
          dueDate: dueDate ? parseDateOnlyUtc(dueDate) : null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: req.user!.id,
          action: 'milestone.created',
          entityType: 'milestone',
          entityId: m.id,
          afterSnapshot: {
            name: m.name,
            dueDate: m.dueDate,
          },
          ipAddress: req.ip,
        },
      });

      return m;
    });

    return res.status(201).json(milestone);
  }),
);

/**
 * 3. PATCH /api/projects/:id/milestones/:milestoneId
 * Edit milestone. Permitted: project managers and system_admin.
 */
milestonesRouter.patch(
  '/:milestoneId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Step 1: Permission check
    if (!can(req.user!, 'milestone:manage')) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
    }

    // Step 2 & 3: Project and membership check
    const access = await resolveProjectAccess(req.params['id'] as string, req.user!);
    if (access.notFound) {
      return res.status(404).json({ error: 'not_found', message: access.message ?? 'Project not found' });
    }

    // Step 4: Manager check
    if (!access.isManager) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'Requires project manager role on this project',
      });
    }

    const milestoneId = req.params['milestoneId'] as string;
    if (!isValidUuid(milestoneId)) {
      return res.status(404).json({ error: 'not_found', message: 'Milestone not found' });
    }

    const milestone = await db.milestone.findUnique({
      where: { id: milestoneId },
    });
    if (!milestone || milestone.projectId !== (req.params['id'] as string)) {
      return res.status(404).json({ error: 'not_found', message: 'Milestone not found' });
    }

    const parseResult = patchMilestoneSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid milestone update data',
        details: parseResult.error.issues,
      });
    }

    const data = parseResult.data;
    const updateData: { name?: string; dueDate?: Date | null } = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate ? parseDateOnlyUtc(data.dueDate) : null;
    }

    const updated = await db.$transaction(async (tx) => {
      const u = await tx.milestone.update({
        where: { id: milestoneId },
        data: updateData,
      });

      await tx.auditLog.create({
        data: {
          actorUserId: req.user!.id,
          action: 'milestone.updated',
          entityType: 'milestone',
          entityId: u.id,
          beforeSnapshot: {
            name: milestone.name,
            dueDate: milestone.dueDate,
          },
          afterSnapshot: {
            name: u.name,
            dueDate: u.dueDate,
          },
          ipAddress: req.ip,
        },
      });

      return u;
    });

    return res.status(200).json(updated);
  }),
);

/**
 * 4. POST /api/projects/:id/milestones/:milestoneId/complete
 * Marks milestone as completed.
 * Conditional updateMany: completing an already-completed milestone returns 409.
 */
milestonesRouter.post(
  '/:milestoneId/complete',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Step 1: Permission check
    if (!can(req.user!, 'milestone:manage')) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
    }

    // Step 2 & 3: Project and membership check
    const access = await resolveProjectAccess(req.params['id'] as string, req.user!);
    if (access.notFound) {
      return res.status(404).json({ error: 'not_found', message: access.message ?? 'Project not found' });
    }

    // Step 4: Manager check
    if (!access.isManager) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'Requires project manager role on this project',
      });
    }

    const milestoneId = req.params['milestoneId'] as string;
    if (!isValidUuid(milestoneId)) {
      return res.status(404).json({ error: 'not_found', message: 'Milestone not found' });
    }

    const milestone = await db.milestone.findUnique({
      where: { id: milestoneId },
    });
    if (!milestone || milestone.projectId !== (req.params['id'] as string)) {
      return res.status(404).json({ error: 'not_found', message: 'Milestone not found' });
    }

    const now = new Date();
    const result = await db.$transaction(async (tx) => {
      const updateRes = await tx.milestone.updateMany({
        where: {
          id: milestoneId,
          projectId: req.params['id'] as string,
          completedAt: null,
        },
        data: {
          completedAt: now,
        },
      });

      if (updateRes.count === 0) {
        return { alreadyCompleted: true };
      }

      await tx.auditLog.create({
        data: {
          actorUserId: req.user!.id,
          action: 'milestone.completed',
          entityType: 'milestone',
          entityId: milestoneId,
          afterSnapshot: { completedAt: now },
          ipAddress: req.ip,
        },
      });

      return { success: true };
    });

    if (result.alreadyCompleted) {
      return res.status(409).json({
        error: 'already_completed',
        message: 'Milestone is already completed',
      });
    }

    return res.status(200).json({
      id: milestoneId,
      completedAt: now,
    });
  }),
);

/**
 * 5. POST /api/projects/:id/milestones/:milestoneId/reopen
 * Reopens milestone.
 * Conditional updateMany: reopening an already-open milestone returns 409.
 */
milestonesRouter.post(
  '/:milestoneId/reopen',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Step 1: Permission check
    if (!can(req.user!, 'milestone:manage')) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
    }

    // Step 2 & 3: Project and membership check
    const access = await resolveProjectAccess(req.params['id'] as string, req.user!);
    if (access.notFound) {
      return res.status(404).json({ error: 'not_found', message: access.message ?? 'Project not found' });
    }

    // Step 4: Manager check
    if (!access.isManager) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'Requires project manager role on this project',
      });
    }

    const milestoneId = req.params['milestoneId'] as string;
    if (!isValidUuid(milestoneId)) {
      return res.status(404).json({ error: 'not_found', message: 'Milestone not found' });
    }

    const milestone = await db.milestone.findUnique({
      where: { id: milestoneId },
    });
    if (!milestone || milestone.projectId !== (req.params['id'] as string)) {
      return res.status(404).json({ error: 'not_found', message: 'Milestone not found' });
    }

    const result = await db.$transaction(async (tx) => {
      const updateRes = await tx.milestone.updateMany({
        where: {
          id: milestoneId,
          projectId: req.params['id'] as string,
          completedAt: { not: null },
        },
        data: {
          completedAt: null,
        },
      });

      if (updateRes.count === 0) {
        return { alreadyOpen: true };
      }

      await tx.auditLog.create({
        data: {
          actorUserId: req.user!.id,
          action: 'milestone.reopened',
          entityType: 'milestone',
          entityId: milestoneId,
          ipAddress: req.ip,
        },
      });

      return { success: true };
    });

    if (result.alreadyOpen) {
      return res.status(409).json({
        error: 'already_open',
        message: 'Milestone is already open',
      });
    }

    return res.status(200).json({
      id: milestoneId,
      completedAt: null,
    });
  }),
);
