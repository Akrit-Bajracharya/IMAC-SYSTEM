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
  createProjectMessageSchema,
  listProjectMessagesQuerySchema,
} from '@imac/shared';
import { resolveProjectAccess, isValidUuid, canEditTask } from '../services/projectAccess.js';

export const messagesRouter = Router({ mergeParams: true });

messagesRouter.use(requireAuth);
messagesRouter.use(requirePasswordChanged);

/**
 * 1. POST /api/projects/:id/messages
 * Post a project message.
 * Members with write rights (project viewers and system viewers refused 403).
 */
messagesRouter.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!can(req.user!, 'message:create')) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
    }

    const projectId = req.params['id'];
    const access = await resolveProjectAccess(projectId, req.user!);
    if (!access.project || (!access.member && !access.isSystemAdmin)) {
      return res.status(404).json({ error: 'not_found', message: 'Project not found' });
    }

    if (access.projectRole === 'viewer') {
      return res.status(403).json({
        error: 'forbidden',
        message: 'Project viewers cannot post messages',
      });
    }

    const parseResult = createProjectMessageSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid message body',
        details: parseResult.error.issues,
      });
    }

    const message = await db.projectMessage.create({
      data: {
        projectId,
        authorUserId: req.user!.id,
        body: parseResult.data.body,
        isPinned: false,
      },
      include: {
        authorUser: {
          select: { id: true, displayName: true, username: true },
        },
      },
    });

    return res.status(201).json(message);
  }),
);

/**
 * 2. GET /api/projects/:id/messages
 * List project messages.
 * Members only. Pinned first, then newest. Limit 50 with cursor.
 */
messagesRouter.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!can(req.user!, 'message:read')) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
    }

    const projectId = req.params['id'];
    const access = await resolveProjectAccess(projectId, req.user!);
    if (!access.project || (!access.member && !access.isSystemAdmin)) {
      return res.status(404).json({ error: 'not_found', message: 'Project not found' });
    }

    const parseQuery = listProjectMessagesQuerySchema.safeParse(req.query);
    if (!parseQuery.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid query parameters',
        details: parseQuery.error.issues,
      });
    }

    const { limit, cursor } = parseQuery.data;

    if (cursor) {
      const cursorMessage = await db.projectMessage.findFirst({
        where: { id: cursor, projectId },
      });
      if (!cursorMessage) {
        return res.status(400).json({
          error: 'invalid_cursor',
          message: 'Cursor not found in this project',
        });
      }
    }

    const takeCount = limit + 1;
    const messages = await db.projectMessage.findMany({
      where: { projectId },
      take: takeCount,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      include: {
        authorUser: {
          select: { id: true, displayName: true, username: true },
        },
      },
    });

    const hasMore = messages.length > limit;
    const items = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]!.id : null;

    return res.status(200).json({
      items,
      nextCursor,
      hasMore,
    });
  }),
);

/**
 * 3. POST /api/projects/:id/messages/:messageId/pin
 * Pin a project message.
 * Managers and system_admin only.
 */
messagesRouter.post(
  '/:messageId/pin',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!can(req.user!, 'message:pin')) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
    }

    const projectId = req.params['id'];
    const messageId = req.params['messageId'];

    const access = await resolveProjectAccess(projectId, req.user!);
    if (!access.project || (!access.member && !access.isSystemAdmin)) {
      return res.status(404).json({ error: 'not_found', message: 'Project not found' });
    }

    if (!access.isManager) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'Only project managers or system_admin can pin messages',
      });
    }

    if (!isValidUuid(messageId)) {
      return res.status(404).json({ error: 'not_found', message: 'Message not found' });
    }

    const message = await db.projectMessage.findFirst({
      where: { id: messageId, projectId },
    });
    if (!message) {
      return res.status(404).json({ error: 'not_found', message: 'Message not found' });
    }

    const updated = await db.$transaction(async (tx) => {
      const msg = await tx.projectMessage.update({
        where: { id: messageId },
        data: { isPinned: true },
        include: {
          authorUser: {
            select: { id: true, displayName: true, username: true },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: req.user!.id,
          action: 'project_message.pinned',
          entityType: 'ProjectMessage',
          entityId: messageId,
          ipAddress: req.ip,
          beforeSnapshot: { isPinned: message.isPinned },
          afterSnapshot: { isPinned: true },
        },
      });

      return msg;
    });

    return res.status(200).json({ ok: true, message: updated });
  }),
);

