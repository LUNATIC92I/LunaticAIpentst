import { describe, it, expect } from 'vitest';
import {
  buildContainerOptions,
  computeRetentionExpiry,
  isExpired,
  effectiveWallclock,
} from '../src/sandbox/container-options';

describe('buildContainerOptions — hardening', () => {
  const opts = buildContainerOptions({
    image: 'lunatic/kali-tools:latest',
    missionId: 'm1',
    sandboxId: 's1',
    caps: { cpu: 2, memoryMb: 2048, diskMb: 4096, pids: 256 },
  }) as any;

  it('applies CPU, memory and PID caps', () => {
    expect(opts.HostConfig.NanoCpus).toBe(2_000_000_000);
    expect(opts.HostConfig.Memory).toBe(2048 * 1024 * 1024);
    expect(opts.HostConfig.MemorySwap).toBe(opts.HostConfig.Memory); // swap disabled
    expect(opts.HostConfig.PidsLimit).toBe(256);
  });

  it('drops all capabilities and blocks privilege escalation', () => {
    expect(opts.HostConfig.CapDrop).toEqual(['ALL']);
    expect(opts.HostConfig.SecurityOpt).toContain('no-new-privileges');
    expect(opts.HostConfig.ReadonlyRootfs).toBe(true);
  });

  it('has no network by default (egress disabled)', () => {
    expect(opts.NetworkDisabled).toBe(true);
    expect(opts.HostConfig.NetworkMode).toBe('none');
  });

  it('enables a network only when explicitly configured', () => {
    const net = buildContainerOptions({
      image: 'i',
      missionId: 'm',
      sandboxId: 's',
      caps: { cpu: 1, memoryMb: 512, diskMb: 512 },
      network: 'lunatic-scope-net',
    }) as any;
    expect(net.NetworkDisabled).toBe(false);
    expect(net.HostConfig.NetworkMode).toBe('lunatic-scope-net');
  });

  it('provides size-limited writable scratch only', () => {
    expect(opts.HostConfig.Tmpfs['/work']).toContain('size=4096m');
    expect(opts.HostConfig.Tmpfs['/tmp']).toContain('noexec');
  });

  it('labels the container for lifecycle management', () => {
    expect(opts.Labels['lunatic.managed']).toBe('true');
    expect(opts.Labels['lunatic.mission']).toBe('m1');
  });
});

describe('retention', () => {
  it('computes an expiry and detects it', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const exp = computeRetentionExpiry(now, 3600);
    expect(exp.getTime()).toBe(now.getTime() + 3600_000);
    expect(isExpired(exp, now)).toBe(false);
    expect(isExpired(exp, new Date(exp.getTime() + 1))).toBe(true);
    expect(isExpired(null, now)).toBe(false);
  });
});

describe('effectiveWallclock', () => {
  it('clamps to the configured maximum', () => {
    expect(effectiveWallclock(100, 1800)).toBe(100);
    expect(effectiveWallclock(5000, 1800)).toBe(1800);
    expect(effectiveWallclock(undefined, 1800)).toBe(1800);
  });
});
