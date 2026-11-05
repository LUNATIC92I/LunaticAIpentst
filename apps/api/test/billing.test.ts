import { describe, it, expect } from 'vitest';
import { PLANS, planConfig, listPlans, remainingCredits } from '../src/billing/plans';

describe('plan catalog', () => {
  it('has all five tiers in ascending price', () => {
    const prices = listPlans().map((p) => p.priceCentsMonthly);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(Object.keys(PLANS)).toEqual(['FREE', 'PRO', 'PRO_PLUS', 'ULTRA', 'TEAM']);
  });
  it('increases credits and limits with tier', () => {
    expect(planConfig('FREE').monthlyCredits).toBeLessThan(planConfig('PRO').monthlyCredits);
    expect(planConfig('PRO').maxConcurrentMissions).toBeLessThan(planConfig('ULTRA').maxConcurrentMissions);
    expect(planConfig('TEAM').seats).toBeGreaterThan(1);
  });
  it('gates MAX profile to higher tiers', () => {
    expect(planConfig('FREE').agentProfiles).not.toContain('MAX');
    expect(planConfig('PRO_PLUS').agentProfiles).toContain('MAX');
  });
  it('falls back to FREE for an unknown tier', () => {
    // @ts-expect-error testing fallback
    expect(planConfig('NOPE').tier).toBe('FREE');
  });
});

describe('remainingCredits', () => {
  it('computes plan + purchased - consumed, floored at 0', () => {
    expect(remainingCredits(10000, 500, 3000)).toBe(7500);
    expect(remainingCredits(500, 0, 9999)).toBe(0);
  });
});
