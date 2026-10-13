import { z } from 'zod';

export const createWorkRoleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).trim(),
  description: z.string().max(500).trim().optional(),
});

export const updateWorkRoleSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).trim().optional(),
  isActive: z.boolean().optional(),
});

export const assignWorkRoleSchema = z.object({
  workRoleId: z.string().min(1, 'workRoleId is required'),
});

export type CreateWorkRoleInput = z.infer<typeof createWorkRoleSchema>;
export type UpdateWorkRoleInput = z.infer<typeof updateWorkRoleSchema>;
export type AssignWorkRoleInput = z.infer<typeof assignWorkRoleSchema>;
