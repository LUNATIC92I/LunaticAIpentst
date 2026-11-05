import { TaskStatus } from '@lunatic/database';

/**
 * Mission state machine. Only these transitions are legal; any other is
 * rejected. The agent (Phase 6) drives PLANNING->RUNNING->... automatically, but
 * the same rules apply whether a human or the agent requests the transition.
 */
export const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  DRAFT: ['SCOPING', 'ARCHIVED'],
  SCOPING: ['PLANNING', 'RUNNING', 'DRAFT', 'ARCHIVED'],
  PLANNING: ['RUNNING', 'PAUSED', 'FAILED', 'ARCHIVED'],
  RUNNING: ['PAUSED', 'AWAITING_APPROVAL', 'COMPLETED', 'FAILED', 'ARCHIVED'],
  PAUSED: ['RUNNING', 'COMPLETED', 'FAILED', 'ARCHIVED'],
  AWAITING_APPROVAL: ['RUNNING', 'PAUSED', 'FAILED', 'ARCHIVED'],
  COMPLETED: ['ARCHIVED'],
  FAILED: ['ARCHIVED', 'DRAFT'],
  ARCHIVED: [],
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
