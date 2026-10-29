import { Router, type Response } from 'express';
import { db } from '../db.js';
import { requireAuth, requirePasswordChanged, type AuthRequest } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { can } from '../lib/permissions.js';
import {
  createTimeLogSchema,
  patchTimeLogSchema,
  listTimeLogsQuerySchema,
} from '@imac/shared';
import {
  getKathmanduTodayDateString,
  parseDateOnlyUtc,
  validateKathmanduDateRange,
} from '../services/workLog.js';
import { isValidUuid, resolveProjectAccess } from '../services/projectAccess.js';

export const timeLogsRouter = Router({ mergeParams: true });

timeLogsRouter.use(requireAuth);
timeLogsRouter.use(requirePasswordChanged);

/**
 * 1. POST /api/projects/:id/time-logs
 * Log time on a project task.
 * Rules:
 * - Must be a project member with manager or member role (viewer denied with 403).
 * - system_admin has NO membership bypass for logging time (must be added as a member first; 404 if not).
 * - task, if given, must belong to this project (400 invalid_task).
 * - workDate between [-90 days, +1 day] relative to Asia/Kathmandu today (400 invalid_date_range).
 * - hours in 0.25 steps, > 0.
 * - Total logged hours for this user on workDate across ALL projects must not exceed 24 (400 daily_hours_exceeded).
 * - Concurrency: take pg_advisory_xact_lock(hashtext(userId || ':' || workDate)) before summing.
 * - Audit log: time_log.created (snapshots must omit note).
 */
timeLogsRouter.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Step 1: Permission check
    if (!can(req.user!, 'timeLog:write')) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
    }

    const projectId = req.params['id'] as string;
    if (!isValidUuid(projectId)) {
      return res.status(404).json({ error: 'not_found', message: 'Project not found' });
    }

    // Step 2 & 3: Project existence and membership lookup
    const project = await db.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      return res.status(404).json({ error: 'not_found', message: 'Project not found' });
    }

    // Explicit ProjectMember check: system_admin gets NO membership bypass for logging time
    const member = await db.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: req.user!.id,
        },
      },
    });

    if (!member) {
      return res.status(404).json({
        error: 'not_found',
        message: 'You must be a member of this project to log time',
      });
    }

    // Viewer restriction
    if (member.projectRole === 'viewer') {
      return res.status(403).json({
        error: 'forbidden',
        message: 'Viewers cannot log time on projects',
      });
    }

    // Step 4: Validate request body
    const parseResult = createTimeLogSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid time log data',
        details: parseResult.error.issues,
      });
    }

    const { taskId, workDate, hours, note } = parseResult.data;

    // Date range validation in Asia/Kathmandu
    const dateValidation = validateKathmanduDateRange(workDate);
    if (!dateValidation.valid) {
      return res.status(400).json({
        error: 'invalid_date_range',
        message: dateValidation.reason,
      });
    }

    const parsedWorkDate = parseDateOnlyUtc(workDate);

    // Validate task if provided
    if (taskId) {
      const task = await db.task.findUnique({
        where: { id: taskId },
      });
      if (!task || task.projectId !== projectId) {
        return res.status(400).json({
          error: 'invalid_task',
          message: 'Task does not belong to this project',
        });
      }
    }

    // Execute in transaction with advisory lock and daily 24h cap check
    const lockKey = `${req.user!.id}:${workDate}`;

    const timeLog = await db.$transaction(async (tx) => {
      // Row/advisory lock for userId + workDate
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      // Aggregate existing hours for this user on this date across all projects
      const aggregateResult = await tx.timeLog.aggregate({
        where: {
          userId: req.user!.id,
          workDate: parsedWorkDate,
        },
        _sum: {
          hours: true,
        },
      });

      const currentDayHours = aggregateResult._sum.hours ?? 0;
      if (currentDayHours + hours > 24) {
        throw new Error('DAILY_HOURS_EXCEEDED');
      }

      const created = await tx.timeLog.create({
        data: {
          projectId,
          userId: req.user!.id,
          taskId: taskId ?? null,
          workDate: parsedWorkDate,
          hours,
          note: note ?? null,
        },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              username: true,
            },
          },
          task: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      // Audit snapshot must NOT contain note
      await tx.auditLog.create({
        data: {
          actorUserId: req.user!.id,
          action: 'time_log.created',
          entityType: 'time_log',
          entityId: created.id,
          afterSnapshot: {
            projectId,
            taskId: taskId ?? null,
            workDate,
            hours,
          },
          ipAddress: req.ip,
        },
      });

      return created;
    }).catch((err) => {
      if (err.message === 'DAILY_HOURS_EXCEEDED') {
        return { error: 'daily_hours_exceeded' as const };
      }
      throw err;
    });

    if ('error' in timeLog && timeLog.error === 'daily_hours_exceeded') {
      return res.status(400).json({
        error: 'daily_hours_exceeded',
        message: 'Total logged hours for this day across all projects cannot exceed 24',
      });
    }

    return res.status(201).json(timeLog);
  }),
);

