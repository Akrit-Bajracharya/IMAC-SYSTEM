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
  createProjectSchema,
  patchProjectSchema,
  addProjectMemberSchema,
  changeProjectStatusSchema,
  listProjectsQuerySchema,
} from '@imac/shared';
import { parseDateOnlyUtc } from '../services/workLog.js';
import { createAuditEntry } from '../services/auditLog.js';
import { isValidUuid } from '../services/projectAccess.js';
import { tasksRouter } from './tasks.js';
import { milestonesRouter } from './milestones.js';
import { timeLogsRouter } from './timeLogs.js';
import { messagesRouter } from './messages.js';
import { calculateProjectProgress } from '../services/projectProgress.js';
import { getKathmanduTodayDateString } from '../services/workLog.js';
import { resolveProjectAccess } from '../services/projectAccess.js';

export const projectsRouter = Router();

// Strict session authentication and password-change requirement
projectsRouter.use(requireAuth);
projectsRouter.use(requirePasswordChanged);

projectsRouter.use('/:id/tasks', tasksRouter);
projectsRouter.use('/:id/milestones', milestonesRouter);
projectsRouter.use('/:id/time-logs', timeLogsRouter);
projectsRouter.use('/:id/messages', messagesRouter);


/**
 * 1. POST /api/projects
 * Create project. Creator automatically becomes manager in the same transaction.
 * Permitted: system_admin, project_manager
 */
projectsRouter.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Step 1: Permission check
    if (!can(req.user!, 'project:create')) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
    }

    // Step 2: Payload validation
    const parseResult = createProjectSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid project data',
        details: parseResult.error.issues,
      });
    }

    const { name, description, startDate, targetDate } = parseResult.data;

    const result = await db.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          name,
          description: description ?? null,
          startDate: startDate ? parseDateOnlyUtc(startDate) : null,
          targetDate: targetDate ? parseDateOnlyUtc(targetDate) : null,
          status: 'on_track',
          createdByUserId: req.user!.id,
        },
      });

      const member = await tx.projectMember.create({
        data: {
          projectId: project.id,
          userId: req.user!.id,
          projectRole: 'manager',
          addedByUserId: req.user!.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: req.user!.id,
          action: 'project.created',
          entityType: 'project',
          entityId: project.id,
          afterSnapshot: {
            id: project.id,
            name: project.name,
            status: project.status,
          },
          ipAddress: req.ip,
        },
      });

      return { project, member };
    });

    return res.status(201).json({
      ...result.project,
      members: [result.member],
    });
  }),
);

/**
 * 2. GET /api/projects
 * List projects. System admin sees all; non-admins see only projects they are members of.
 * Supports limit (default 50, max 100), cursor, order by createdAt desc, id desc.
 */
projectsRouter.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Step 1: Permission check
    if (!can(req.user!, 'project:read')) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
    }

    // Step 2: Query validation (invalid cursor returns 400)
    const queryParse = listProjectsQuerySchema.safeParse(req.query);
    if (!queryParse.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid query parameters',
        details: queryParse.error.issues,
      });
    }

    const { limit, cursor } = queryParse.data;
    const isSystemAdmin = req.user!.systemRole === 'system_admin';

    const whereClause = isSystemAdmin
      ? {}
      : {
          members: {
            some: {
              userId: req.user!.id,
            },
          },
        };

    const takeCount = limit + 1;
    const projects = await db.project.findMany({
      where: whereClause,
      take: takeCount,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    const hasMore = projects.length > limit;
    const items = hasMore ? projects.slice(0, limit) : projects;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]!.id : null;

    const formattedItems = items.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      startDate: p.startDate,
      targetDate: p.targetDate,
      createdByUserId: p.createdByUserId,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      memberCount: p._count.members,
    }));

    return res.status(200).json({
      items: formattedItems,
      nextCursor,
      hasMore,
    });
  }),
);

/**
 * 3. GET /api/projects/:id
 * Retrieve project details. Non-members receive 404 (not 403).
 * Explicit select for members: systemRole is only returned to system_admin. PasswordHash is never selected.
 */
