import { Router, type Response } from 'express';
import { Prisma } from '@prisma/client';
import { db } from '../db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { can } from '../lib/permissions.js';
import { isValidUuid } from '../services/projectAccess.js';

export const auditLogsRouter = Router();

// -- Known Types & Actions --------------------------------------------------

export const PROJECT_MAPPABLE_ENTITY_TYPES = [
  'project',
  'milestone',
  'task',
  'Task',
  'comment',
  'ProjectMessage',
  'time_log',
] as const;

export const ADMIN_ONLY_ENTITY_TYPES = [
  'SystemSetting',
  'User',
  'EmployeeProfile',
  'Session',
  'WorkRole',
  'EmployeeWorkRole',
  'WorkLogDay',
] as const;

export const ALL_KNOWN_ENTITY_TYPES = [
  ...PROJECT_MAPPABLE_ENTITY_TYPES,
  ...ADMIN_ONLY_ENTITY_TYPES,
] as const;

export const PROJECT_ACTIONS = [
  'project.created',
  'project.updated',
  'project_member.added',
  'project_member.removed',
  'project.status_changed',
  'milestone.created',
  'milestone.updated',
  'milestone.completed',
  'milestone.reopened',
  'task.created',
  'task.updated',
  'task.assigned',
  'task.deleted',
  'task.status_changed',
  'task_dependency.added',
  'task_dependency.removed',
  'comment.created',
  'comment.edited',
  'comment.deleted',
  'project_message.pinned',
  'project_message.unpinned',
  'project_message.converted_to_task',
  'time_log.created',
  'time_log.updated',
] as const;

export const ADMIN_ONLY_ACTIONS = [
  'settings.updated',
  'user.created',
  'user.deactivated',
  'user.reactivated',
  'auth.password.reset',
  'user.role_changed',
  'auth.login.failed',
  'auth.login.locked',
  'auth.login.success',
  'auth.password.changed',
  'employee_profile.updated',
  'auth.logout',
  'work_role.created',
  'work_role.updated',
  'work_role.deactivated',
  'work_role.assigned',
  'work_role.removed',
  'work_log.admin_override',
  'work_log.exported',
  'work_log.edited_after_submit',
  'time_log.removed', // TimeLog deletion is admin-only per Amendment A and Step 19a-fix Item 2
] as const;

export const ALL_KNOWN_ACTIONS = [
  ...PROJECT_ACTIONS,
  ...ADMIN_ONLY_ACTIONS,
] as const;

// -- Allow-Lists (Amendment C) ----------------------------------------------

export const SYSTEM_ADMIN_ALLOW_LIST = new Set([
  'id',
  'title',
  'name',
  'status',
  'fromStatus',
  'toStatus',
  'dueDate',
  'estimatedHours',
  'hours',
  'workDate',
  'workRoleId',
  'roleName',
  'targetUserId',
  'projectRole',
  'assigneeUserId',
  'parentTaskId',
  'dependsOnTaskId',
  'subtaskCount',
  'commentCount',
  'taskId',
  'projectId',
  'value',
  'isActive',
  'systemRole',
  'employeeCode',
  'department',
  'jobTitle',
  'startDate',
  'targetDate',
  'standardShiftHours',
  'workingDaysPerWeek',
  'managerUserId',
  'isPinned',
  'completedAt',
  'lockedUntil',
  'failedLoginCount',
  'scope',
  'rowCount',
]);

export const PROJECT_MANAGER_ALLOW_LIST = new Set([
  'id',
  'title',
  'name',
  'status',
  'fromStatus',
  'toStatus',
  'dueDate',
  'estimatedHours',
  'hours',
  'workDate',
  'targetUserId',
  'projectRole',
  'assigneeUserId',
  'parentTaskId',
  'dependsOnTaskId',
  'taskId',
  'projectId',
  'isPinned',
  'completedAt',
  'startDate',
  'targetDate',
]);

