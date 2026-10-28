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
  createTaskSchema,
  patchTaskSchema,
  changeTaskStatusSchema,
  listTasksQuerySchema,
  createTaskDependencySchema,
  createCommentSchema,
  patchCommentSchema,
  listCommentsQuerySchema,
} from '@imac/shared';
import {
  parseDateOnlyUtc,
  getKathmanduTodayDateString,
} from '../services/workLog.js';
import {
  resolveProjectAccess,
  isValidUuid,
  canEditTask,
} from '../services/projectAccess.js';

export const tasksRouter = Router({ mergeParams: true });

tasksRouter.use(requireAuth);
tasksRouter.use(requirePasswordChanged);

/**
 * Validates whether a user is currently an active member of this project
 * with projectRole 'manager' or 'member' (not 'viewer').
 */
async function isValidActiveAssignee(projectId: string, userId: string): Promise<boolean> {
  const member = await db.projectMember.findUnique({
    where: {
      projectId_userId: { projectId, userId },
    },
    include: { user: true },
  });
  if (!member || !member.user.isActive) {
    return false;
  }
  return member.projectRole === 'manager' || member.projectRole === 'member';
}

/**
 * Traverses the dependency graph with row locking and a visited set up to maxDepth (50).
 * Returns true if a path exists from startTaskId to targetTaskId (indicating a cycle).
 * Throws DEPTH_LIMIT_EXCEEDED if depth >= 50.
 */
async function checkDependencyCycle(
  tx: any,
  startTaskId: string,
  targetTaskId: string,
  maxDepth = 50,
): Promise<boolean> {
  const visited = new Set<string>();
  const queue: { id: string; depth: number }[] = [{ id: startTaskId, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.id === targetTaskId) {
      return true;
    }
    if (current.depth >= maxDepth) {
      throw new Error('DEPTH_LIMIT_EXCEEDED');
    }
    if (!visited.has(current.id)) {
      visited.add(current.id);
      const outgoingDeps = await tx.taskDependency.findMany({
        where: { taskId: current.id },
        select: { dependsOnTaskId: true },
      });
      for (const d of outgoingDeps) {
        if (!visited.has(d.dependsOnTaskId)) {
          queue.push({ id: d.dependsOnTaskId, depth: current.depth + 1 });
        }
      }
    }
  }
  return false;
}

/**
 * 1. GET /api/projects/:id/tasks
 * List tasks with filters and pagination.
 */
tasksRouter.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!can(req.user!, 'task:read')) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
    }

    const projectId = req.params['id'] as string;
    const access = await resolveProjectAccess(projectId, req.user!);
    if (access.notFound) {
      return res.status(404).json({ error: 'not_found', message: access.message ?? 'Project not found' });
    }

    const parseQuery = listTasksQuerySchema.safeParse(req.query);
    if (!parseQuery.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid query parameters',
        details: parseQuery.error.issues,
      });
    }

    const { status, assigneeUserId, milestoneId, parentTaskId, topLevelOnly, overdue, limit, cursor } =
      parseQuery.data;

    // Validate cursor belongs to this project if provided
    if (cursor) {
      const cursorTask = await db.task.findFirst({
        where: { id: cursor, projectId },
      });
      if (!cursorTask) {
        return res.status(400).json({
          error: 'invalid_cursor',
          message: 'Cursor not found in this project',
        });
      }
    }

    const where: any = { projectId };
    if (status) where.status = status;
    if (assigneeUserId) where.assigneeUserId = assigneeUserId;
    if (milestoneId) where.milestoneId = milestoneId;
    if (topLevelOnly) {
      where.parentTaskId = null;
    } else if (parentTaskId) {
      where.parentTaskId = parentTaskId;
    }

    if (overdue) {
      const todayStr = getKathmanduTodayDateString();
      const todayUtc = parseDateOnlyUtc(todayStr);
      where.dueDate = { lt: todayUtc };
      where.status = { not: 'done' };
    }

    const takeCount = limit + 1;
    const tasks = await db.task.findMany({
      where,
      take: takeCount,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        milestone: { select: { id: true, name: true, dueDate: true, completedAt: true } },
        _count: { select: { subtasks: true, comments: true } },
      },
    });

    const hasMore = tasks.length > limit;
    const items = hasMore ? tasks.slice(0, limit) : tasks;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]!.id : null;

    // Fetch active project members to populate assigneeIsProjectMember
    const projectMembers = await db.projectMember.findMany({
      where: { projectId },
      select: { userId: true },
    });
    const memberIds = new Set(projectMembers.map((m) => m.userId));

    const formattedItems = items.map((t) => ({
      ...t,
      assigneeIsProjectMember: t.assigneeUserId ? memberIds.has(t.assigneeUserId) : false,
    }));

    return res.status(200).json({
      items: formattedItems,
      nextCursor,
      hasMore,
    });
  }),
);

