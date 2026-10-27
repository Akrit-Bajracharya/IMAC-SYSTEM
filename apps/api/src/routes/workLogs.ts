import { Router, type Response } from 'express';
import { db } from '../db.js';
import {
  requireAuth,
  requirePasswordChanged,
  requirePermission,
  type AuthRequest,
} from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import {
  upsertWorkLogDraftSchema,
  patchWorkLogSchema,
  byDateQuerySchema,
  byWeekQuerySchema,
  byMonthQuerySchema,
  workLogExportQuerySchema,
  type UpsertWorkLogDraftInput,
  type PatchWorkLogInput,
} from '@imac/shared';
import { can } from '../lib/permissions.js';
import {
  getEmployeeProfile,
  validateKathmanduDateRange,
  parseDateOnlyUtc,
  validateAssignedWorkRoles,
  calculateTotalHours,
} from '../services/workLog.js';
import { getWorkLogPolicies } from '../services/workLogPolicies.js';
import {
  buildWorkLogExcelWorkbook,
  EXPORT_MAX_ROWS,
} from '../services/workLogExport.js';

export const workLogsRouter = Router();

// Require authenticated session and verified password status
workLogsRouter.use(requireAuth);
workLogsRouter.use(requirePasswordChanged);

/**
 * 1. GET /api/work-logs/by-date?date=YYYY-MM-DD
 * Declared before /:id to prevent routing collision.
 */
workLogsRouter.get(
  '/by-date',
  requirePermission('worklog:readOwn'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const parseResult = byDateQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid date parameter',
        details: parseResult.error.issues,
      });
    }

    const { date } = parseResult.data;
    const profile = await getEmployeeProfile(req.user!.id);
    if (!profile) {
      return res.status(404).json({
        error: 'profile_not_found',
        message: 'Employee profile not found for this user',
      });
    }

    const dateUtc = parseDateOnlyUtc(date);
    const log = await db.workLogDay.findFirst({
      where: {
        employeeProfileId: profile.id,
        date: dateUtc,
      },
      include: {
        entries: {
          include: { workRole: true },
        },
      },
    });

    const standardShiftHours = profile.standardShiftHours ?? 8;
    const totalHours = log ? calculateTotalHours(log.entries) : 0;

    return res.status(200).json({
      workLog: log ?? null,
      totalHours,
      standardShiftHours,
      warnings: [],
    });
  }),
);

/**
 * 2. GET /api/work-logs/by-week?startDate=YYYY-MM-DD
 * Declared before /:id to prevent routing collision.
 */
workLogsRouter.get(
  '/by-week',
  requirePermission('worklog:readOwn'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const parseResult = byWeekQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid startDate parameter',
        details: parseResult.error.issues,
      });
    }

    const { startDate } = parseResult.data;
    const profile = await getEmployeeProfile(req.user!.id);
    if (!profile) {
      return res.status(404).json({
        error: 'profile_not_found',
        message: 'Employee profile not found for this user',
      });
    }

    const startUtc = parseDateOnlyUtc(startDate);
    const endUtc = new Date(startUtc.getTime() + 6 * 24 * 60 * 60 * 1000);

    const logs = await db.workLogDay.findMany({
      where: {
        employeeProfileId: profile.id,
        date: { gte: startUtc, lte: endUtc },
      },
      include: {
        entries: {
          include: { workRole: true },
        },
      },
      orderBy: { date: 'asc' },
    });

    const standardShiftHours = profile.standardShiftHours ?? 8;

    return res.status(200).json({
      workLogs: logs,
      standardShiftHours,
      warnings: [],
    });
  }),
);

/**
 * 3. GET /api/work-logs/by-month?year=YYYY&month=MM
 * Declared before /:id to prevent routing collision.
 */
workLogsRouter.get(
  '/by-month',
  requirePermission('worklog:readOwn'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const parseResult = byMonthQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid year or month parameter',
        details: parseResult.error.issues,
      });
    }

    const { year, month } = parseResult.data;
    const profile = await getEmployeeProfile(req.user!.id);
    if (!profile) {
      return res.status(404).json({
        error: 'profile_not_found',
        message: 'Employee profile not found for this user',
      });
    }

    const startUtc = new Date(Date.UTC(year, month - 1, 1));
    const endUtc = new Date(Date.UTC(year, month, 0));

    const logs = await db.workLogDay.findMany({
      where: {
        employeeProfileId: profile.id,
        date: { gte: startUtc, lte: endUtc },
      },
      include: {
        entries: {
          include: { workRole: true },
        },
      },
      orderBy: { date: 'asc' },
    });

    const standardShiftHours = profile.standardShiftHours ?? 8;

    return res.status(200).json({
      workLogs: logs,
      standardShiftHours,
      warnings: [],
    });
  }),
);

