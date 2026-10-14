import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const employeesRouter = Router();

// Directory is accessible to all authenticated users
employeesRouter.use(requireAuth);

/**
 * GET /api/employees
 * Searchable employee directory returning permitted fields according to the caller's role:
 * - Ordinary staff (employee, viewer, project_manager): name, department, job title, availability.
 * - Admin and HR (system_admin, hr_admin): extended profile details (employee code, shift hours, etc.).
 * - Strict Invariant: NEVER returns passwordHash, failedLoginCount, lockedUntil, or sessions.
 */
employeesRouter.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const callerRole = req.user?.systemRole;
    const isPrivileged = callerRole === 'system_admin' || callerRole === 'hr_admin';

    const search = typeof req.query['search'] === 'string' ? req.query['search'].trim() : undefined;
    const department = typeof req.query['department'] === 'string' ? req.query['department'].trim() : undefined;

    const where: any = {
      isActive: true,
    };

    if (department) {
      where.employeeProfile = {
        department: { equals: department, mode: 'insensitive' },
      };
    }

    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
        { employeeProfile: { jobTitle: { contains: search, mode: 'insensitive' } } },
        { employeeProfile: { department: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const users = await db.user.findMany({
      where,
      select: {
        id: true,
        displayName: true,
        username: true,
        systemRole: true,
        isActive: true,
        createdAt: true,
        employeeProfile: {
          select: {
            id: true,
            employeeCode: true,
            department: true,
            jobTitle: true,
            startDate: true,
            standardShiftHours: true,
            workingDaysPerWeek: true,
            managerUserId: true,
          },
        },
        availabilityStatus: {
          select: {
            status: true,
            message: true,
            expiresAt: true,
          },
        },
      },
      orderBy: { displayName: 'asc' },
    });

    if (isPrivileged) {
      // Privileged view for system_admin and hr_admin
      const directory = users.map((u) => ({
        id: u.id, // canonical employeeId (userId)
        profileId: u.employeeProfile?.id,
        username: u.username,
        displayName: u.displayName,
        systemRole: u.systemRole,
        isActive: u.isActive,
        employeeCode: u.employeeProfile?.employeeCode ?? null,
        department: u.employeeProfile?.department ?? null,
        jobTitle: u.employeeProfile?.jobTitle ?? null,
        startDate: u.employeeProfile?.startDate ?? null,
        standardShiftHours: u.employeeProfile?.standardShiftHours ?? 8,
        workingDaysPerWeek: u.employeeProfile?.workingDaysPerWeek ?? 5,
        managerUserId: u.employeeProfile?.managerUserId ?? null,
        availability: u.availabilityStatus?.status ?? 'available',
        availabilityMessage: u.availabilityStatus?.message ?? null,
        createdAt: u.createdAt,
      }));
      return res.status(200).json(directory);
    }

    // Public directory view for regular employees, viewers, project managers
    const directory = users.map((u) => ({
      id: u.id, // canonical employeeId (userId)
      displayName: u.displayName,
      department: u.employeeProfile?.department ?? null,
      jobTitle: u.employeeProfile?.jobTitle ?? null,
      availability: u.availabilityStatus?.status ?? 'available',
      availabilityMessage: u.availabilityStatus?.message ?? null,
    }));

    return res.status(200).json(directory);
  }),
);

/**
 * GET /api/employees/me
 * An employee can read their own full profile.
 */
employeesRouter.get(
  '/me',
  asyncHandler(async (req: AuthRequest, res) => {
    const callerId = req.user!.id;

    const user = await db.user.findUnique({
      where: { id: callerId },
      select: {
        id: true,
        username: true,
        displayName: true,
        systemRole: true,
        isActive: true,
        createdAt: true,
        employeeProfile: {
          include: {
            workRoles: {
              include: { workRole: true },
            },
          },
        },
        availabilityStatus: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'not_found', message: 'User not found' });
    }

    return res.status(200).json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        systemRole: user.systemRole,
      },
      employeeProfile: user.employeeProfile,
      availabilityStatus: user.availabilityStatus,
      workRoles: user.employeeProfile?.workRoles?.map((r) => r.workRole) ?? [],
    });
  }),
);

/**
 * GET /api/employees/:id
 * Individual lookup:
 * - Own profile: returns full personal profile.
 * - Another employee:
 *     - If caller is admin or HR: returns full employee profile.
 *     - If caller is ordinary staff: returns only public directory fields (cannot read other employees' full profile).
 */
employeesRouter.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const targetId = req.params['id'];
    const isSelf = targetId === 'me' || targetId === req.user?.id;
    const callerRole = req.user?.systemRole;
    const isPrivileged = callerRole === 'system_admin' || callerRole === 'hr_admin';

    const user = await db.user.findFirst({
      where: {
        OR: [
          { id: targetId },
          { employeeProfile: { id: targetId } },
        ],
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        systemRole: true,
        isActive: true,
        createdAt: true,
        employeeProfile: {
          include: {
            workRoles: {
              include: { workRole: true },
            },
          },
        },
        availabilityStatus: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'not_found', message: 'Employee not found' });
    }

    if (isSelf || isPrivileged) {
      return res.status(200).json({
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          systemRole: user.systemRole,
        },
        employeeProfile: user.employeeProfile,
        availabilityStatus: user.availabilityStatus,
        workRoles: user.employeeProfile?.workRoles?.map((r) => r.workRole) ?? [],
      });
    }

    // Non-privileged viewing another employee: restricted to public directory fields only
    return res.status(200).json({
      id: user.id,
      displayName: user.displayName,
      department: user.employeeProfile?.department ?? null,
      jobTitle: user.employeeProfile?.jobTitle ?? null,
      availability: user.availabilityStatus?.status ?? 'available',
      availabilityMessage: user.availabilityStatus?.message ?? null,
    });
  }),
);
