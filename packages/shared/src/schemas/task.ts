import { z } from 'zod';
import { isQuarterHourIncrement } from './workLog.js';

export const TaskStatus = {
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  BLOCKED: 'blocked',
  DONE: 'done',
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const createTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Task title is required')
      .max(200, 'Task title must be 200 characters or less'),
    description: z
      .string()
      .max(5000, 'Description must be 5000 characters or less')
      .nullable()
      .optional(),
    dueDate: z
      .string()
      .regex(dateRegex, 'dueDate must be in YYYY-MM-DD format')
      .nullable()
      .optional(),
    estimatedHours: z
      .number()
      .positive('estimatedHours must be greater than 0')
      .max(1000, 'estimatedHours cannot exceed 1000')
      .refine(isQuarterHourIncrement, {
        message: 'estimatedHours must be entered in 15-minute (0.25) increments',
      })
      .nullable()
      .optional(),
    assigneeUserId: z.string().uuid('Invalid assigneeUserId format').nullable().optional(),
    milestoneId: z.string().uuid('Invalid milestoneId format').nullable().optional(),
    parentTaskId: z.string().uuid('Invalid parentTaskId format').nullable().optional(),
  })
  .strict();

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const patchTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Task title cannot be empty')
      .max(200, 'Task title must be 200 characters or less')
      .optional(),
    description: z
      .string()
      .max(5000, 'Description must be 5000 characters or less')
      .nullable()
      .optional(),
    dueDate: z
      .string()
      .regex(dateRegex, 'dueDate must be in YYYY-MM-DD format')
      .nullable()
      .optional(),
    estimatedHours: z
      .number()
      .positive('estimatedHours must be greater than 0')
      .max(1000, 'estimatedHours cannot exceed 1000')
      .refine(isQuarterHourIncrement, {
        message: 'estimatedHours must be entered in 15-minute (0.25) increments',
      })
      .nullable()
      .optional(),
    assigneeUserId: z.string().uuid('Invalid assigneeUserId format').nullable().optional(),
    milestoneId: z.string().uuid('Invalid milestoneId format').nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update',
  });

export type PatchTaskInput = z.infer<typeof patchTaskSchema>;

export const changeTaskStatusSchema = z.object({
  status: z.enum(['todo', 'in_progress', 'blocked', 'done']),
});

export type ChangeTaskStatusInput = z.infer<typeof changeTaskStatusSchema>;

export const booleanQueryParam = z.preprocess((val) => {
  if (typeof val === 'string') {
    const lower = val.trim().toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
    return val;
  }
  return val;
}, z.boolean({ invalid_type_error: 'Must be a boolean (true or false)' }).optional());

export const listTasksQuerySchema = z
  .object({
    status: z.enum(['todo', 'in_progress', 'blocked', 'done']).optional(),
    assigneeUserId: z.string().uuid('Invalid assigneeUserId format').optional(),
    milestoneId: z.string().uuid('Invalid milestoneId format').optional(),
    parentTaskId: z.string().uuid('Invalid parentTaskId format').optional(),
    topLevelOnly: booleanQueryParam,
    overdue: booleanQueryParam,
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().uuid('Invalid cursor format').optional(),
  })
  .refine((data) => !(data.topLevelOnly && data.parentTaskId), {
    message: 'topLevelOnly cannot be combined with parentTaskId',
    path: ['topLevelOnly'],
  });

export type ListTasksQueryInput = z.infer<typeof listTasksQuerySchema>;

export const createTaskDependencySchema = z
  .object({
    dependsOnTaskId: z.string().uuid('Invalid dependsOnTaskId format'),
  })
  .strict();

export type CreateTaskDependencyInput = z.infer<typeof createTaskDependencySchema>;

export const createMilestoneSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Milestone name is required')
      .max(100, 'Milestone name must be 100 characters or less'),
    dueDate: z
      .string()
      .regex(dateRegex, 'dueDate must be in YYYY-MM-DD format')
      .nullable()
      .optional(),
  })
  .strict();

export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;

export const patchMilestoneSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Milestone name cannot be empty')
      .max(100, 'Milestone name must be 100 characters or less')
      .optional(),
    dueDate: z
      .string()
      .regex(dateRegex, 'dueDate must be in YYYY-MM-DD format')
      .nullable()
      .optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update',
  });

export type PatchMilestoneInput = z.infer<typeof patchMilestoneSchema>;

export const createCommentSchema = z
  .object({
    body: z
      .string()
      .trim()
      .min(1, 'Comment body is required')
      .max(5000, 'Comment body must be 5000 characters or less'),
  })
  .strict();

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const patchCommentSchema = z
  .object({
    body: z
      .string()
      .trim()
      .min(1, 'Comment body cannot be empty')
      .max(5000, 'Comment body must be 5000 characters or less'),
  })
  .strict();

export type PatchCommentInput = z.infer<typeof patchCommentSchema>;

export const listCommentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().uuid('Invalid cursor format').optional(),
});

export type ListCommentsQueryInput = z.infer<typeof listCommentsQuerySchema>;