/**
 * 2. POST /api/projects/:id/tasks
 * Create task.
 */
tasksRouter.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!can(req.user!, 'task:write')) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
    }

    const projectId = req.params['id'] as string;
    const access = await resolveProjectAccess(projectId, req.user!);
    if (access.notFound) {
      return res.status(404).json({ error: 'not_found', message: access.message ?? 'Project not found' });
    }

    if (!canEditTask(access.projectRole, access.isSystemAdmin!, 'create')) {
      return res.status(403).json({ error: 'forbidden', message: 'Viewers cannot create tasks' });
    }

    const parseResult = createTaskSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid task data',
        details: parseResult.error.issues,
      });
    }

    const data = parseResult.data;

    // Validate parentTaskId belongs to this project (404 if not), then 1-level rule (400)
    if (data.parentTaskId) {
      const parentTask = await db.task.findUnique({
        where: { id: data.parentTaskId },
      });
      if (!parentTask || parentTask.projectId !== projectId) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Parent task not found in this project',
        });
      }
      if (parentTask.parentTaskId !== null) {
        return res.status(400).json({
          error: 'invalid_subtask_nesting',
          message: 'Subtasks can only be one level deep',
        });
      }
    }

    // Validate milestoneId belongs to this project (400)
    if (data.milestoneId) {
      const milestone = await db.milestone.findUnique({
        where: { id: data.milestoneId },
      });
      if (!milestone || milestone.projectId !== projectId) {
        return res.status(400).json({
          error: 'invalid_milestone',
          message: 'Milestone does not belong to this project',
        });
      }
    }

    // Validate assigneeUserId is active member with manager or member role (400)
    if (data.assigneeUserId) {
      const valid = await isValidActiveAssignee(projectId, data.assigneeUserId);
      if (!valid) {
        return res.status(400).json({
          error: 'invalid_assignee',
          message: 'Assignee must be an active project member with role manager or member',
        });
      }
    }

    const result = await db.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          projectId,
          title: data.title,
          description: data.description ?? null,
          dueDate: data.dueDate ? parseDateOnlyUtc(data.dueDate) : null,
          estimatedHours: data.estimatedHours ?? null,
          assigneeUserId: data.assigneeUserId ?? null,
          milestoneId: data.milestoneId ?? null,
          parentTaskId: data.parentTaskId ?? null,
          status: 'todo',
          createdByUserId: req.user!.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: req.user!.id,
          action: 'task.created',
          entityType: 'task',
          entityId: task.id,
          afterSnapshot: {
            title: task.title,
            status: task.status,
            dueDate: task.dueDate,
            estimatedHours: task.estimatedHours,
            milestoneId: task.milestoneId,
            parentTaskId: task.parentTaskId,
          },
          ipAddress: req.ip,
        },
      });

      if (data.assigneeUserId) {
        await tx.auditLog.create({
          data: {
            actorUserId: req.user!.id,
            action: 'task.assigned',
            entityType: 'task',
            entityId: task.id,
            afterSnapshot: {
              assigneeUserId: data.assigneeUserId,
            },
            ipAddress: req.ip,
          },
        });
      }

      return task;
    });

    return res.status(201).json({
      ...result,
      assigneeIsProjectMember: result.assigneeUserId ? true : false,
    });
  }),
);

