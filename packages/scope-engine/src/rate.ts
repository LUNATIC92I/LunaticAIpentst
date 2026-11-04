/**
 * Simple token-bucket rate limiter for per-target request frequency caps.
 * Pure & deterministic (time is injected) so it is unit-testable. Even in
 * AUTONOMOUS permission mode, frequency caps remain enforced.
 */
export interface RateLimitConfig {
  /** Maximum burst capacity. */
  capacity: number;
  /** Tokens refilled per second. */
  refillPerSecond: number;
}

export interface BucketState {
  tokens: number;
  lastRefillMs: number;
}

export function createBucket(config: RateLimitConfig, nowMs: number): BucketState {
  return { tokens: config.capacity, lastRefillMs: nowMs };
}

/**
 * Attempt to consume one token. Returns the (new) state and whether it was
 * allowed. Does not mutate the input state.
 */
export function tryConsume(
  config: RateLimitConfig,
  state: BucketState,
  nowMs: number,
  cost = 1,
): { state: BucketState; allowed: boolean } {
  const elapsedSec = Math.max(0, (nowMs - state.lastRefillMs) / 1000);
  const refilled = Math.min(config.capacity, state.tokens + elapsedSec * config.refillPerSecond);
  if (refilled >= cost) {
    return { state: { tokens: refilled - cost, lastRefillMs: nowMs }, allowed: true };
  }
  return { state: { tokens: refilled, lastRefillMs: nowMs }, allowed: false };
}
