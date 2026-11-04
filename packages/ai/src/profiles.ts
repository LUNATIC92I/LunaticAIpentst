/**
 * Agent profiles map to real generation configs, not cosmetic labels.
 * STANDARD = assistance/analysis; PRO = deeper reasoning + wider tool budget;
 * MAX = advanced planning + orchestration of complex missions.
 */
export type AgentProfile = 'STANDARD' | 'PRO' | 'MAX';

export interface ProfileConfig {
  /** Default upper bound on output tokens per turn. */
  maxTokens: number;
  /** Sampling temperature. */
  temperature: number;
  /** Max tool invocations the agent may chain per step (Phase 6). */
  toolBudget: number;
  /** Max planning depth / steps the planner may expand (Phase 6). */
  maxPlanSteps: number;
}

export const PROFILES: Record<AgentProfile, ProfileConfig> = {
  STANDARD: { maxTokens: 1024, temperature: 0.2, toolBudget: 3, maxPlanSteps: 5 },
  PRO: { maxTokens: 4096, temperature: 0.3, toolBudget: 8, maxPlanSteps: 12 },
  MAX: { maxTokens: 8192, temperature: 0.4, toolBudget: 20, maxPlanSteps: 30 },
};

export function profileConfig(profile: AgentProfile): ProfileConfig {
  return PROFILES[profile];
}