/**
 * 3b. GET /api/work-logs/export
 * Excel export via ExcelJS.
 * Declared BEFORE /:id to prevent routing collision.
 */
workLogsRouter.get(
  '/export',
  requirePermission('worklog:exportOwn'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const parseResult = workLogExportQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid export query parameters',
        details: parseResult.error.issues,
      });
    }

    const {
      startDate,
      endDate,
      status,
      employee,
      team,
      workRoleId,
      projectId,
    } = parseResult.data;

    const canExportAll = can(req.user!, 'worklog:exportAll');
    let scope: 'own' | 'organisation' = 'own';
    let callerProfile: any = null;

    if (canExportAll) {
      scope = 'organisation';
      // System admin can export even if they have no profile
      callerProfile = await getEmployeeProfile(req.user!.id);
    } else {
      scope = 'own';
      callerProfile = await getEmployeeProfile(req.user!.id);
      if (!callerProfile) {
        return res.status(404).json({
          error: 'profile_not_found',
          message: 'Employee profile not found for this user',
        });
      }

      // Non-admins: if an employee filter is provided, it MUST match their own profile id
      if (employee && employee !== callerProfile.id) {
        return res.status(403).json({
          error: 'forbidden',
          message: 'You are only permitted to export your own work logs',
        });
      }
    }

    const startUtc = parseDateOnlyUtc(startDate);
    const endUtc = parseDateOnlyUtc(endDate);

    const entryWhere: any = {
      workLogDay: {
        date: {
          gte: startUtc,
          lte: endUtc,
        },
      },
    };

    if (status) {
      entryWhere.workLogDay.status = status;
    }

    if (scope === 'own') {
      entryWhere.workLogDay.employeeProfileId = callerProfile.id;
      if (team) {
        entryWhere.workLogDay.employeeProfile = { department: team };
      }
    } else {
      // organisation scope
      if (employee) {
        entryWhere.workLogDay.employeeProfileId = employee;
      }
      if (team) {
        entryWhere.workLogDay.employeeProfile = { department: team };
      }
    }

    if (workRoleId) {
      entryWhere.workRoleId = workRoleId;
    }

    if (projectId) {
      entryWhere.projectId = projectId;
    }

    // Run count first; if over EXPORT_MAX_ROWS return 400 row_limit_exceeded before loading rows
    const count = await db.workLogEntry.count({ where: entryWhere });
    if (count > EXPORT_MAX_ROWS) {
      return res.status(400).json({
        error: 'row_limit_exceeded',
        message: `Export exceeds the maximum allowed limit of ${EXPORT_MAX_ROWS.toLocaleString()} rows. Please narrow your date range or filters.`,
      });
    }

    const entries = await db.workLogEntry.findMany({
      where: entryWhere,
      include: {
        workRole: true,
        workLogDay: {
          include: {
            employeeProfile: {
              include: {
                user: {
                  select: {
                    id: true,
                    displayName: true,
                    username: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [
        { workLogDay: { date: 'asc' } },
        { createdAt: 'asc' },
      ],
    });

    // Write audit entry BEFORE sending the file; if it fails, error handler returns 500
    await db.auditLog.create({
      data: {
        actorUserId: req.user!.id,
        action: 'work_log.exported',
        entityType: 'WorkLogDay',
        entityId: null,
        ipAddress: req.ip,
        afterSnapshot: {
          scope,
          rowCount: count,
          filters: {
            startDate,
            endDate,
            ...(status && { status }),
            ...(employee && { employee }),
            ...(team && { team }),
            ...(workRoleId && { workRoleId }),
            ...(projectId && { projectId }),
          },
        },
      },
    });

    const workbook = await buildWorkLogExcelWorkbook({
      scope,
      actorName: req.user!.displayName,
      filters: {
        startDate,
        endDate,
        status,
        employee,
        team,
        workRoleId,
        projectId,
      },
      entries: entries as any,
    });

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="work-logs-export.xlsx"',
    );
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    return res.status(200).send(Buffer.from(buffer));
  }),
);

/**
 * 4. GET /api/work-logs/:id
 * Individual lookup scoped strictly to caller's employeeProfileId.
 */
workLogsRouter.get(
  '/:id',
  requirePermission('worklog:readOwn'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const profile = await getEmployeeProfile(req.user!.id);
    if (!profile) {
      return res.status(404).json({
        error: 'profile_not_found',
        message: 'Employee profile not found for this user',
      });
    }

    const log = await db.workLogDay.findFirst({
      where: {
        id: req.params['id'],
        employeeProfileId: profile.id,
      },
      include: {
        entries: {
          include: { workRole: true },
        },
      },
    });

    if (!log) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Work log not found',
      });
    }

    const standardShiftHours = profile.standardShiftHours ?? 8;
    const totalHours = calculateTotalHours(log.entries);

    return res.status(200).json({
      workLog: log,
      totalHours,
      standardShiftHours,
      warnings: [],
    });
  }),
);