/**
 * 2. GET /api/projects/:id/time-logs
 * List time logs.
 * Rules:
 * - system_admin (member or not) and project managers see all logs of the project.
 * - Members and project viewers see only their own logs.
 * - The userId filter is honored for managers/admin only; any other caller passing a userId other than their own gets 403.
 */
timeLogsRouter.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!can(req.user!, 'timeLog:read')) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
    }

    const projectId = req.params['id'] as string;
    const access = await resolveProjectAccess(projectId, req.user!);
    if (access.notFound) {
      return res.status(404).json({ error: 'not_found', message: access.message ?? 'Project not found' });
    }

    const parseQuery = listTimeLogsQuerySchema.safeParse(req.query);
    if (!parseQuery.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid query parameters',
        details: parseQuery.error.issues,
      });
    }

    const { limit, cursor, userId, taskId } = parseQuery.data;

    const canSeeAll = access.isManager || access.isSystemAdmin;

    if (!canSeeAll) {
      // Non-manager member / viewer passing another userId gets 403
      if (userId && userId !== req.user!.id) {
        return res.status(403).json({
          error: 'forbidden',
          message: 'You may only view your own time logs',
        });
      }
    }

    const where: any = {
      projectId,
    };

    if (canSeeAll) {
      if (userId) {
        where.userId = userId;
      }
    } else {
      where.userId = req.user!.id;
    }

    if (taskId) {
      where.taskId = taskId;
    }

    // Cursor validation
    if (cursor) {
      const cursorLog = await db.timeLog.findFirst({
        where: { id: cursor, projectId },
      });
      if (!cursorLog) {
        return res.status(400).json({
          error: 'invalid_cursor',
          message: 'Cursor not found in this project',
        });
      }
    }

    const takeCount = limit + 1;
    const logs = await db.timeLog.findMany({
      where,
      take: takeCount,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            username: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    const hasMore = logs.length > limit;
    const items = hasMore ? logs.slice(0, limit) : logs;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]!.id : null;

    return res.status(200).json({
      items,
      nextCursor,
      hasMore,
    });
  }),
);

/**
 * 3. PATCH /api/projects/:id/time-logs/:timeLogId
 * Edit time log.
 * Rules:
 * - Check order: can(), UUID, membership (404), role, body validation, resource lookup.
 * - Log must belong to the project in the URL (404), then ownership (403).
 * - Exclude current log when verifying daily 24h cap.
 * - Audit log: time_log.updated (snapshots omit note).
 */
