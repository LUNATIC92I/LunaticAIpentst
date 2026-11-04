/**
 * Agent planning — pure and deterministic so it can be unit-tested.
 *
 * The planner decomposes a mission into ordered steps. Each step names a single
 * action against a single authorized target. Execution is still gated at run
 * time by the scope guard and permission mode; the plan only proposes work.
 */
import type { ScopeEntry } from '@lunatic/scope-engine';

export type StepAction = 'scope_verify' | 'dns_recon' | 'tool';
export type StepRisk = 'low' | 'medium' | 'high';

export interface PlanStep {
  index: number;
  title: string;
  action: StepAction;
  target: string;
  tool?: string;
  rationale: string;
  risk: StepRisk;
}

/** Tools we plan for, with their default risk. Execution lands in Phase 7/9. */
const RECON_TOOLS: { tool: string; risk: StepRisk; forHosts: boolean }[] = [
  { tool: 'httpx', risk: 'medium', forHosts: true },
  { tool: 'nuclei', risk: 'high', forHosts: true },
  { tool: 'nmap', risk: 'high', forHosts: false },
];

/**
 * Build a baseline reconnaissance plan from the authorized scope. For every
 * target we first VERIFY authorization, then (for hostnames) resolve DNS, then
 * propose scope-limited tool steps. Steps never exceed `maxSteps`.
 */
export function buildBaselinePlan(entries: ScopeEntry[], maxSteps: number): PlanStep[] {
  const steps: PlanStep[] = [];
  let index = 0;
  const push = (s: Omit<PlanStep, 'index'>) => {
    if (steps.length < maxSteps) steps.push({ index: index++, ...s });
  };

  for (const entry of entries) {
    if (entry.type === 'cidr') {
      // CIDR ranges are expanded by active tooling, not pre-resolved here.
      push({
        title: `Verify authorization for ${entry.value}`,
        action: 'scope_verify',
        target: entry.value,
        rationale: 'Confirm the CIDR range is within authorized scope before any scan.',
        risk: 'low',
      });
      continue;
    }

    const isHost = entry.type === 'host';
    push({
      title: `Verify authorization for ${entry.value}`,
      action: 'scope_verify',
      target: entry.value,
      rationale: 'Confirm the target is in scope and does not resolve to a blocked range.',
      risk: 'low',
    });
    if (isHost) {
      push({
        title: `DNS reconnaissance for ${entry.value}`,
        action: 'dns_recon',
        target: entry.value,
        rationale: 'Resolve A/AAAA records to enumerate hosts within scope.',
        risk: 'low',
      });
    }
    for (const t of RECON_TOOLS) {
      if (t.forHosts && !isHost) continue;
      push({
        title: `${t.tool} on ${entry.value}`,
        action: 'tool',
        tool: t.tool,
        target: entry.value,
        rationale: `Run ${t.tool} against the authorized target to gather service/technology data.`,
        risk: t.risk,
      });
    }
  }
  return steps;
}