/**
 * 5. POST /api/work-logs
 * Single upsert-draft route for a given date.
 */
workLogsRouter.post(
  '/',
  requirePermission('worklog:writeOwn'),
  validate(upsertWorkLogDraftSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { date, entries } = req.body as UpsertWorkLogDraftInput;

    const profile = await getEmployeeProfile(req.user!.id);
    if (!profile) {
      return res.status(404).json({
        error: 'profile_not_found',
        message: 'Employee profile not found for this user',
      });
    }

    // Date range bounds (Asia/Kathmandu: max 1 day in future, max 90 days in past)
    const dateRangeCheck = validateKathmanduDateRange(date);
    if (!dateRangeCheck.valid) {
      return res.status(400).json({
        error: 'validation_error',
        message: dateRangeCheck.reason ?? 'Invalid date range',
      });
    }

    // Role assignment verification: caller can only use their assigned active roles
    const rolesCheck = await validateAssignedWorkRoles(profile.id, entries);
    if (!rolesCheck.valid) {
      return res.status(400).json({
        error: 'unassigned_work_role',
        message: `Work role ${rolesCheck.invalidRoleId} is not assigned to you`,
      });
    }

    const dateUtc = parseDateOnlyUtc(date);

    // Check for existing log on this date
    const existing = await db.workLogDay.findFirst({
      where: {
        employeeProfileId: profile.id,
        date: dateUtc,
      },
    });

    if (existing && (existing.status === 'submitted' || existing.status === 'approved')) {
      return res.status(409).json({
        error: 'status_conflict',
        message: 'A work log has already been submitted for this date',
      });
    }

    try {
      const log = await db.$transaction(async (tx) => {
        let workLogId = existing?.id;

        if (existing) {
          // Conditional update on status = 'draft'
          const updateResult = await tx.workLogDay.updateMany({
            where: {
              id: existing.id,
              status: 'draft',
            },
            data: { updatedAt: new Date() },
          });

          if (updateResult.count === 0) {
            return {
              errorStatus: 409,
              errorCode: 'status_conflict',
              errorMessage: 'A work log has already been submitted or is no longer a draft',
            };
          }

          // Replace draft entries
          await tx.workLogEntry.deleteMany({ where: { workLogDayId: existing.id } });
        } else {
          // Create new draft day
          const created = await tx.workLogDay.create({
            data: {
              employeeProfileId: profile.id,
              date: dateUtc,
              status: 'draft',
            },
          });
          workLogId = created.id;
        }

        // Insert new entries
        await tx.workLogEntry.createMany({
          data: entries.map((e) => ({
            workLogDayId: workLogId!,
            workRoleId: e.workRoleId,
            hours: e.hours,
            description: e.description ?? null,
            projectId: e.projectId ?? null,
            taskId: e.taskId ?? null,
          })),
        });

        return tx.workLogDay.findUnique({
          where: { id: workLogId },
          include: {
            entries: {
              include: { workRole: true },
            },
          },
        });
      });

      if (log && typeof log === 'object' && 'errorStatus' in log && (log as any).errorStatus) {
        return res.status((log as any).errorStatus).json({
          error: (log as any).errorCode,
          message: (log as any).errorMessage,
        });
      }

      const standardShiftHours = profile.standardShiftHours ?? 8;
      const totalHours = calculateTotalHours(entries);

      return res.status(existing ? 200 : 201).json({
        ok: true,
        workLog: log,
        totalHours,
        standardShiftHours,
        warnings: [],
      });
    } catch (err: any) {
      // Catch Prisma unique constraint collision (P2002)
      if (err?.code === 'P2002') {
        return res.status(409).json({
          error: 'day_already_exists',
          message: 'A work log already exists for this date',
        });
      }
      throw err;
    }
  }),
);

