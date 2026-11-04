/**
 * Pure builders for sandbox container configuration and lifecycle math.
 *
 * The container is hardened by default: no capabilities, no privilege
 * escalation, read-only root, a size-limited writable work dir, strict CPU /
 * memory / PID caps, and NO network unless the mission explicitly enables
 * scope-limited egress. Keeping this pure means the hardening is unit-tested
 * without needing a Docker daemon.
 */

export interface SandboxCaps {
  /** CPU cores (fractional allowed). */
  cpu: number;
  /** Memory limit in MB. */
  memoryMb: number;
  /** Writable work/tmp size in MB. */
  diskMb: number;
  /** Max processes. */
  pids?: number;
}

export interface BuildOptionsInput {
  image: string;
  missionId: string;
  sandboxId: string;
  caps: SandboxCaps;
  /** Docker network name to attach for scope-limited egress; omit = no network. */
  network?: string;
}

/** Produces a Docker Engine ContainerCreate payload (dockerode-compatible). */
export function buildContainerOptions(input: BuildOptionsInput): Record<string, unknown> {
  const { caps } = input;
  const memBytes = Math.floor(caps.memoryMb * 1024 * 1024);
  const hasNetwork = Boolean(input.network);

  return {
    Image: input.image,
    // Idle keeper; actual work runs via `exec`.
    Cmd: ['sleep', 'infinity'],
    Tty: false,
    WorkingDir: '/work',
    Env: ['LUNATIC_SANDBOX=1'],
    Labels: {
      'lunatic.managed': 'true',
      'lunatic.mission': input.missionId,
      'lunatic.sandbox': input.sandboxId,
    },
    // No network unless scope egress is explicitly configured.
    NetworkDisabled: !hasNetwork,
    HostConfig: {
      Memory: memBytes,
      MemorySwap: memBytes, // disable swap (swap == memory)
      NanoCpus: Math.floor(caps.cpu * 1e9),
      PidsLimit: caps.pids ?? 256,
      CapDrop: ['ALL'],
      SecurityOpt: ['no-new-privileges'],
      ReadonlyRootfs: true,
      // Writable, size-limited scratch space (noexec on /tmp).
      Tmpfs: {
        '/tmp': `rw,noexec,nosuid,size=${caps.diskMb}m`,
        '/work': `rw,nosuid,size=${caps.diskMb}m`,
      },
      NetworkMode: hasNetwork ? input.network : 'none',
      AutoRemove: false,
      // Prevent fork bombs / runaway restarts.
      RestartPolicy: { Name: 'no' },
    },
  };
}

export function computeRetentionExpiry(now: Date, retentionSeconds: number): Date {
  return new Date(now.getTime() + retentionSeconds * 1000);
}

export function isExpired(expiresAt: Date | null | undefined, now: Date): boolean {
  return Boolean(expiresAt && expiresAt.getTime() <= now.getTime());
}

/** Clamp a requested wall-clock to the configured maximum (seconds). */
export function effectiveWallclock(requested: number | undefined, max: number): number {
  if (!requested || requested <= 0) return max;
  return Math.min(requested, max);
}
