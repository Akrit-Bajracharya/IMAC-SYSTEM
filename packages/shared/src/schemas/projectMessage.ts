import { z } from 'zod';

export const createProjectMessageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Message body cannot be empty')
    .max(5000, 'Message body cannot exceed 5000 characters'),
});

export const listProjectMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().uuid().optional(),
});

export type CreateProjectMessageInput = z.infer<typeof createProjectMessageSchema>;
export type ListProjectMessagesQueryInput = z.infer<typeof listProjectMessagesQuerySchema>;