timeLogsRouter.patch(
  '/:timeLogId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // 1. Permission check
    if (!can(req.user!, 'timeLog:write')) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
    }

    const projectId = req.params['id'] as string;
    const timeLogId = req.params['timeLogId'] as string;

    // 2. UUID validation
    if (!isValidUuid(projectId) || !isValidUuid(timeLogId)) {
      return res.status(404).json({ error: 'not_found', message: 'Time log not found' });
    }

    // 3. Membership lookup
    const access = await resolveProjectAccess(projectId, req.user!);
    if (access.notFound) {
      return res.status(404).json({ error: 'not_found', message: access.message ?? 'Project not found' });
    }

    // 4. Role check (viewer cannot write)
    if (access.projectRole === 'viewer') {
      return res.status(403).json({ error: 'forbidden', message: 'Viewers cannot modify time logs' });
    }

    // 5. Body validation
    const parseResult = patchTimeLogSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid time log update data',
        details: parseResult.error.issues,
      });
    }

    const data = parseResult.data;

    // 6. Resource lookup
    const existingLog = await db.timeLog.findUnique({
      where: { id: timeLogId },
    });

    if (!existingLog || existingLog.projectId !== projectId) {
      return res.status(404).json({ error: 'not_found', message: 'Time log not found' });
    }

    // Ownership check
    if (existingLog.userId !== req.user!.id) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'You can only edit your own time logs',
      });
    }

    // Date range validation if workDate changed
    const targetWorkDateStr = data.workDate ?? existingLog.workDate.toISOString().split('T')[0]!;
    if (data.workDate) {
      const dateValidation = validateKathmanduDateRange(data.workDate);
      if (!dateValidation.valid) {
        return res.status(400).json({
          error: 'invalid_date_range',
          message: dateValidation.reason,
        });
      }
    }
    const targetWorkDate = parseDateOnlyUtc(targetWorkDateStr);

    // Validate task if provided and changed
    if (data.taskId !== undefined && data.taskId !== null && data.taskId !== existingLog.taskId) {
      const task = await db.task.findUnique({
        where: { id: data.taskId },
      });
      if (!task || task.projectId !== projectId) {
        return res.status(400).json({
          error: 'invalid_task',
          message: 'Task does not belong to this project',
        });
      }
    }

    const targetHours = data.hours !== undefined ? data.hours : existingLog.hours;
    const lockKey = `${req.user!.id}:${targetWorkDateStr}`;

    const updated = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      // Aggregate existing hours on targetWorkDate excluding this timeLog
      const aggregateResult = await tx.timeLog.aggregate({
        where: {
          userId: req.user!.id,
          workDate: targetWorkDate,
          id: {
            not: timeLogId,
          },
        },
        _sum: {
          hours: true,
        },
      });

      const otherHours = aggregateResult._sum.hours ?? 0;
      if (otherHours + targetHours > 24) {
        throw new Error('DAILY_HOURS_EXCEEDED');
      }

      const updateData: any = {};
      if (data.taskId !== undefined) updateData.taskId = data.taskId;
      if (data.workDate !== undefined) updateData.workDate = targetWorkDate;
      if (data.hours !== undefined) updateData.hours = data.hours;
      if (data.note !== undefined) updateData.note = data.note;

      const log = await tx.timeLog.update({
        where: { id: timeLogId },
        data: updateData,
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              username: true,
            },
          },
          task: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: req.user!.id,
          action: 'time_log.updated',
          entityType: 'time_log',
          entityId: timeLogId,
          beforeSnapshot: {
            taskId: existingLog.taskId,
            workDate: existingLog.workDate.toISOString().split('T')[0],
            hours: existingLog.hours,
          },
          afterSnapshot: {
            taskId: log.taskId,
            workDate: targetWorkDateStr,
            hours: log.hours,
          },
          ipAddress: req.ip,
        },
      });

      return log;
    }).catch((err) => {
      if (err.message === 'DAILY_HOURS_EXCEEDED') {
        return { error: 'daily_hours_exceeded' as const };
      }
      throw err;
    });

    if ('error' in updated && updated.error === 'daily_hours_exceeded') {
      return res.status(400).json({
        error: 'daily_hours_exceeded',
        message: 'Total logged hours for this day across all projects cannot exceed 24',
      });
    }

    return res.status(200).json(updated);
  }),
);

/**
 * 4. DELETE /api/projects/:id/time-logs/:timeLogId
 * Delete own time log.
 * Rules:
 * - Check order: can(), UUID, membership (404), role, resource lookup (404), ownership (403).
 * - Audit log: time_log.removed (snapshots omit note).
 */
timeLogsRouter.delete(
  '/:timeLogId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // 1. Permission check
    if (!can(req.user!, 'timeLog:write')) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
    }

    const projectId = req.params['id'] as string;
    const timeLogId = req.params['timeLogId'] as string;

    // 2. UUID validation
    if (!isValidUuid(projectId) || !isValidUuid(timeLogId)) {
      return res.status(404).json({ error: 'not_found', message: 'Time log not found' });
    }

    // 3. Membership lookup
    const access = await resolveProjectAccess(projectId, req.user!);
    if (access.notFound) {
      return res.status(404).json({ error: 'not_found', message: access.message ?? 'Project not found' });
    }

    // 4. Role check
    if (access.projectRole === 'viewer') {
      return res.status(403).json({ error: 'forbidden', message: 'Viewers cannot delete time logs' });
    }

    // 5. Resource lookup
    const existingLog = await db.timeLog.findUnique({
      where: { id: timeLogId },
    });

    if (!existingLog || existingLog.projectId !== projectId) {
      return res.status(404).json({ error: 'not_found', message: 'Time log not found' });
    }

    // Ownership check
    if (existingLog.userId !== req.user!.id) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'You can only delete your own time logs',
      });
    }

    await db.$transaction(async (tx) => {
      await tx.timeLog.delete({
        where: { id: timeLogId },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: req.user!.id,
          action: 'time_log.removed',
          entityType: 'time_log',
          entityId: timeLogId,
          beforeSnapshot: {
            taskId: existingLog.taskId,
            workDate: existingLog.workDate.toISOString().split('T')[0],
            hours: existingLog.hours,
          },
          ipAddress: req.ip,
        },
      });
    });

    return res.status(200).json({ success: true });
  }),
);