projectsRouter.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Step 1: Permission check
    if (!can(req.user!, 'project:read')) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
    }

    // Step 2: UUID validation
    if (!isValidUuid(req.params.id)) {
      return res.status(404).json({ error: 'not_found', message: 'Project not found' });
    }

    const isSystemAdmin = req.user!.systemRole === 'system_admin';

    // Step 3: Project and membership check
    const project = await db.project.findUnique({
      where: { id: req.params.id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                username: true,
                systemRole: isSystemAdmin,
              },
            },
          },
        },
        _count: {
          select: { members: true },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'not_found', message: 'Project not found' });
    }

    if (!isSystemAdmin) {
      const isMember = project.members.some((m) => m.userId === req.user!.id);
      if (!isMember) {
        return res.status(404).json({ error: 'not_found', message: 'Project not found' });
      }
    }

    return res.status(200).json({
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      startDate: project.startDate,
      targetDate: project.targetDate,
      createdByUserId: project.createdByUserId,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      members: project.members,
      memberCount: project._count.members,
    });
  }),
);

/**
 * 4. PATCH /api/projects/:id
 * Edit project name, description, dates.
 * Project managers of THIS project and system_admin.
 * Compares against stored date when only one date is sent.
 */
projectsRouter.patch(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Step 1: Permission check
    if (!can(req.user!, 'project:update')) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
    }

    // Step 2: UUID validation
    if (!isValidUuid(req.params.id)) {
      return res.status(404).json({ error: 'not_found', message: 'Project not found' });
    }

    // Step 3: Project and membership lookup
    const project = await db.project.findUnique({
      where: { id: req.params.id },
    });
    if (!project) {
      return res.status(404).json({ error: 'not_found', message: 'Project not found' });
    }

    const isSystemAdmin = req.user!.systemRole === 'system_admin';
    if (!isSystemAdmin) {
      const member = await db.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: req.params.id,
            userId: req.user!.id,
          },
        },
      });
      if (!member) {
        return res.status(404).json({ error: 'not_found', message: 'Project not found' });
      }

      // Step 4: Manager check
      if (member.projectRole !== 'manager') {
        return res.status(403).json({
          error: 'forbidden',
          message: 'Requires project manager role on this project',
        });
      }
    }

    // Parse and validate payload (.strict() rejects unknown fields like status)
    const parseResult = patchProjectSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid project update data',
        details: parseResult.error.issues,
      });
    }

    const data = parseResult.data;

    // Cross-date validation against stored values when only one date is supplied
    const storedStartStr = project.startDate ? project.startDate.toISOString().slice(0, 10) : null;
    const storedTargetStr = project.targetDate ? project.targetDate.toISOString().slice(0, 10) : null;

    const effectiveStart = data.startDate !== undefined ? data.startDate : storedStartStr;
    const effectiveTarget = data.targetDate !== undefined ? data.targetDate : storedTargetStr;

    if (effectiveStart && effectiveTarget && effectiveTarget < effectiveStart) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'targetDate cannot be before startDate',
        details: [
          {
            path: ['targetDate'],
            message: 'targetDate cannot be before startDate',
          },
        ],
      });
    }

    const updateData: {
      name?: string;
      description?: string | null;
      startDate?: Date | null;
      targetDate?: Date | null;
    } = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.startDate !== undefined) {
      updateData.startDate = data.startDate ? parseDateOnlyUtc(data.startDate) : null;
    }
    if (data.targetDate !== undefined) {
      updateData.targetDate = data.targetDate ? parseDateOnlyUtc(data.targetDate) : null;
    }

    const updated = await db.project.update({
      where: { id: req.params.id },
      data: updateData,
    });

    await createAuditEntry({
      actorUserId: req.user!.id,
      action: 'project.updated',
      entityType: 'project',
      entityId: updated.id,
      beforeSnapshot: {
        name: project.name,
        description: project.description,
        startDate: project.startDate,
        targetDate: project.targetDate,
      },
      afterSnapshot: {
        name: updated.name,
        description: updated.description,
        startDate: updated.startDate,
        targetDate: updated.targetDate,
      },
      ipAddress: req.ip,
    });

    return res.status(200).json(updated);
  }),
);

/**
 * 5. POST /api/projects/:id/members
 * Add member. Project managers of this project and system_admin.
 * Target user must be active. System role viewer cannot be assigned as manager or member.
 */
