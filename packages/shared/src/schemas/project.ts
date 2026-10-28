import { z } from 'zod';

export const ProjectStatus = {
  ON_TRACK: 'on_track',
  AT_RISK: 'at_risk',
  OFF_TRACK: 'off_track',
  ON_HOLD: 'on_hold',
  COMPLETE: 'complete',
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const ProjectRole = {
  MANAGER: 'manager',
  MEMBER: 'member',
  VIEWER: 'viewer',
} as const;
export type ProjectRole = (typeof ProjectRole)[keyof typeof ProjectRole];

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const createProjectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Project name is required')
      .max(100, 'Project name must be 100 characters or less'),
    description: z
      .string()
      .max(2000, 'Description must be 2000 characters or less')
      .nullable()
      .optional(),
    startDate: z
      .string()
      .regex(dateRegex, 'startDate must be in YYYY-MM-DD format')
      .nullable()
      .optional(),
    targetDate: z
      .string()
      .regex(dateRegex, 'targetDate must be in YYYY-MM-DD format')
      .nullable()
      .optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.targetDate) {
        return data.targetDate >= data.startDate;
      }
      return true;
    },
    {
      message: 'targetDate cannot be before startDate',
      path: ['targetDate'],
    },
  );

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const patchProjectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Project name cannot be empty')
      .max(100, 'Project name must be 100 characters or less')
      .optional(),
    description: z
      .string()
      .max(2000, 'Description must be 2000 characters or less')
      .nullable()
      .optional(),
    startDate: z
      .string()
      .regex(dateRegex, 'startDate must be in YYYY-MM-DD format')
      .nullable()
      .optional(),
    targetDate: z
      .string()
      .regex(dateRegex, 'targetDate must be in YYYY-MM-DD format')
      .nullable()
      .optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update',
  })
  .refine(
    (data) => {
      if (data.startDate && data.targetDate) {
        return data.targetDate >= data.startDate;
      }
      return true;
    },
    {
      message: 'targetDate cannot be before startDate',
      path: ['targetDate'],
    },
  );

export type PatchProjectInput = z.infer<typeof patchProjectSchema>;

export const addProjectMemberSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
  projectRole: z.enum(['manager', 'member', 'viewer']),
});

export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>;

export const changeProjectStatusSchema = z.object({
  status: z.enum(['on_track', 'at_risk', 'off_track', 'on_hold', 'complete']),
  reason: z
    .string()
    .transform((val) => val.trim())
    .refine((val) => val.length > 0, {
      message: 'A non-empty reason is required',
    }),
});

export type ChangeProjectStatusInput = z.infer<typeof changeProjectStatusSchema>;

export const listProjectsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().uuid('Invalid cursor format').optional(),
});

export type ListProjectsQueryInput = z.infer<typeof listProjectsQuerySchema>;