/**
 * 3. GET /api/projects/:id/tasks/:taskId
 * Task detail.
 */
tasksRouter.get(
  '/:taskId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!can(req.user!, 'task:read')) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
    }

    const projectId = req.params['id'] as string;
    const access = await resolveProjectAccess(projectId, req.user!);
    if (access.notFound) {
      return res.status(404).json({ error: 'not_found', message: access.message ?? 'Project not found' });
    }

    const taskId = req.params['taskId'] as string;
    if (!isValidUuid(taskId)) {
      return res.status(404).json({ error: 'not_found', message: 'Task not found' });
    }

    const task = await db.task.findUnique({
      where: { id: taskId },
      include: {
        milestone: true,
        subtasks: {
          orderBy: { createdAt: 'asc' },
        },
        dependencies: {
          include: {
            dependsOnTask: {
              select: { id: true, title: true, status: true, dueDate: true },
            },
          },
        },
        dependentOnMe: {
          include: {
            task: {
              select: { id: true, title: true, status: true, dueDate: true },
            },
          },
        },
        _count: {
          select: { comments: true },
        },
      },
    });

    if (!task || task.projectId !== projectId) {
      return res.status(404).json({ error: 'not_found', message: 'Task not found' });
    }

    let assigneeIsProjectMember = false;
    if (task.assigneeUserId) {
      const isMember = await db.projectMember.findUnique({
        where: {
          projectId_userId: { projectId, userId: task.assigneeUserId },
        },
      });
      assigneeIsProjectMember = !!isMember;
    }

    return res.status(200).json({
      ...task,
      commentCount: task._count.comments,
      assigneeIsProjectMember,
    });
  }),
);

/**
 * 4. PATCH /api/projects/:id/tasks/:taskId
 * Edit task.
 */
tasksRouter.patch(
  '/:taskId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!can(req.user!, 'task:write')) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
    }

    const projectId = req.params['id'] as string;
    const access = await resolveProjectAccess(projectId, req.user!);
    if (access.notFound) {
      return res.status(404).json({ error: 'not_found', message: access.message ?? 'Project not found' });
    }

    const taskId = req.params['taskId'] as string;
    if (!isValidUuid(taskId)) {
      return res.status(404).json({ error: 'not_found', message: 'Task not found' });
    }

    const task = await db.task.findUnique({
      where: { id: taskId },
    });
    if (!task || task.projectId !== projectId) {
      return res.status(404).json({ error: 'not_found', message: 'Task not found' });
    }

    if (!canEditTask(access.projectRole, access.isSystemAdmin!, 'edit', task, req.user!.id)) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'You do not have permission to edit this task',
      });
    }

    const parseResult = patchTaskSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid task update data',
        details: parseResult.error.issues,
      });
    }

    const data = parseResult.data;

    // Amendment 1: Validate assigneeUserId only when present in body AND different from stored value
    if (data.assigneeUserId !== undefined && data.assigneeUserId !== null && data.assigneeUserId !== task.assigneeUserId) {
      const valid = await isValidActiveAssignee(projectId, data.assigneeUserId);
      if (!valid) {
        return res.status(400).json({
          error: 'invalid_assignee',
          message: 'Assignee must be an active project member with role manager or member',
        });
      }
    }

    // Amendment 1: Validate milestoneId only when present in body AND different from stored value
    if (data.milestoneId !== undefined && data.milestoneId !== null && data.milestoneId !== task.milestoneId) {
      const milestone = await db.milestone.findUnique({
        where: { id: data.milestoneId },
      });
      if (!milestone || milestone.projectId !== projectId) {
        return res.status(400).json({
          error: 'invalid_milestone',
          message: 'Milestone does not belong to this project',
        });
      }
    }

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate ? parseDateOnlyUtc(data.dueDate) : null;
    }
    if (data.estimatedHours !== undefined) updateData.estimatedHours = data.estimatedHours;
    if (data.assigneeUserId !== undefined) updateData.assigneeUserId = data.assigneeUserId;
    if (data.milestoneId !== undefined) updateData.milestoneId = data.milestoneId;

    const updated = await db.$transaction(async (tx) => {
      const u = await tx.task.update({
        where: { id: taskId },
        data: updateData,
      });

      await tx.auditLog.create({
        data: {
          actorUserId: req.user!.id,
          action: 'task.updated',
          entityType: 'task',
          entityId: u.id,
          beforeSnapshot: {
            title: task.title,
            dueDate: task.dueDate,
            estimatedHours: task.estimatedHours,
            milestoneId: task.milestoneId,
          },
          afterSnapshot: {
            title: u.title,
            dueDate: u.dueDate,
            estimatedHours: u.estimatedHours,
            milestoneId: u.milestoneId,
          },
          ipAddress: req.ip,
        },
      });

      if (data.assigneeUserId !== undefined && data.assigneeUserId !== task.assigneeUserId) {
        await tx.auditLog.create({
          data: {
            actorUserId: req.user!.id,
            action: 'task.assigned',
            entityType: 'task',
            entityId: u.id,
            beforeSnapshot: { assigneeUserId: task.assigneeUserId },
            afterSnapshot: { assigneeUserId: u.assigneeUserId },
            ipAddress: req.ip,
          },
        });
      }

      return u;
    });

    let assigneeIsProjectMember = false;
    if (updated.assigneeUserId) {
      const isMember = await db.projectMember.findUnique({
        where: {
          projectId_userId: { projectId, userId: updated.assigneeUserId },
        },
      });
      assigneeIsProjectMember = !!isMember;
    }

    return res.status(200).json({
      ...updated,
      assigneeIsProjectMember,
    });
  }),
);

