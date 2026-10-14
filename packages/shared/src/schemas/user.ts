import { z } from 'zod';
import { SystemRole } from '../types/index.js';

export const createUserSchema = z.object({
  username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9_.\-]+$/).trim(),
  displayName: z.string().min(1).max(128).trim(),
  systemRole: z.enum(['system_admin', 'hr_admin', 'project_manager', 'employee', 'viewer'] as const),
  // Optional initial employee profile details
  employeeCode: z.string().max(50).trim().optional(),
  department: z.string().max(100).trim().optional(),
  jobTitle: z.string().max(100).trim().optional(),
  startDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  standardShiftHours: z.number().min(1).max(24).optional(),
  workingDaysPerWeek: z.number().int().min(1).max(7).optional(),
  managerUserId: z.string().uuid().optional(),
});

export const updateUserRoleSchema = z.object({
  systemRole: z.enum(['system_admin', 'hr_admin', 'project_manager', 'employee', 'viewer'] as const),
});

export const updateEmployeeProfileSchema = z.object({
  department: z.string().max(100).trim().optional(),
  jobTitle: z.string().max(100).trim().optional(),
  startDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable().optional(),
  standardShiftHours: z.number().min(1).max(24).optional(),
  workingDaysPerWeek: z.number().int().min(1).max(7).optional(),
  employeeCode: z.string().max(50).trim().optional(),
  managerUserId: z.string().uuid().nullable().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type UpdateEmployeeProfileInput = z.infer<typeof updateEmployeeProfileSchema>;
