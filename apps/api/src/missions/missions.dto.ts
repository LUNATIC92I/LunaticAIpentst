import { z } from 'zod';

export const createMissionSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(4000).optional(),
  mode: z.enum(['CHAT', 'AGENT']).default('CHAT'),
  permissionMode: z.enum(['APPROVAL', 'SUPERVISED', 'AUTONOMOUS']).default('APPROVAL'),
  agentProfile: z.enum(['STANDARD', 'PRO', 'MAX']).default('STANDARD'),
});
export type CreateMissionDto = z.infer<typeof createMissionSchema>;

export const updateMissionSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  description: z.string().max(4000).optional(),
  mode: z.enum(['CHAT', 'AGENT']).optional(),
  permissionMode: z.enum(['APPROVAL', 'SUPERVISED', 'AUTONOMOUS']).optional(),
  agentProfile: z.enum(['STANDARD', 'PRO', 'MAX']).optional(),
});
export type UpdateMissionDto = z.infer<typeof updateMissionSchema>;

export const transitionSchema = z.object({
  to: z.enum([
    'DRAFT',
    'SCOPING',
    'PLANNING',
    'RUNNING',
    'PAUSED',
    'AWAITING_APPROVAL',
    'COMPLETED',
    'FAILED',
    'ARCHIVED',
  ]),
});
export type TransitionDto = z.infer<typeof transitionSchema>;

export const addScopeEntrySchema = z.object({
  type: z.enum(['host', 'ip', 'cidr']),
  value: z.string().min(1).max(255),
  note: z.string().max(255).optional(),
});
export type AddScopeEntryDto = z.infer<typeof addScopeEntrySchema>;

export const scopeCheckSchema = z.object({
  target: z.string().min(1).max(255),
  active: z.boolean().default(true),
  allowPrivateRanges: z.boolean().default(false),
});
export type ScopeCheckDto = z.infer<typeof scopeCheckSchema>;

export const postMessageSchema = z.object({
  content: z.string().min(1).max(16000),
});
export type PostMessageDto = z.infer<typeof postMessageSchema>;
