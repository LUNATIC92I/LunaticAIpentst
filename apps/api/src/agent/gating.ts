/**
 * Permission-mode gating (pure). Decides whether a planned step may run
 * automatically or needs explicit human approval, based on the mission's
 * permission mode and the step's risk. Scope limits, prohibitions and resource
 * caps are enforced separately and ALWAYS apply, even in AUTONOMOUS mode.
 */
import type { StepRisk } from './plan';

export type PermissionMode = 'APPROVAL' | 'SUPERVISED' | 'AUTONOMOUS';

/** True if the step may auto-run; false if it must be approved first. */
export function autoApproves(mode: PermissionMode, risk: StepRisk): boolean {
  switch (mode) {
    case 'APPROVAL':
      // Every action requires explicit approval.
      return false;
    case 'SUPERVISED':
      // Low-risk actions run automatically; medium/high need approval.
      return risk === 'low';
    case 'AUTONOMOUS':
      // Pre-authorized scope lets steps chain without per-step approval.
      return true;
    default:
      return false;
  }
}