projectsRouter.post(
  '/:id/members',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Step 1: Permission check
    if (!can(req.user!, 'project:manageMembers')) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
    }

    // Step 2: UUID validation
    if (!isValidUuid(req.params.id)) {
      return res.status(404).json({ error: 'not_found', message: 'Project not found' });
    }

    // Step 3: Project and membership check
    const project = await db.project.findUnique({
      where: { id: req.params.id },
    });
    if (!project) {
      return res.status(404).json({ error: 'not_found', message: 'Project not found' });
    }

    const isSystemAdmin = req.user!.systemRole === 'system_admin';
    if (!isSystemAdmin) {
      const callerMember = await db.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: req.params.id,
            userId: req.user!.id,
          },
        },
      });
      if (!callerMember) {
        return res.status(404).json({ error: 'not_found', message: 'Project not found' });
      }

      // Step 4: Manager check
      if (callerMember.projectRole !== 'manager') {
        return res.status(403).json({
          error: 'forbidden',
          message: 'Requires project manager role on this project',
        });
      }
    }

    // Validate body
    const parseResult = addProjectMemberSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid member data',
        details: parseResult.error.issues,
      });
    }

    const { userId, projectRole } = parseResult.data;

    // Check target user exists and is active
    const targetUser = await db.user.findUnique({
      where: { id: userId },
    });
    if (!targetUser || !targetUser.isActive) {
      return res.status(400).json({
        error: 'inactive_user',
        message: 'User does not exist or is inactive',
      });
    }

    // Viewer restriction: system role viewer cannot be manager or member
    if (targetUser.systemRole === 'viewer' && (projectRole === 'manager' || projectRole === 'member')) {
      return res.status(400).json({
        error: 'viewer_cannot_be_member_writer',
        message: 'Users with system role viewer cannot be assigned as manager or member',
      });
    }

    // Check duplicate member
    const existingMember = await db.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: req.params.id,
          userId,
        },
      },
    });
    if (existingMember) {
      return res.status(409).json({
        error: 'member_already_exists',
        message: 'User is already a member of this project',
      });
    }

    try {
      const newMember = await db.$transaction(async (tx) => {
        const m = await tx.projectMember.create({
          data: {
            projectId: req.params.id,
            userId,
            projectRole,
            addedByUserId: req.user!.id,
          },
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                username: true,
                systemRole: isSystemAdmin,
              },
            },
          },
        });

        await tx.auditLog.create({
          data: {
            actorUserId: req.user!.id,
            action: 'project_member.added',
            entityType: 'project',
            entityId: req.params.id,
            afterSnapshot: {
              targetUserId: userId,
              projectRole,
            },
            ipAddress: req.ip,
          },
        });

        return m;
      });

      return res.status(201).json(newMember);
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return res.status(409).json({
          error: 'member_already_exists',
          message: 'User is already a member of this project',
        });
      }
      throw err;
    }
  }),
);

/**
 * 6. DELETE /api/projects/:id/members/:userId
 * Remove member. Project managers of this project and system_admin.
 * In a transaction: locks project row (SELECT ... FOR UPDATE), re-reads target member,
 * counts active managers, refuses removing last active manager (409), audits removal.
 */
