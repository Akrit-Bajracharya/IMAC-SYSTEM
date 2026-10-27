import { z } from 'zod';

/**
 * Validates that a numeric hour value is in 15-minute / 0.25-hour increments.
 */
export function isQuarterHourIncrement(val: number): boolean {
  return Math.round(val * 100) % 25 === 0;
}

/**
 * Validates that an ISO date string is a real calendar date YYYY-MM-DD.
 */
export function isValidCalendarDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export const workLogEntrySchema = z.object({
  id: z.string().uuid().optional(),
  workRoleId: z.string().min(1, 'workRoleId is required'),
  hours: z
    .number()
    .positive('Hours must be greater than 0')
    .max(24, 'Hours cannot exceed 24')
    .refine(isQuarterHourIncrement, {
      message: 'Hours must be entered in 15-minute (0.25) increments',
    }),
  description: z.string().max(1000).trim().optional().nullable(),
  projectId: z.string().max(100).trim().optional().nullable(),
  taskId: z.string().max(100).trim().optional().nullable(),
});

export const workLogEntriesArraySchema = z
  .array(workLogEntrySchema)
  .min(1, 'At least one work log entry is required')
  .refine(
    (entries) => {
      const total = entries.reduce((sum, e) => sum + e.hours, 0);
      return total <= 24;
    },
    { message: 'Total hours across all entries cannot exceed 24' },
  );

export const upsertWorkLogDraftSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD')
    .refine(isValidCalendarDate, { message: 'Invalid calendar date' }),
  entries: workLogEntriesArraySchema,
});

export const patchWorkLogSchema = z.object({
  entries: workLogEntriesArraySchema,
});

export const adminWorkLogOverrideSchema = z.object({
  reason: z.string().trim().min(1, 'Reason is required and cannot be empty'),
  entries: workLogEntriesArraySchema,
});

export const byDateQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD')
    .refine(isValidCalendarDate, { message: 'Invalid calendar date' }),
});

export const byWeekQuerySchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be formatted as YYYY-MM-DD')
    .refine(isValidCalendarDate, { message: 'Invalid calendar date' }),
});

export const byMonthQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export type WorkLogEntryInput = z.infer<typeof workLogEntrySchema>;
export type UpsertWorkLogDraftInput = z.infer<typeof upsertWorkLogDraftSchema>;
export type PatchWorkLogInput = z.infer<typeof patchWorkLogSchema>;
export type AdminWorkLogOverrideInput = z.infer<typeof adminWorkLogOverrideSchema>;
export type ByDateQueryInput = z.infer<typeof byDateQuerySchema>;
export type ByWeekQueryInput = z.infer<typeof byWeekQuerySchema>;
export type ByMonthQueryInput = z.infer<typeof byMonthQuerySchema>;

export const workLogExportQuerySchema = z
  .object({
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be formatted as YYYY-MM-DD')
      .refine(isValidCalendarDate, { message: 'Invalid calendar date for startDate' }),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be formatted as YYYY-MM-DD')
      .refine(isValidCalendarDate, { message: 'Invalid calendar date for endDate' }),
    employee: z.string().trim().min(1).optional(),
    team: z.string().trim().min(1).optional(),
    workRoleId: z.string().trim().min(1).optional(),
    projectId: z.string().trim().min(1).optional(),
    status: z.enum(['draft', 'submitted', 'approved', 'rejected']).optional(),
  })
  .refine(
    (data) => {
      const [sy, sm, sd] = data.startDate.split('-').map(Number);
      const [ey, em, ed] = data.endDate.split('-').map(Number);
      const startUtc = Date.UTC(sy, sm - 1, sd);
      const endUtc = Date.UTC(ey, em - 1, ed);
      return endUtc >= startUtc;
    },
    { message: 'endDate must be greater than or equal to startDate', path: ['endDate'] },
  )
  .refine(
    (data) => {
      const [sy, sm, sd] = data.startDate.split('-').map(Number);
      const [ey, em, ed] = data.endDate.split('-').map(Number);
      const startUtc = Date.UTC(sy, sm - 1, sd);
      const endUtc = Date.UTC(ey, em - 1, ed);
      const diffDays = Math.round((endUtc - startUtc) / (24 * 60 * 60 * 1000));
      return diffDays <= 366;
    },
    { message: 'Date range cannot exceed 366 days', path: ['endDate'] },
  );

export type WorkLogExportQueryInput = z.infer<typeof workLogExportQuerySchema>;
