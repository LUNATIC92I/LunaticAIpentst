/**
 * Plan catalog (pure). Prices are defaults and are overridable from the admin
 * panel; limits are enforced by the usage/quota layer. Kept pure so the catalog
 * and limit math are unit-testable.
 */
export type PlanTier = 'FREE' | 'PRO' | 'PRO_PLUS' | 'ULTRA' | 'TEAM';

export interface PlanConfig {
  tier: PlanTier;
  name: string;
  priceCentsMonthly: number;
  monthlyCredits: number;
  maxConcurrentMissions: number;
  maxSandboxes: number;
  agentProfiles: ('STANDARD' | 'PRO' | 'MAX')[];
  seats: number;
  features: string[];
}

export const PLANS: Record<PlanTier, PlanConfig> = {
  FREE: {
    tier: 'FREE',
    name: 'Free',
    priceCentsMonthly: 0,
    monthlyCredits: 500,
    maxConcurrentMissions: 1,
    maxSandboxes: 1,
    agentProfiles: ['STANDARD'],
    seats: 1,
    features: ['CHAT mode', '1 mission at a time', 'Community support'],
  },
  PRO: {
    tier: 'PRO',
    name: 'Pro',
    priceCentsMonthly: 4900,
    monthlyCredits: 10_000,
    maxConcurrentMissions: 3,
    maxSandboxes: 2,
    agentProfiles: ['STANDARD', 'PRO'],
    seats: 1,
    features: ['Agent mode', 'Sandbox execution', 'PDF reports', 'Email support'],
  },
  PRO_PLUS: {
    tier: 'PRO_PLUS',
    name: 'Pro Plus',
    priceCentsMonthly: 9900,
    monthlyCredits: 30_000,
    maxConcurrentMissions: 6,
    maxSandboxes: 4,
    agentProfiles: ['STANDARD', 'PRO', 'MAX'],
    seats: 1,
    features: ['Everything in Pro', 'MAX profile', 'Higher limits', 'Priority queue'],
  },
  ULTRA: {
    tier: 'ULTRA',
    name: 'Ultra',
    priceCentsMonthly: 24900,
    monthlyCredits: 100_000,
    maxConcurrentMissions: 12,
    maxSandboxes: 8,
    agentProfiles: ['STANDARD', 'PRO', 'MAX'],
    seats: 1,
    features: ['Everything in Pro Plus', 'Priority access', 'Advanced capacity'],
  },
  TEAM: {
    tier: 'TEAM',
    name: 'Team',
    priceCentsMonthly: 49900,
    monthlyCredits: 250_000,
    maxConcurrentMissions: 25,
    maxSandboxes: 16,
    agentProfiles: ['STANDARD', 'PRO', 'MAX'],
    seats: 10,
    features: ['Everything in Ultra', 'Collaborative workspace', 'Member management', 'SSO-ready'],
  },
};

export function planConfig(tier: PlanTier): PlanConfig {
  return PLANS[tier] ?? PLANS.FREE;
}

export function listPlans(): PlanConfig[] {
  return Object.values(PLANS);
}

/** Remaining credits in the period: granted (plan + purchased) minus consumed. */
export function remainingCredits(planCredits: number, purchased: number, consumed: number): number {
  return Math.max(0, planCredits + purchased - consumed);
}
