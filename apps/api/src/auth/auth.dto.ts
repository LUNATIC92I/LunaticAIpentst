import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12, 'Password must be at least 12 characters'),
  displayName: z.string().min(1).max(120).optional(),
  organizationName: z.string().min(1).max(120).optional(),
});
export type RegisterDto = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totp: z.string().regex(/^\d{6}$/).optional(),
});
export type LoginDto = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});
export type RefreshDto = z.infer<typeof refreshSchema>;

export const mfaVerifySchema = z.object({
  totp: z.string().regex(/^\d{6}$/),
});
export type MfaVerifyDto = z.infer<typeof mfaVerifySchema>;