projectsRouter.delete(
  '/:id/members/:userId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Step 1: Permission check
    if (!can(req.user!, 'project:manageMembers')) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
    }

    // Step 2: UUID validation for :id and :userId
    if (!isValidUuid(req.params.id)) {
      return res.status(404).json({ error: 'not_found', message: 'Project not found' });
    }
    if (!isValidUuid(req.params.userId)) {
      return res.status(404).json({ error: 'not_found', message: 'Project member not found' });
    }

    // Step 3: Project and membership check
    const project = await db.project.findUnique({
      where: { id: req.params.id },
    });
    if (!project) {
      return res.status(404).json({ error: 'not_found', message: 'Project not found' });
    }

    const isSystemAdmin = req.user!.systemRole === 'system_admin';
    if (!isSystemAdmin) {
      const callerMember = await db.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: req.params.id,
            userId: req.user!.id,
          },
        },
      });
      if (!callerMember) {
        return res.status(404).json({ error: 'not_found', message: 'Project not found' });
      }

      // Step 4: Manager check
      if (callerMember.projectRole !== 'manager') {
        return res.status(403).json({
          error: 'forbidden',
          message: 'Requires project manager role on this project',
        });
      }
    }

    const transactionResult = await db.$transaction(async (tx) => {
      // Correctness 1: Lock the project row to serialize manager removals
      await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${req.params.id} FOR UPDATE`;

      // Addition 3: Re-read target member inside transaction after row lock
      const targetMember = await tx.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: req.params.id,
            userId: req.params.userId,
          },
        },
        include: {
          user: true,
        },
      });

      if (!targetMember) {
        return { notFound: true };
      }

      // Check last-manager invariant: count active managers only
      if (targetMember.projectRole === 'manager') {
        const activeManagersCount = await tx.projectMember.count({
          where: {
            projectId: req.params.id,
            projectRole: 'manager',
            user: {
              isActive: true,
            },
          },
        });

        // Refuse if removing an active manager and they are the last active manager
        if (targetMember.user.isActive && activeManagersCount <= 1) {
          return { lastManager: true };
        }
      }

      await tx.projectMember.delete({
        where: {
          projectId_userId: {
            projectId: req.params.id,
            userId: req.params.userId,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: req.user!.id,
          action: 'project_member.removed',
          entityType: 'project',
          entityId: req.params.id,
          beforeSnapshot: {
            targetUserId: req.params.userId,
            projectRole: targetMember.projectRole,
          },
          ipAddress: req.ip,
        },
      });

      return { success: true };
    });

    if (transactionResult.notFound) {
      return res.status(404).json({ error: 'not_found', message: 'Project member not found' });
    }

    if (transactionResult.lastManager) {
      return res.status(409).json({
        error: 'last_manager_required',
        message: 'Cannot remove the last active manager of the project',
      });
    }

    return res.status(200).json({ success: true });
  }),
);

/**
 * 7. POST /api/projects/:id/status
 * Change project status. Project managers of this project and system_admin.
 * Requires trimmed non-empty reason. Same-status transitions refused (400).
 * Atomic updateMany with status concurrency check -> 409 conflict_retry.
 * ProjectStatusEvent and AuditLog written in same transaction.
 */
projectsRouter.post(
  '/:id/status',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Step 1: Permission check
    if (!can(req.user!, 'project:changeStatus')) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
    }

    // Step 2: UUID validation
    if (!isValidUuid(req.params.id)) {
      return res.status(404).json({ error: 'not_found', message: 'Project not found' });
    }

    // Step 3: Project and membership check
    const project = await db.project.findUnique({
      where: { id: req.params.id },
    });
    if (!project) {
      return res.status(404).json({ error: 'not_found', message: 'Project not found' });
    }

    const isSystemAdmin = req.user!.systemRole === 'system_admin';
    if (!isSystemAdmin) {
      const callerMember = await db.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: req.params.id,
            userId: req.user!.id,
          },
        },
      });
      if (!callerMember) {
        return res.status(404).json({ error: 'not_found', message: 'Project not found' });
      }

      // Step 4: Manager check
      if (callerMember.projectRole !== 'manager') {
        return res.status(403).json({
          error: 'forbidden',
          message: 'Requires project manager role on this project',
        });
      }
    }

    // Validate payload
    const parseResult = changeProjectStatusSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid status change payload',
        details: parseResult.error.issues,
      });
    }

    const { status: toStatus, reason } = parseResult.data;
    const fromStatus = project.status;

    // Refuse same status change
    if (toStatus === fromStatus) {
      return res.status(400).json({
        error: 'same_status',
        message: 'Project is already in this status',
      });
    }

    // Addition 2: Atomic updateMany concurrency check in 1 transaction
    const transactionResult = await db.$transaction(async (tx) => {
      const updateRes = await tx.project.updateMany({
        where: {
          id: req.params.id,
          status: fromStatus,
        },
        data: {
          status: toStatus,
        },
      });

      if (updateRes.count === 0) {
        return { conflict: true };
      }

      const statusEvent = await tx.projectStatusEvent.create({
        data: {
          projectId: req.params.id,
          fromStatus,
          toStatus,
          reason,
          changedByUserId: req.user!.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: req.user!.id,
          action: 'project.status_changed',
          entityType: 'project',
          entityId: req.params.id,
          beforeSnapshot: {
            status: fromStatus,
          },
          afterSnapshot: {
            status: toStatus,
            reason,
          },
          ipAddress: req.ip,
        },
      });

      return { statusEvent };
    });

    if (transactionResult.conflict) {
      return res.status(409).json({
        error: 'conflict_retry',
        message: 'Project status was modified concurrently, please retry',
      });
    }

    return res.status(200).json({
      projectId: req.params.id,
      status: toStatus,
      event: transactionResult.statusEvent,
    });
  }),
);


/**
 * GET /api/projects/:id/summary
 * Membership-scoped project summary with status, progress, task counts, overdue/blocked, hours and upcoming milestones.
 * system_admin who is not a member can read.
 */
projectsRouter.get(
  '/:id/summary',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!can(req.user!, 'project:read')) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
    }

    const projectId = req.params['id'] as string;
    const access = await resolveProjectAccess(projectId, req.user!);
    if (access.notFound) {
      return res.status(404).json({ error: 'not_found', message: access.message ?? 'Project not found' });
    }

    // Tasks for progress, counts, overdue/blocked, estimated hours
    const tasks = await db.task.findMany({
      where: { projectId },
      select: {
        id: true,
        status: true,
        dueDate: true,
        estimatedHours: true,
        parentTaskId: true,
      },
    });

    const progress = calculateProjectProgress(tasks as any);

    const todayStr = getKathmanduTodayDateString();
    const todayUtc = parseDateOnlyUtc(todayStr);

    const taskCounts = {
      todo: 0,
      in_progress: 0,
      blocked: 0,
      done: 0,
    };

    let overdueCount = 0;
    let blockedCount = 0;
    let totalEstimated = 0;

    for (const t of tasks) {
      if (t.status in taskCounts) {
        taskCounts[t.status as keyof typeof taskCounts]++;
      }
      if (t.status === 'blocked') {
        blockedCount++;
      }
      if (t.dueDate && t.dueDate < todayUtc && t.status !== 'done') {
        overdueCount++;
      }
      if (t.estimatedHours) {
        totalEstimated += t.estimatedHours;
      }
    }

    const loggedAggregate = await db.timeLog.aggregate({
      where: { projectId },
      _sum: {
        hours: true,
      },
    });
    const totalLogged = loggedAggregate._sum.hours ?? 0;

    const upcomingMilestones = await db.milestone.findMany({
      where: {
        projectId,
        completedAt: null,
      },
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
      take: 5,
      select: {
        id: true,
        name: true,
        dueDate: true,
      },
    });

    return res.status(200).json({
      status: access.project!.status,
      progress,
      taskCounts,
      overdueCount,
      blockedCount,
      hours: {
        estimated: Math.round(totalEstimated * 100) / 100,
        logged: Math.round(totalLogged * 100) / 100,
      },
      upcomingMilestones,
    });
  }),
);

/**
 * GET /api/projects/:id/workload
 * Membership-scoped project workload query per member and bucket for unassigned/departed assignees.
 * loggedHours per person only for managers/admin; other members see their own row value and null for others.
 */
projectsRouter.get(
  '/:id/workload',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!can(req.user!, 'project:read')) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
    }

    const projectId = req.params['id'] as string;
    const access = await resolveProjectAccess(projectId, req.user!);
    if (access.notFound) {
      return res.status(404).json({ error: 'not_found', message: access.message ?? 'Project not found' });
    }

    const members = await db.projectMember.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            username: true,
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    const openTasks = await db.task.findMany({
      where: {
        projectId,
        status: { not: 'done' },
      },
      select: {
        id: true,
        assigneeUserId: true,
        estimatedHours: true,
      },
    });

    const timeLogsGroup = await db.timeLog.groupBy({
      by: ['userId'],
      where: { projectId },
      _sum: {
        hours: true,
      },
    });

    const loggedMap = new Map<string, number>();
    for (const tl of timeLogsGroup) {
      loggedMap.set(tl.userId, tl._sum.hours ?? 0);
    }

    const activeMemberUserIds = new Set(members.map((m) => m.userId));
    const openTasksCountMap = new Map<string, number>();
    const estimatedHoursMap = new Map<string, number>();

    let unassignedOrDepartedCount = 0;
    let unassignedOrDepartedEstimated = 0;

    for (const t of openTasks) {
      if (t.assigneeUserId && activeMemberUserIds.has(t.assigneeUserId)) {
        openTasksCountMap.set(
          t.assigneeUserId,
          (openTasksCountMap.get(t.assigneeUserId) ?? 0) + 1,
        );
        estimatedHoursMap.set(
          t.assigneeUserId,
          (estimatedHoursMap.get(t.assigneeUserId) ?? 0) + (t.estimatedHours ?? 0),
        );
      } else {
        unassignedOrDepartedCount++;
        unassignedOrDepartedEstimated += t.estimatedHours ?? 0;
      }
    }

    const canSeeAllLogged = access.isManager || access.isSystemAdmin;

    const memberWorkload = members.map((m) => {
      const logged = loggedMap.get(m.userId) ?? 0;
      let userLoggedHours: number | null = null;
      if (canSeeAllLogged) {
        userLoggedHours = Math.round(logged * 100) / 100;
      } else if (m.userId === req.user!.id) {
        userLoggedHours = Math.round(logged * 100) / 100;
      }

      return {
        userId: m.userId,
        displayName: m.user.displayName,
        username: m.user.username,
        projectRole: m.projectRole,
        openTasksCount: openTasksCountMap.get(m.userId) ?? 0,
        estimatedHours: Math.round((estimatedHoursMap.get(m.userId) ?? 0) * 100) / 100,
        loggedHours: userLoggedHours,
      };
    });

    return res.status(200).json({
      members: memberWorkload,
      unassignedOrDeparted: {
        openTasksCount: unassignedOrDepartedCount,
        estimatedHours: Math.round(unassignedOrDepartedEstimated * 100) / 100,
      },
    });
  }),
);
