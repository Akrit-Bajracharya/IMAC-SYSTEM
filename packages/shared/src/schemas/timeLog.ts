import { z } from 'zod';
import { isQuarterHourIncrement } from './workLog.js';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const createTimeLogSchema = z
  .object({
    taskId: z.string().uuid('Invalid taskId format').nullable().optional(),
    workDate: z.string().regex(dateRegex, 'workDate must be in YYYY-MM-DD format'),
    hours: z
      .number()
      .positive('Hours must be greater than 0')
      .max(24, 'Hours cannot exceed 24')
      .refine(isQuarterHourIncrement, {
        message: 'hours must be entered in 15-minute (0.25) increments',
      }),
    note: z
      .string()
      .trim()
      .max(5000, 'Note must be 5000 characters or less')
      .nullable()
      .optional(),
  })
  .strict();

export type CreateTimeLogInput = z.infer<typeof createTimeLogSchema>;

export const patchTimeLogSchema = z
  .object({
    taskId: z.string().uuid('Invalid taskId format').nullable().optional(),
    workDate: z.string().regex(dateRegex, 'workDate must be in YYYY-MM-DD format').optional(),
    hours: z
      .number()
      .positive('Hours must be greater than 0')
      .max(24, 'Hours cannot exceed 24')
      .refine(isQuarterHourIncrement, {
        message: 'hours must be entered in 15-minute (0.25) increments',
      })
      .optional(),
    note: z
      .string()
      .trim()
      .max(5000, 'Note must be 5000 characters or less')
      .nullable()
      .optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update',
  });

export type PatchTimeLogInput = z.infer<typeof patchTimeLogSchema>;

export const listTimeLogsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().uuid('Invalid cursor format').optional(),
  userId: z.string().uuid('Invalid userId format').optional(),
  taskId: z.string().uuid('Invalid taskId format').optional(),
});

export type ListTimeLogsQuery = z.infer<typeof listTimeLogsQuerySchema>;
