import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const workRolesRouter = Router();

// Require authentication for all employee work-role routes
workRolesRouter.use(requireAuth);

/**
 * GET /my-roles (and GET /me)
 * An employee can list only their own assigned active work roles.
 */
const getMyRoles = asyncHandler(async (req: AuthRequest, res) => {
  const profile = await db.employeeProfile.findUnique({
    where: { userId: req.user!.id },
  });

  if (!profile) {
    return res.status(200).json([]);
  }

  const assignments = await db.employeeWorkRole.findMany({
    where: {
      employeeProfileId: profile.id,
      workRole: { isActive: true },
    },
    include: {
      workRole: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const roles = assignments.map((a) => a.workRole);

  return res.status(200).json(roles);
});

workRolesRouter.get('/my-roles', getMyRoles);
workRolesRouter.get('/me', getMyRoles);