export function sanitizeSnapshot(
  snapshot: unknown,
  allowList: Set<string>
): Record<string, unknown> | null {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return null;
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(snapshot as Record<string, unknown>)) {
    if (allowList.has(key)) {
      result[key] = value;
    }
  }
  return result;
}

// -- Calendar Date & Asia/Kathmandu Helpers (Amendment E) -------------------

export function isValidCalendarDate(dateStr?: unknown): boolean {
  if (typeof dateStr !== 'string') return false;
  const trimmed = dateStr.trim();
  if (!trimmed) return false;

  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const year = parseInt(match[1]!, 10);
  const month = parseInt(match[2]!, 10);
  const day = parseInt(match[3]!, 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) return false;
  if (year < 1000 || year > 9999) return false;
  if (month < 1 || month > 12) return false;

  const maxDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > maxDays) return false;

  return true;
}

export function getKathmanduTodayStr(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kathmandu',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

export function addDaysYmd(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0]!;
}

export function startOfKathmanduDayUtc(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  // Asia/Kathmandu is fixed UTC+05:45 (+345 min)
  return new Date(Date.UTC(y!, m! - 1, d!) - 345 * 60 * 1000);
}

export function startOfNextKathmanduDayUtc(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + 1) - 345 * 60 * 1000);
}

// -- GET /api/audit-logs ----------------------------------------------------

auditLogsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // 1. Permission check: deny by default
    if (!can(req.user!, 'auditlog:read') && !can(req.user!, 'auditlog:readProject')) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'You do not have permission to access audit logs',
      });
    }

    const isSystemAdmin = req.user!.systemRole === 'system_admin';
    const isProjectManager = req.user!.systemRole === 'project_manager';

    // 2. Query parameter validation (Step 19a-fix Item 3)
    // Every query parameter must be a plain string. If any value is an array or object, return 400.
    for (const [key, val] of Object.entries(req.query)) {
      if (val !== undefined && typeof val !== 'string') {
        return res.status(400).json({
          error: 'validation_error',
          message: `Query parameter "${key}" must be a plain string`,
        });
      }
      if (typeof val === 'string' && val.trim() === '') {
        return res.status(400).json({
          error: 'validation_error',
          message: `Query parameter "${key}" cannot be empty`,
        });
      }
    }

    // Safely extract plain string parameters (never calling .trim() on a non-string)
    const rawFrom = typeof req.query['from'] === 'string' ? req.query['from'] : undefined;
    const rawTo = typeof req.query['to'] === 'string' ? req.query['to'] : undefined;
    const rawActorUserId = typeof req.query['actorUserId'] === 'string' ? req.query['actorUserId'] : undefined;
    const rawAction = typeof req.query['action'] === 'string' ? req.query['action'] : undefined;
    const rawEntityType = typeof req.query['entityType'] === 'string' ? req.query['entityType'] : undefined;
    const rawProjectId = typeof req.query['projectId'] === 'string' ? req.query['projectId'] : undefined;
    const rawLimit = typeof req.query['limit'] === 'string' ? req.query['limit'] : undefined;
    const rawOffset = typeof req.query['offset'] === 'string' ? req.query['offset'] : undefined;

    // 3. Date parameters: from and to
    let fromStr: string;
    let toStr: string;

    const todayStr = getKathmanduTodayStr();

    if (!rawFrom && !rawTo) {
      // Default: last 30 days in Asia/Kathmandu (Amendment E)
      toStr = todayStr;
      fromStr = addDaysYmd(todayStr, -30);
    } else if (rawFrom && rawTo) {
      fromStr = rawFrom.trim();
      toStr = rawTo.trim();
    } else if (rawFrom && !rawTo) {
      fromStr = rawFrom.trim();
      toStr = todayStr;
    } else {
      // !rawFrom && rawTo
      toStr = rawTo!.trim();
      fromStr = addDaysYmd(toStr, -30);
    }

    if (!isValidCalendarDate(fromStr)) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Parameter "from" must be a valid calendar date in YYYY-MM-DD format',
      });
    }

    if (!isValidCalendarDate(toStr)) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Parameter "to" must be a valid calendar date in YYYY-MM-DD format',
      });
    }

    if (toStr < fromStr) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Parameter "to" must be on or after "from"',
      });
    }

    // 366 days max span check
    const fromTime = new Date(fromStr + 'T00:00:00Z').getTime();
    const toTime = new Date(toStr + 'T00:00:00Z').getTime();
    const spanDays = Math.round((toTime - fromTime) / (24 * 3600 * 1000));
    if (spanDays > 366) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Date range cannot exceed 366 days',
      });
    }

    // UTC bounds with exclusive upper bound (Amendment E)
    const fromUtc = startOfKathmanduDayUtc(fromStr);
    const toUtcExclusive = startOfNextKathmanduDayUtc(toStr);

    // 4. Optional query filters
    const actorUserId = rawActorUserId !== undefined ? rawActorUserId.trim() : undefined;
    if (actorUserId !== undefined) {
      if (!isValidUuid(actorUserId)) {
        return res.status(400).json({
          error: 'validation_error',
          message: 'Parameter "actorUserId" must be a valid UUID',
        });
      }
    }

    const action = rawAction !== undefined ? rawAction.trim() : undefined;
    if (action !== undefined) {
      if (!ALL_KNOWN_ACTIONS.includes(action as any)) {
        return res.status(400).json({
          error: 'validation_error',
          message: `Unknown action: "${action}"`,
        });
      }
    }

    const entityType = rawEntityType !== undefined ? rawEntityType.trim() : undefined;
    if (entityType !== undefined) {
      if (!ALL_KNOWN_ENTITY_TYPES.includes(entityType as any)) {
        return res.status(400).json({
          error: 'validation_error',
          message: `Unknown entityType: "${entityType}"`,
        });
      }
    }

    const projectId = rawProjectId !== undefined ? rawProjectId.trim() : undefined;
    if (projectId !== undefined) {
      if (!isValidUuid(projectId)) {
        return res.status(400).json({
          error: 'validation_error',
          message: 'Parameter "projectId" must be a valid UUID',
        });
      }
    }

    // 5. Pagination: limit & offset
    let limit = 50;
    if (rawLimit !== undefined) {
      const trimmedLimit = rawLimit.trim();
      const parsedLimit = parseInt(trimmedLimit, 10);
      if (!/^\d+$/.test(trimmedLimit) || isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
        return res.status(400).json({
          error: 'validation_error',
          message: 'Parameter "limit" must be an integer between 1 and 100',
        });
      }
      limit = parsedLimit;
    }

    let offset = 0;
    if (rawOffset !== undefined) {
      const trimmedOffset = rawOffset.trim();
      const parsedOffset = parseInt(trimmedOffset, 10);
      if (!/^\d+$/.test(trimmedOffset) || isNaN(parsedOffset) || parsedOffset < 0) {
        return res.status(400).json({
          error: 'validation_error',
          message: 'Parameter "offset" must be a non-negative integer',
        });
      }
      offset = parsedOffset;
    }

    // 6. Role-specific scoping & Fail-Closed Guard (Step 19a-fix Item 4)
    const allowList = isSystemAdmin ? SYSTEM_ADMIN_ALLOW_LIST : PROJECT_MANAGER_ALLOW_LIST;

    let targetProjectIds: string[] | null = null;

    if (isProjectManager) {
      // Amendment F: If project_manager filters by an entityType or action outside project entities, return empty list (no leakage)
      if (entityType && !PROJECT_MAPPABLE_ENTITY_TYPES.includes(entityType as any)) {
        return res.status(200).json({ items: [], total: 0, limit, offset });
      }
      if (action && !PROJECT_ACTIONS.includes(action as any)) {
        return res.status(200).json({ items: [], total: 0, limit, offset });
      }

      // Fetch projects where caller is an ACTIVE member with projectRole: 'manager'
      const managedMemberships = await db.projectMember.findMany({
        where: {
          userId: req.user!.id,
          projectRole: 'manager',
        },
        select: { projectId: true },
      });

      const managedIds = managedMemberships.map((m) => m.projectId);

      if (projectId) {
        // Must be one of their managed projects, otherwise 404 not_found
        if (!managedIds.includes(projectId)) {
          return res.status(404).json({
            error: 'not_found',
            message: 'Project not found',
          });
        }
        targetProjectIds = [projectId];
      } else {
        if (managedIds.length === 0) {
          // Manages no projects -> 0 results
          return res.status(200).json({ items: [], total: 0, limit, offset });
        }
        targetProjectIds = managedIds;
      }
    } else if (isSystemAdmin) {
      if (projectId) {
        const projectExists = await db.project.findUnique({
          where: { id: projectId },
          select: { id: true },
        });
        if (!projectExists) {
          return res.status(404).json({
            error: 'not_found',
            message: 'Project not found',
          });
        }
        targetProjectIds = [projectId];
      }
    } else {
      // Fail closed: Caller is neither system_admin nor project_manager (Step 19a-fix Item 4)
      return res.status(403).json({
        error: 'forbidden',
        message: 'Access denied: caller does not hold an authorized audit log read role',
      });
    }

    // 7. Parameterized SQL query construction using Prisma.sql exclusively (Amendment D & Step 19a-fix Item 1)
    const conditions: Prisma.Sql[] = [
      Prisma.sql`a."createdAt" >= ${fromUtc}`,
      Prisma.sql`a."createdAt" < ${toUtcExclusive}`,
    ];

    if (actorUserId) {
      conditions.push(Prisma.sql`a."actorUserId" = ${actorUserId}`);
    }

    if (action) {
      conditions.push(Prisma.sql`a."action" = ${action}`);
    }

    if (entityType) {
      // Normalizing task/Task casing through lowercase match
      if (entityType.toLowerCase() === 'task') {
        conditions.push(Prisma.sql`LOWER(a."entityType") = 'task'`);
      } else {
        conditions.push(Prisma.sql`a."entityType" = ${entityType}`);
      }
    }

    if (targetProjectIds !== null) {
      if (isProjectManager) {
        // Step 19a-fix Item 1: Outer SQL condition joined with AND to the project-scope block
        // a."entityType" IN (PROJECT_MAPPABLE_ENTITY_TYPES) AND a."action" IN (PROJECT_ACTIONS), both as bound parameters
        conditions.push(Prisma.sql`(
          a."entityType" IN (${Prisma.join(PROJECT_MAPPABLE_ENTITY_TYPES.map((et) => Prisma.sql`${et}`))})
          AND
          a."action" IN (${Prisma.join(PROJECT_ACTIONS.map((ac) => Prisma.sql`${ac}`))})
          AND (
            (LOWER(a."entityType") = 'project' AND a."entityId" = ANY(${targetProjectIds}))
            OR
            (a."beforeSnapshot"->>'projectId' = ANY(${targetProjectIds}))
            OR
            (a."afterSnapshot"->>'projectId' = ANY(${targetProjectIds}))
            OR
            (LOWER(a."entityType") = 'milestone' AND a."entityId" IN (
              SELECT m.id FROM "Milestone" m WHERE m."projectId" = ANY(${targetProjectIds})
            ))
            OR
            (LOWER(a."entityType") = 'task' AND a."entityId" IN (
              SELECT t.id FROM "Task" t WHERE t."projectId" = ANY(${targetProjectIds})
            ))
            OR
            (LOWER(a."entityType") = 'comment' AND a."entityId" IN (
              SELECT c.id FROM "Comment" c JOIN "Task" t ON c."taskId" = t.id WHERE t."projectId" = ANY(${targetProjectIds})
            ))
            OR
            (a."entityType" = 'ProjectMessage' AND a."entityId" IN (
              SELECT pm.id FROM "ProjectMessage" pm WHERE pm."projectId" = ANY(${targetProjectIds})
            ))
            OR
            (a."entityType" = 'time_log' AND (
              (a."afterSnapshot"->>'projectId' = ANY(${targetProjectIds}))
              OR
              (a."entityId" IN (
                SELECT tl.id FROM "TimeLog" tl WHERE tl."projectId" = ANY(${targetProjectIds})
              ))
            ))
          )
        )`);
      } else {
        // system_admin with projectId filter
        conditions.push(Prisma.sql`(
          (LOWER(a."entityType") = 'project' AND a."entityId" = ANY(${targetProjectIds}))
          OR
          (a."beforeSnapshot"->>'projectId' = ANY(${targetProjectIds}))
          OR
          (a."afterSnapshot"->>'projectId' = ANY(${targetProjectIds}))
          OR
          (LOWER(a."entityType") = 'milestone' AND a."entityId" IN (
            SELECT m.id FROM "Milestone" m WHERE m."projectId" = ANY(${targetProjectIds})
          ))
          OR
          (LOWER(a."entityType") = 'task' AND a."entityId" IN (
            SELECT t.id FROM "Task" t WHERE t."projectId" = ANY(${targetProjectIds})
          ))
          OR
          (LOWER(a."entityType") = 'comment' AND a."entityId" IN (
            SELECT c.id FROM "Comment" c JOIN "Task" t ON c."taskId" = t.id WHERE t."projectId" = ANY(${targetProjectIds})
          ))
          OR
          (a."entityType" = 'ProjectMessage' AND a."entityId" IN (
            SELECT pm.id FROM "ProjectMessage" pm WHERE pm."projectId" = ANY(${targetProjectIds})
          ))
          OR
          (a."entityType" = 'time_log' AND (
            (a."afterSnapshot"->>'projectId' = ANY(${targetProjectIds}))
            OR
            (a."entityId" IN (
              SELECT tl.id FROM "TimeLog" tl WHERE tl."projectId" = ANY(${targetProjectIds})
            ))
          ))
        )`);
      }
    }

    const whereClause = Prisma.join(conditions, ' AND ');

    // Total count query
    const countResult = await db.$queryRaw<[{ count: number }]>`
      SELECT COUNT(*)::int as count
      FROM "AuditLog" a
      WHERE ${whereClause}
    `;
    const total = countResult[0]?.count ?? 0;

    // Items query with actor join and stable tie-break on id
    type RawAuditLogRow = {
      id: string;
      createdAt: Date;
      action: string;
      entityType: string;
      entityId: string | null;
      actorUserId: string | null;
      beforeSnapshot: unknown;
      afterSnapshot: unknown;
      u_id: string | null;
      u_displayName: string | null;
      u_username: string | null;
    };

    const rows = await db.$queryRaw<RawAuditLogRow[]>`
      SELECT
        a."id",
        a."createdAt",
        a."action",
        a."entityType",
        a."entityId",
        a."actorUserId",
        a."beforeSnapshot",
        a."afterSnapshot",
        u."id" AS u_id,
        u."displayName" AS u_displayName,
        u."username" AS u_username
      FROM "AuditLog" a
      LEFT JOIN "User" u ON a."actorUserId" = u."id"
      WHERE ${whereClause}
      ORDER BY a."createdAt" DESC, a."id" DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const items = rows.map((row) => {
      // Deleted or missing actor fallback
      const actor = row.u_id
        ? {
            id: row.u_id,
            displayName: row.u_displayName ?? 'Unknown',
            username: row.u_username ?? 'unknown',
          }
        : {
            id: row.actorUserId ?? 'deleted',
            displayName: 'Deleted User',
            username: 'deleted',
          };

      return {
        id: row.id,
        createdAt: row.createdAt,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        actor,
        beforeSnapshot: sanitizeSnapshot(row.beforeSnapshot, allowList),
        afterSnapshot: sanitizeSnapshot(row.afterSnapshot, allowList),
      };
    });

    return res.status(200).json({
      items,
      total,
      limit,
      offset,
    });
  }),
);
