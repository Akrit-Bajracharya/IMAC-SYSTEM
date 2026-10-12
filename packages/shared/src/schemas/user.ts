import { z } from 'zod';
import { SystemRole } from '../types/index.js';

export const createUserSchema = z.object({
  username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9_.\-]+$/),
  displayName: z.string().min(1).max(128),
  systemRole: z.enum(['system_admin', 'hr_admin', 'project_manager', 'employee', 'viewer'] as const),
});

export const updateUserRoleSchema = z.object({
  systemRole: z.enum(['system_admin', 'hr_admin', 'project_manager', 'employee', 'viewer'] as const),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
