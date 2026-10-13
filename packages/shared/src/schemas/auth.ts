import { z } from 'zod';

export const loginSchema = z.object({
  // SEC-09: trim whitespace and lowercase before lookup so 'boss ', 'BoSs' etc. all
  // map to the same DB row and lockout counter, preventing bypass via username variants.
  username: z.string().min(1, 'Username is required').max(64).trim().toLowerCase(),
  password: z.string().min(1, 'Password is required').max(256),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1).max(256),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