/**
 * 4. POST /api/projects/:id/messages/:messageId/unpin
 * Unpin a project message.
 * Managers and system_admin only.
 */
messagesRouter.post(
  '/:messageId/unpin',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!can(req.user!, 'message:pin')) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
    }

    const projectId = req.params['id'];
    const messageId = req.params['messageId'];

    const access = await resolveProjectAccess(projectId, req.user!);
    if (!access.project || (!access.member && !access.isSystemAdmin)) {
      return res.status(404).json({ error: 'not_found', message: 'Project not found' });
    }

    if (!access.isManager) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'Only project managers or system_admin can unpin messages',
      });
    }

    if (!isValidUuid(messageId)) {
      return res.status(404).json({ error: 'not_found', message: 'Message not found' });
    }

    const message = await db.projectMessage.findFirst({
      where: { id: messageId, projectId },
    });
    if (!message) {
      return res.status(404).json({ error: 'not_found', message: 'Message not found' });
    }

    const updated = await db.$transaction(async (tx) => {
      const msg = await tx.projectMessage.update({
        where: { id: messageId },
        data: { isPinned: false },
        include: {
          authorUser: {
            select: { id: true, displayName: true, username: true },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: req.user!.id,
          action: 'project_message.unpinned',
          entityType: 'ProjectMessage',
          entityId: messageId,
          ipAddress: req.ip,
          beforeSnapshot: { isPinned: message.isPinned },
          afterSnapshot: { isPinned: false },
        },
      });

      return msg;
    });

    return res.status(200).json({ ok: true, message: updated });
  }),
);

/**
 * 5. POST /api/projects/:id/messages/:messageId/to-task
 * Converts a project message to a task in one transaction.
 * Creates exactly ONE task (title from first line trimmed to 200 chars, description from body).
 * Second call returns 409 already_converted.
 * Audited without message body.
 */
messagesRouter.post(
  '/:messageId/to-task',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!can(req.user!, 'task:write')) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
    }

    const projectId = req.params['id'];
    const messageId = req.params['messageId'];

    const access = await resolveProjectAccess(projectId, req.user!);
    if (!access.project || (!access.member && !access.isSystemAdmin)) {
      return res.status(404).json({ error: 'not_found', message: 'Project not found' });
    }

    if (!canEditTask(access.projectRole, access.isSystemAdmin ?? false, 'create', null, req.user!.id)) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'You are not authorized to create tasks in this project',
      });
    }

    if (!isValidUuid(messageId)) {
      return res.status(404).json({ error: 'not_found', message: 'Message not found' });
    }

    const message = await db.projectMessage.findFirst({
      where: { id: messageId, projectId },
    });
    if (!message) {
      return res.status(404).json({ error: 'not_found', message: 'Message not found' });
    }

    const result = await db.$transaction(async (tx) => {
      // Transaction advisory lock on message conversion to avoid concurrent duplication
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'to-task:' + messageId}))`;

      // Check if message was already converted
      const existingConversion = await tx.auditLog.findFirst({
        where: {
          action: 'project_message.converted_to_task',
          entityId: messageId,
        },
      });

      if (existingConversion) {
        return { conflict: true };
      }

      const firstLine = message.body.split(/\r?\n/)[0]?.trim() || 'Untitled Task';
      const title = firstLine.slice(0, 200);
      const description = message.body;

      const task = await tx.task.create({
        data: {
          projectId,
          title,
          description,
          status: 'todo',
          createdByUserId: req.user!.id,
        },
      });

      // Audit conversion without message body
      await tx.auditLog.create({
        data: {
          actorUserId: req.user!.id,
          action: 'project_message.converted_to_task',
          entityType: 'ProjectMessage',
          entityId: messageId,
          ipAddress: req.ip,
          afterSnapshot: {
            taskId: task.id,
            title: task.title,
          },
        },
      });

      // Audit task creation without body/description
      await tx.auditLog.create({
        data: {
          actorUserId: req.user!.id,
          action: 'task.created',
          entityType: 'Task',
          entityId: task.id,
          ipAddress: req.ip,
          afterSnapshot: {
            title: task.title,
            status: task.status,
            projectId: task.projectId,
            fromMessageId: messageId,
          },
        },
      });

      return { task };
    });

    if ('conflict' in result && result.conflict) {
      return res.status(409).json({
        error: 'already_converted',
        message: 'Message has already been converted to a task',
      });
    }

    return res.status(201).json({
      ok: true,
      task: result.task,
    });
  }),
);