/**
 * 5. POST /api/projects/:id/tasks/:taskId/status
 * Change task status.
 */
tasksRouter.post(
  '/:taskId/status',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!can(req.user!, 'task:write')) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
    }

    const projectId = req.params['id'] as string;
    const access = await resolveProjectAccess(projectId, req.user!);
    if (access.notFound) {
      return res.status(404).json({ error: 'not_found', message: access.message ?? 'Project not found' });
    }

    const taskId = req.params['taskId'] as string;
    if (!isValidUuid(taskId)) {
      return res.status(404).json({ error: 'not_found', message: 'Task not found' });
    }

    const task = await db.task.findUnique({
      where: { id: taskId },
    });
    if (!task || task.projectId !== projectId) {
      return res.status(404).json({ error: 'not_found', message: 'Task not found' });
    }

    if (!canEditTask(access.projectRole, access.isSystemAdmin!, 'changeStatus', task, req.user!.id)) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'You do not have permission to change status of this task',
      });
    }

    const parseResult = changeTaskStatusSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid task status data',
        details: parseResult.error.issues,
      });
    }

    const { status: toStatus } = parseResult.data;
    if (toStatus === task.status) {
      return res.status(400).json({
        error: 'same_status',
        message: 'Task is already in this status',
      });
    }

    const warnings: string[] = [];
    if (toStatus === 'done') {
      // Check tasks this task depends on (Amendment 10)
      const blockingDeps = await db.taskDependency.findMany({
        where: { taskId },
        include: { dependsOnTask: true },
      });
      const hasOpenDep = blockingDeps.some((d) => d.dependsOnTask.status !== 'done');
      if (hasOpenDep) {
        warnings.push('open_dependency');
      }

      // Check unfinished subtasks
      const unfinishedSubtasks = await db.task.findMany({
        where: { parentTaskId: taskId, status: { not: 'done' } },
      });
      if (unfinishedSubtasks.length > 0) {
        warnings.push('open_subtasks');
      }
    }

    const result = await db.$transaction(async (tx) => {
      const updateRes = await tx.task.updateMany({
        where: {
          id: taskId,
          projectId,
          status: task.status,
        },
        data: {
          status: toStatus,
        },
      });

      if (updateRes.count === 0) {
        return { conflict: true };
      }

      await tx.auditLog.create({
        data: {
          actorUserId: req.user!.id,
          action: 'task.status_changed',
          entityType: 'task',
          entityId: taskId,
          beforeSnapshot: { status: task.status },
          afterSnapshot: { status: toStatus },
          ipAddress: req.ip,
        },
      });

      return { success: true };
    });

    if (result.conflict) {
      return res.status(409).json({
        error: 'conflict_retry',
        message: 'Task status was modified concurrently, please retry',
      });
    }

    return res.status(200).json({
      taskId,
      status: toStatus,
      warnings,
    });
  }),
);

