import { describe, it, expect } from 'vitest';
import { createBucket, tryConsume } from '../src/rate.js';

describe('token bucket', () => {
  const cfg = { capacity: 3, refillPerSecond: 1 };

  it('allows up to capacity then blocks', () => {
    let state = createBucket(cfg, 0);
    for (let i = 0; i < 3; i++) {
      const r = tryConsume(cfg, state, 0);
      expect(r.allowed).toBe(true);
      state = r.state;
    }
    expect(tryConsume(cfg, state, 0).allowed).toBe(false);
  });

  it('refills over time', () => {
    let state = createBucket(cfg, 0);
    for (let i = 0; i < 3; i++) state = tryConsume(cfg, state, 0).state;
    // 2 seconds later -> 2 tokens refilled
    const r = tryConsume(cfg, state, 2000);
    expect(r.allowed).toBe(true);
  });

  it('never exceeds capacity on refill', () => {
    const state = createBucket(cfg, 0);
    const r = tryConsume(cfg, state, 100000);
    expect(r.state.tokens).toBeLessThanOrEqual(cfg.capacity);
  });
});