/**
 * 6. PATCH /api/work-logs/:id
 * Replaces entries of an existing log in one transaction.
 * Checks edit-window atomically inside the transaction.
 */
workLogsRouter.patch(
  '/:id',
  requirePermission('worklog:writeOwn'),
  validate(patchWorkLogSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { entries } = req.body as PatchWorkLogInput;
    const logId = req.params['id'];

    const profile = await getEmployeeProfile(req.user!.id);
    if (!profile) {
      return res.status(404).json({
        error: 'profile_not_found',
        message: 'Employee profile not found for this user',
      });
    }

    // Verify all roles in entries are currently assigned and active
    const rolesCheck = await validateAssignedWorkRoles(profile.id, entries);
    if (!rolesCheck.valid) {
      return res.status(400).json({
        error: 'unassigned_work_role',
        message: `Work role ${rolesCheck.invalidRoleId} is not assigned to you`,
      });
    }

    const policies = await getWorkLogPolicies();

    const result = await db.$transaction(async (tx) => {
      const existing = await tx.workLogDay.findFirst({
        where: {
          id: logId,
          employeeProfileId: profile.id,
        },
        include: { entries: true },
      });

      if (!existing) {
        return { errorStatus: 404, errorCode: 'not_found', errorMessage: 'Work log not found' };
      }

      if (existing.status === 'approved') {
        return {
          errorStatus: 403,
          errorCode: 'log_already_approved',
          errorMessage: 'Approved work logs cannot be edited',
        };
      }

      let requiresAudit = false;
      const warnings: string[] = [];
      if (existing.status === 'submitted') {
        if (!existing.submittedAt) {
          return {
            errorStatus: 403,
            errorCode: 'edit_window_expired',
            errorMessage: 'Edit window has expired',
          };
        }

        const elapsedMs = Date.now() - existing.submittedAt.getTime();
        const windowMs = policies.editWindowHours * 3600 * 1000;
        if (elapsedMs > windowMs) {
          return {
            errorStatus: 403,
            errorCode: 'edit_window_expired',
            errorMessage: 'Edit window has expired',
          };
        }

        // Apply mismatchHandling on submitted log
        const standardShiftHours = profile.standardShiftHours ?? 8;
        const totalHours = calculateTotalHours(entries);
        const isMismatch = Math.abs(totalHours - standardShiftHours) > 0.001;

        if (isMismatch) {
          if (policies.mismatchHandling === 'block') {
            return {
              errorStatus: 422,
              errorCode: 'hour_mismatch',
              errorMessage: 'Logged hours do not match standard shift length',
              totalHours,
              standardShiftHours,
              warnings: ['Total hours does not match standard shift length'],
            };
          }
          if (policies.mismatchHandling === 'warn') {
            warnings.push(
              `Total hours (${totalHours}) does not match standard shift length (${standardShiftHours})`,
            );
          }
        }

        requiresAudit = true;
      }

      // Replace entries
      await tx.workLogEntry.deleteMany({ where: { workLogDayId: logId } });
      await tx.workLogEntry.createMany({
        data: entries.map((e) => ({
          workLogDayId: logId,
          workRoleId: e.workRoleId,
          hours: e.hours,
          description: e.description ?? null,
          projectId: e.projectId ?? null,
          taskId: e.taskId ?? null,
        })),
      });

      const updated = await tx.workLogDay.update({
        where: { id: logId },
        data: { updatedAt: new Date() },
        include: {
          entries: {
            include: { workRole: true },
          },
        },
      });

      if (requiresAudit) {
        await tx.auditLog.create({
          data: {
            actorUserId: req.user!.id,
            action: 'work_log.edited_after_submit',
            entityType: 'WorkLogDay',
            entityId: logId,
            ipAddress: req.ip,
            beforeSnapshot: { entries: existing.entries },
            afterSnapshot: { entries },
          },
        });
      }

      return { log: updated, warnings };
    });

    if ('errorStatus' in result && result.errorStatus) {
      return res.status(result.errorStatus).json({
        error: result.errorCode,
        message: result.errorMessage,
        ...(result.totalHours !== undefined && {
          totalHours: result.totalHours,
          standardShiftHours: result.standardShiftHours,
          warnings: result.warnings,
        }),
      });
    }

    const standardShiftHours = profile.standardShiftHours ?? 8;
    const totalHours = calculateTotalHours(entries);

    return res.status(200).json({
      ok: true,
      workLog: result.log,
      totalHours,
      standardShiftHours,
      warnings: result.warnings ?? [],
    });
  }),
);

