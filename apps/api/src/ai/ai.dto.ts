import { z } from 'zod';

export const addProviderSchema = z.object({
  kind: z.enum(['ANTHROPIC', 'OPENAI', 'GEMINI', 'DEEPSEEK', 'OPENROUTER', 'CUSTOM', 'MOCK']),
  label: z.string().min(1).max(80),
  baseUrl: z.string().url().optional(),
  apiKey: z.string().min(1).max(400).optional(),
  defaultModel: z.string().min(1).max(120),
});
export type AddProviderDto = z.infer<typeof addProviderSchema>;

export const addModelSchema = z.object({
  name: z.string().min(1).max(120),
  displayName: z.string().max(120).optional(),
});
export type AddModelDto = z.infer<typeof addModelSchema>;
