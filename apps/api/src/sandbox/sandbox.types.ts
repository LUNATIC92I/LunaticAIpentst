import type { SandboxCaps } from './container-options';

export interface CreateSandboxRequest {
  image: string;
  missionId: string;
  sandboxId: string;
  caps: SandboxCaps;
  network?: string;
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * A sandbox driver runs commands in an isolated environment. The application
 * server NEVER executes agent/tool commands directly — only a driver does.
 */
export interface SandboxDriver {
  readonly name: string;
  /** Whether the driver's backend is reachable right now. */
  available(): Promise<boolean>;
  create(req: CreateSandboxRequest): Promise<{ externalId: string }>;
  start(externalId: string): Promise<void>;
  stop(externalId: string): Promise<void>;
  destroy(externalId: string): Promise<void>;
  /** Run a command and collect output, with a wall-clock timeout (seconds). */
  exec(externalId: string, command: string[], timeoutSeconds: number): Promise<ExecResult>;
}

export class SandboxUnavailableError extends Error {
  constructor(driver: string) {
    super(`Sandbox driver "${driver}" is not available (backend unreachable).`);
    this.name = 'SandboxUnavailableError';
  }
}