/**
 * 6. POST /api/projects/:id/tasks/:taskId/dependencies
 * Add dependency.
 */
tasksRouter.post(
  '/:taskId/dependencies',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!can(req.user!, 'task:write')) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
    }

    const projectId = req.params['id'] as string;
    const access = await resolveProjectAccess(projectId, req.user!);
    if (access.notFound) {
      return res.status(404).json({ error: 'not_found', message: access.message ?? 'Project not found' });
    }

    const taskId = req.params['taskId'] as string;
    if (!isValidUuid(taskId)) {
      return res.status(404).json({ error: 'not_found', message: 'Task not found' });
    }

    const task = await db.task.findUnique({
      where: { id: taskId },
    });
    if (!task || task.projectId !== projectId) {
      return res.status(404).json({ error: 'not_found', message: 'Task not found' });
    }

    // Amendment 4: canEditTask manageDependencies
    if (!canEditTask(access.projectRole, access.isSystemAdmin!, 'manageDependencies', task, req.user!.id)) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'You do not have permission to manage dependencies on this task',
      });
    }

    const parseResult = createTaskDependencySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid dependency data',
        details: parseResult.error.issues,
      });
    }

    const { dependsOnTaskId } = parseResult.data;

    // Self dependency
    if (taskId === dependsOnTaskId) {
      return res.status(400).json({
        error: 'self_dependency',
        message: 'A task cannot depend on itself',
      });
    }

    // Target task check
    const targetTask = await db.task.findUnique({
      where: { id: dependsOnTaskId },
    });
    if (!targetTask || targetTask.projectId !== projectId) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Dependent task not found in this project',
      });
    }

    try {
      const dep = await db.$transaction(async (tx) => {
        // Amendment 3: Project row lock before cycle check
        await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${projectId} FOR UPDATE`;

        // Check cycle: adding (taskId -> dependsOnTaskId), check if dependsOnTaskId already reaches taskId
        const isCycle = await checkDependencyCycle(tx, dependsOnTaskId, taskId, 50);
        if (isCycle) {
          throw new Error('CYCLE_DETECTED');
        }

        const created = await tx.taskDependency.create({
          data: {
            taskId,
            dependsOnTaskId,
          },
        });

        await tx.auditLog.create({
          data: {
            actorUserId: req.user!.id,
            action: 'task_dependency.added',
            entityType: 'task',
            entityId: taskId,
            afterSnapshot: { dependsOnTaskId },
            ipAddress: req.ip,
          },
        });

        return created;
      });

      return res.status(201).json(dep);
    } catch (err: any) {
      if (err.message === 'CYCLE_DETECTED' || err.message === 'DEPTH_LIMIT_EXCEEDED') {
        return res.status(400).json({
          error: 'dependency_cycle',
          message: 'Adding this dependency would create a cycle or exceed maximum graph depth',
        });
      }
      if (err?.code === 'P2002') {
        return res.status(409).json({
          error: 'duplicate_dependency',
          message: 'Dependency already exists',
        });
      }
      throw err;
    }
  }),
);

/**
 * 7. DELETE /api/projects/:id/tasks/:taskId/dependencies/:dependsOnTaskId
 * Remove dependency.
 */
tasksRouter.delete(
  '/:taskId/dependencies/:dependsOnTaskId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!can(req.user!, 'task:write')) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
    }

    const projectId = req.params['id'] as string;
    const access = await resolveProjectAccess(projectId, req.user!);
    if (access.notFound) {
      return res.status(404).json({ error: 'not_found', message: access.message ?? 'Project not found' });
    }

    const taskId = req.params['taskId'] as string;
    const dependsOnTaskId = req.params['dependsOnTaskId'] as string;

    if (!isValidUuid(taskId) || !isValidUuid(dependsOnTaskId)) {
      return res.status(404).json({ error: 'not_found', message: 'Task not found' });
    }

    const task = await db.task.findUnique({
      where: { id: taskId },
    });
    if (!task || task.projectId !== projectId) {
      return res.status(404).json({ error: 'not_found', message: 'Task not found' });
    }

    if (!canEditTask(access.projectRole, access.isSystemAdmin!, 'manageDependencies', task, req.user!.id)) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'You do not have permission to manage dependencies on this task',
      });
    }

    const targetTask = await db.task.findUnique({
      where: { id: dependsOnTaskId },
    });
    if (!targetTask || targetTask.projectId !== projectId) {
      return res.status(404).json({ error: 'not_found', message: 'Dependent task not found' });
    }

    const dep = await db.taskDependency.findUnique({
      where: {
        taskId_dependsOnTaskId: { taskId, dependsOnTaskId },
      },
    });
    if (!dep) {
      return res.status(404).json({ error: 'not_found', message: 'Dependency not found' });
    }

    await db.$transaction(async (tx) => {
      await tx.taskDependency.delete({
        where: {
          taskId_dependsOnTaskId: { taskId, dependsOnTaskId },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: req.user!.id,
          action: 'task_dependency.removed',
          entityType: 'task',
          entityId: taskId,
          beforeSnapshot: { dependsOnTaskId },
          ipAddress: req.ip,
        },
      });
    });

    return res.status(200).json({ success: true });
  }),
);

/**
 * 8. GET /api/projects/:id/tasks/:taskId/comments
 * List comments.
 */
tasksRouter.get(
  '/:taskId/comments',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!can(req.user!, 'task:read')) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
    }

    const projectId = req.params['id'] as string;
    const access = await resolveProjectAccess(projectId, req.user!);
    if (access.notFound) {
      return res.status(404).json({ error: 'not_found', message: access.message ?? 'Project not found' });
    }

    const taskId = req.params['taskId'] as string;
    if (!isValidUuid(taskId)) {
      return res.status(404).json({ error: 'not_found', message: 'Task not found' });
    }

    const task = await db.task.findUnique({
      where: { id: taskId },
    });
    if (!task || task.projectId !== projectId) {
      return res.status(404).json({ error: 'not_found', message: 'Task not found' });
    }

    const parseQuery = listCommentsQuerySchema.safeParse(req.query);
    if (!parseQuery.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid comment query parameters',
        details: parseQuery.error.issues,
      });
    }

    const { limit, cursor } = parseQuery.data;

    // Amendment 11: Cursor belongs to this taskId check
    if (cursor) {
      const cursorComment = await db.comment.findFirst({
        where: { id: cursor, taskId },
      });
      if (!cursorComment) {
        return res.status(400).json({
          error: 'invalid_cursor',
          message: 'Cursor not found in this task',
        });
      }
    }

    const takeCount = limit + 1;
    const isSystemAdmin = req.user!.systemRole === 'system_admin';

    const comments = await db.comment.findMany({
      where: { taskId },
      take: takeCount,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: {
        authorUser: {
          select: {
            id: true,
            displayName: true,
            username: true,
            systemRole: isSystemAdmin,
          },
        },
      },
    });

    const hasMore = comments.length > limit;
    const items = hasMore ? comments.slice(0, limit) : comments;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]!.id : null;

    return res.status(200).json({
      items,
      nextCursor,
      hasMore,
    });
  }),
);

/**
 * 9. POST /api/projects/:id/tasks/:taskId/comments
 * Add comment. Project members and managers (not viewers).
 */
tasksRouter.post(
  '/:taskId/comments',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!can(req.user!, 'comment:write')) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
    }

    const projectId = req.params['id'] as string;
    const access = await resolveProjectAccess(projectId, req.user!);
    if (access.notFound) {
      return res.status(404).json({ error: 'not_found', message: access.message ?? 'Project not found' });
    }

    if (access.projectRole === 'viewer') {
      return res.status(403).json({ error: 'forbidden', message: 'Project viewers cannot comment' });
    }

    const taskId = req.params['taskId'] as string;
    if (!isValidUuid(taskId)) {
      return res.status(404).json({ error: 'not_found', message: 'Task not found' });
    }

    const task = await db.task.findUnique({
      where: { id: taskId },
    });
    if (!task || task.projectId !== projectId) {
      return res.status(404).json({ error: 'not_found', message: 'Task not found' });
    }

    const parseResult = createCommentSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid comment data',
        details: parseResult.error.issues,
      });
    }

    const { body } = parseResult.data;
    const isSystemAdmin = req.user!.systemRole === 'system_admin';

    const comment = await db.$transaction(async (tx) => {
      const c = await tx.comment.create({
        data: {
          taskId,
          authorUserId: req.user!.id,
          body,
        },
        include: {
          authorUser: {
            select: {
              id: true,
              displayName: true,
              username: true,
              systemRole: isSystemAdmin,
            },
          },
        },
      });

      // No comment body in audit snapshots
      await tx.auditLog.create({
        data: {
          actorUserId: req.user!.id,
          action: 'comment.created',
          entityType: 'comment',
          entityId: c.id,
          afterSnapshot: { taskId },
          ipAddress: req.ip,
        },
      });

      return c;
    });

    return res.status(201).json(comment);
  }),
);

/**
 * 10. PATCH /api/projects/:id/tasks/:taskId/comments/:commentId
 * Edit comment. Author only.
 */
tasksRouter.patch(
  '/:taskId/comments/:commentId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!can(req.user!, 'comment:write')) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
    }

    const projectId = req.params['id'] as string;
    const access = await resolveProjectAccess(projectId, req.user!);
    if (access.notFound) {
      return res.status(404).json({ error: 'not_found', message: access.message ?? 'Project not found' });
    }

    const taskId = req.params['taskId'] as string;
    const commentId = req.params['commentId'] as string;

    if (!isValidUuid(taskId) || !isValidUuid(commentId)) {
      return res.status(404).json({ error: 'not_found', message: 'Comment not found' });
    }

    const task = await db.task.findUnique({
      where: { id: taskId },
    });
    if (!task || task.projectId !== projectId) {
      return res.status(404).json({ error: 'not_found', message: 'Task not found' });
    }

    const comment = await db.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment || comment.taskId !== taskId) {
      return res.status(404).json({ error: 'not_found', message: 'Comment not found' });
    }

    if (access.projectRole === 'viewer') {
      return res.status(403).json({
        error: 'forbidden',
        message: 'Viewers cannot edit comments',
      });
    }

    // Author check
    if (comment.authorUserId !== req.user!.id) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'Only the author may edit this comment',
      });
    }

    const parseResult = patchCommentSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid comment update data',
        details: parseResult.error.issues,
      });
    }

    const { body } = parseResult.data;
    const isSystemAdmin = req.user!.systemRole === 'system_admin';

    const updated = await db.$transaction(async (tx) => {
      const u = await tx.comment.update({
        where: { id: commentId },
        data: { body },
        include: {
          authorUser: {
            select: {
              id: true,
              displayName: true,
              username: true,
              systemRole: isSystemAdmin,
            },
          },
        },
      });

      // Amendment 8: Audit comment edits as comment.edited without the body
      await tx.auditLog.create({
        data: {
          actorUserId: req.user!.id,
          action: 'comment.edited',
          entityType: 'comment',
          entityId: commentId,
          afterSnapshot: { taskId },
          ipAddress: req.ip,
        },
      });

      return u;
    });

    return res.status(200).json(updated);
  }),
);