/**
 * 7. POST /api/work-logs/:id/submit
 * Single conditional update (id, employeeProfileId, status=draft).
 * Zero rows -> 400 already_submitted.
 */
workLogsRouter.post(
  '/:id/submit',
  requirePermission('worklog:writeOwn'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const logId = req.params['id'];

    const profile = await getEmployeeProfile(req.user!.id);
    if (!profile) {
      return res.status(404).json({
        error: 'profile_not_found',
        message: 'Employee profile not found for this user',
      });
    }

    const existing = await db.workLogDay.findFirst({
      where: {
        id: logId,
        employeeProfileId: profile.id,
      },
      include: { entries: true },
    });

    if (!existing) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Work log not found',
      });
    }

    if (existing.status === 'submitted' || existing.status === 'approved') {
      return res.status(400).json({
        error: 'already_submitted',
        message: 'Work log has already been submitted or is not in draft status',
      });
    }

    if (!existing.entries || existing.entries.length === 0) {
      return res.status(400).json({
        error: 'empty_work_log',
        message: 'Cannot submit a work log with no entries',
      });
    }

    const totalHours = calculateTotalHours(existing.entries);
    if (totalHours <= 0) {
      return res.status(400).json({
        error: 'empty_work_log',
        message: 'Cannot submit a work log with zero hours',
      });
    }

    // Verify all entries in existing draft still belong to currently assigned roles
    const rolesCheck = await validateAssignedWorkRoles(profile.id, existing.entries);
    if (!rolesCheck.valid) {
      return res.status(400).json({
        error: 'unassigned_work_role',
        message: `Work log contains unassigned work role ${rolesCheck.invalidRoleId}`,
      });
    }

    const policies = await getWorkLogPolicies();
    const standardShiftHours = profile.standardShiftHours ?? 8;
    const isMismatch = Math.abs(totalHours - standardShiftHours) > 0.001;

    const warnings: string[] = [];

    if (isMismatch) {
      if (policies.mismatchHandling === 'block') {
        return res.status(422).json({
          error: 'hour_mismatch',
          message: 'Logged hours do not match standard shift length',
          totalHours,
          standardShiftHours,
          warnings: ['Total hours does not match standard shift length'],
        });
      }

      if (policies.mismatchHandling === 'warn') {
        warnings.push(
          `Total hours (${totalHours}) does not match standard shift length (${standardShiftHours})`,
        );
      }
    }

    // Atomic conditional update with optimistic lock
    const updateResult = await db.workLogDay.updateMany({
      where: {
        id: logId,
        employeeProfileId: profile.id,
        status: 'draft',
        updatedAt: existing.updatedAt,
      },
      data: {
        status: 'submitted',
        submittedAt: new Date(),
      },
    });

    if (updateResult.count === 0) {
      const current = await db.workLogDay.findUnique({
        where: { id: logId },
      });
      if (!current || current.status !== 'draft') {
        return res.status(400).json({
          error: 'already_submitted',
          message: 'Work log has already been submitted or is not in draft status',
        });
      }
      return res.status(409).json({
        error: 'conflict_retry',
        message: 'Work log was modified by another request. Please reload and retry.',
      });
    }

    const updatedLog = await db.workLogDay.findUnique({
      where: { id: logId },
      include: {
        entries: {
          include: { workRole: true },
        },
      },
    });

    return res.status(200).json({
      ok: true,
      workLog: updatedLog,
      totalHours,
      standardShiftHours,
      warnings,
    });
  }),
);
