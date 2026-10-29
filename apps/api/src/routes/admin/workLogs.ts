import { Router, type Response } from 'express';
import { db } from '../../db.js';
import {
  requireAuth,
  requirePasswordChanged,
  requirePermission,
  type AuthRequest,
} from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import {
  adminWorkLogOverrideSchema,
  type AdminWorkLogOverrideInput,
} from '@imac/shared';
import {
  validateActiveWorkRoles,
  calculateTotalHours,
  validateWorkLogEntriesProjectAndTask,
  enrichSingleWorkLogWithProjectAndTask,
} from '../../services/workLog.js';

export const adminWorkLogsRouter = Router();

adminWorkLogsRouter.use(requireAuth);
adminWorkLogsRouter.use(requirePasswordChanged);

/**
 * PATCH /api/admin/work-logs/:id/override
 * System Admin override for any employee's daily work log.
 * Reason is required and cannot be empty.
 * Fully audited with before/after snapshot, actor ID, and reason.
 */
adminWorkLogsRouter.patch(
  '/:id/override',
  requirePermission('worklog:adminOverride'),
  validate(adminWorkLogOverrideSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { reason, entries } = req.body as AdminWorkLogOverrideInput;
    const logId = req.params['id'];

    // Verify all roles in entries exist and are active in the system
    const rolesCheck = await validateActiveWorkRoles(entries);
    if (!rolesCheck.valid) {
      return res.status(400).json({
        error: 'invalid_work_role',
        message: `Work role ${rolesCheck.invalidRoleId} does not exist or is inactive`,
      });
    }

    const projectTaskCheck = await validateWorkLogEntriesProjectAndTask(entries, req.user!.id, true);
    if (!projectTaskCheck.valid) {
      return res.status(400).json({
        error: projectTaskCheck.errorCode,
        message: projectTaskCheck.errorMessage,
      });
    }

    const result = await db.$transaction(async (tx) => {
      const existing = await tx.workLogDay.findUnique({
        where: { id: logId },
        include: {
          entries: true,
          employeeProfile: true,
        },
      });

      if (!existing) {
        return { errorStatus: 404, errorCode: 'not_found', errorMessage: 'Work log not found' };
      }

      // Replace entries atomically
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
          employeeProfile: true,
        },
      });

      // Audit log capturing override with reason
      await tx.auditLog.create({
        data: {
          actorUserId: req.user!.id,
          action: 'work_log.admin_override',
          entityType: 'WorkLogDay',
          entityId: logId,
          ipAddress: req.ip,
          beforeSnapshot: {
            status: existing.status,
            entries: existing.entries,
          },
          afterSnapshot: {
            entries,
            reason,
          },
        },
      });

      return { log: updated, standardShiftHours: existing.employeeProfile?.standardShiftHours ?? 8 };
    });

    if ('errorStatus' in result && result.errorStatus) {
      return res.status(result.errorStatus).json({
        error: result.errorCode,
        message: result.errorMessage,
      });
    }

    const totalHours = calculateTotalHours(entries);

    const enrichedLog = await enrichSingleWorkLogWithProjectAndTask((result as any).log, req.user!.id, req.user!.systemRole);
    return res.status(200).json({
      ok: true,
      workLog: enrichedLog,
      totalHours,
      standardShiftHours: result.standardShiftHours,
      warnings: [],
    });
  }),
);
