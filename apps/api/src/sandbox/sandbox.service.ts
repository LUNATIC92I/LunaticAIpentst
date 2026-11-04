import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { DockerDriver } from './docker-driver';
import {
  SandboxUnavailableError,
  type ExecResult,
  type SandboxDriver,
} from './sandbox.types';
import {
  computeRetentionExpiry,
  effectiveWallclock,
  isExpired,
  type SandboxCaps,
} from './container-options';

function num(env: string | undefined, fallback: number): number {
  const n = Number(env);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

@Injectable()
export class SandboxService {
  private readonly logger = new Logger(SandboxService.name);
  private driverInstance: SandboxDriver | null | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private caps(): SandboxCaps {
    return {
      cpu: num(process.env.SANDBOX_CPU_LIMIT, 2),
      memoryMb: num(process.env.SANDBOX_MEMORY_LIMIT, 2048),
      diskMb: num(process.env.SANDBOX_DISK_LIMIT, 4096),
      pids: 256,
    };
  }

  private image(): string {
    return process.env.SANDBOX_DEFAULT_IMAGE || 'lunatic/kali-tools:latest';
  }

  private wallclock(): number {
    return num(process.env.SANDBOX_WALLCLOCK_LIMIT, 1800);
  }

  private retentionSeconds(): number {
    return num(process.env.SANDBOX_RETENTION_SECONDS, 86400);
  }

  /** Build the configured driver (docker | none). */
  driver(): SandboxDriver | null {
    if (this.driverInstance !== undefined) return this.driverInstance;
    const kind = (process.env.SANDBOX_DRIVER || 'docker').toLowerCase();
    this.driverInstance = kind === 'docker' ? new DockerDriver() : null;
    return this.driverInstance;
  }

  /** Public status for the UI — never throws. */
  async status() {
    const driver = this.driver();
    const available = driver ? await driver.available().catch(() => false) : false;
    return {
      driver: driver?.name ?? (process.env.SANDBOX_DRIVER || 'none'),
      available,
      caps: this.caps(),
      wallclockLimit: this.wallclock(),
      retentionSeconds: this.retentionSeconds(),
    };
  }

  private async mustOwnMission(orgId: string, missionId: string) {
    const m = await this.prisma.task.findFirst({ where: { id: missionId, orgId } });
    if (!m) throw new NotFoundException('Mission not found');
    return m;
  }

  list(orgId: string, missionId?: string) {
    return this.prisma.sandbox.findMany({
      where: { task: { orgId }, ...(missionId ? { taskId: missionId } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { events: { orderBy: { createdAt: 'desc' }, take: 5 } },
    });
  }

  /** Create + start a sandbox for a mission. Honest ERROR if driver unavailable. */
  async create(orgId: string, missionId: string, actorId?: string) {
    await this.mustOwnMission(orgId, missionId);
    const driver = this.driver();
    const caps = this.caps();

    const sandbox = await this.prisma.sandbox.create({
      data: {
        taskId: missionId,
        driver: driver?.name ?? 'none',
        image: this.image(),
        status: 'CREATING',
        cpuLimit: caps.cpu,
        memoryLimit: caps.memoryMb,
        diskLimit: caps.diskMb,
        wallclockLimit: this.wallclock(),
        retentionExpiresAt: computeRetentionExpiry(new Date(), this.retentionSeconds()),
      },
    });
    await this.event(sandbox.id, 'created', 'Sandbox record created');

    if (!driver || !(await driver.available())) {
      await this.prisma.sandbox.update({ where: { id: sandbox.id }, data: { status: 'ERROR' } });
      await this.event(sandbox.id, 'error', 'Sandbox driver unavailable (backend unreachable)');
      throw new SandboxUnavailableError(driver?.name ?? 'none');
    }

    try {
      const { externalId } = await driver.create({
        image: this.image(),
        missionId,
        sandboxId: sandbox.id,
        caps,
      });
      await driver.start(externalId);
      const updated = await this.prisma.sandbox.update({
        where: { id: sandbox.id },
        data: { status: 'RUNNING', externalId },
      });
      await this.event(sandbox.id, 'started', `Container ${externalId.slice(0, 12)} started`);
      await this.audit.record({ orgId, actorId, action: 'sandbox.create', target: missionId });
      return updated;
    } catch (err) {
      await this.prisma.sandbox.update({ where: { id: sandbox.id }, data: { status: 'ERROR' } });
      await this.event(sandbox.id, 'error', String(err).slice(0, 300));
      throw err;
    }
  }

  async stop(orgId: string, id: string) {
    const sb = await this.ownSandbox(orgId, id);
    if (sb.externalId && this.driver()) await this.driver()!.stop(sb.externalId);
    await this.event(sb.id, 'stopped', 'Sandbox stopped');
    return this.prisma.sandbox.update({ where: { id }, data: { status: 'STOPPED' } });
  }

  async destroy(orgId: string, id: string) {
    const sb = await this.ownSandbox(orgId, id);
    if (sb.externalId && this.driver()) await this.driver()!.destroy(sb.externalId);
    await this.event(sb.id, 'destroyed', 'Sandbox destroyed');
    return this.prisma.sandbox.update({
      where: { id },
      data: { status: 'DESTROYED', destroyedAt: new Date() },
    });
  }

  private async ownSandbox(orgId: string, id: string) {
    const sb = await this.prisma.sandbox.findFirst({ where: { id, task: { orgId } } });
    if (!sb) throw new NotFoundException('Sandbox not found');
    return sb;
  }

  /** Find a RUNNING sandbox for the mission, or create one. */
  async ensureForMission(orgId: string, missionId: string) {
    const existing = await this.prisma.sandbox.findFirst({
      where: { taskId: missionId, status: 'RUNNING' },
      orderBy: { createdAt: 'desc' },
    });
    if (existing && !isExpired(existing.retentionExpiresAt, new Date())) return existing;
    return this.create(orgId, missionId);
  }

  /** Run a tool command inside the mission's sandbox. Throws if unavailable. */
  async runTool(
    orgId: string,
    missionId: string,
    command: string[],
    timeoutSeconds?: number,
  ): Promise<{ sandboxId: string; externalId: string; result: ExecResult }> {
    const driver = this.driver();
    if (!driver || !(await driver.available())) {
      throw new SandboxUnavailableError(driver?.name ?? 'none');
    }
    const sandbox = await this.ensureForMission(orgId, missionId);
    if (!sandbox.externalId) throw new SandboxUnavailableError(driver.name);
    const timeout = effectiveWallclock(timeoutSeconds, this.wallclock());
    const result = await driver.exec(sandbox.externalId, command, timeout);
    return { sandboxId: sandbox.id, externalId: sandbox.externalId, result };
  }

  /** Open an interactive PTY in the mission's sandbox (for the terminal). */
  async openTerminal(orgId: string, missionId: string) {
    await this.mustOwnMission(orgId, missionId);
    const driver = this.driver();
    if (!(driver instanceof DockerDriver) || !(await driver.available())) {
      throw new SandboxUnavailableError(driver?.name ?? 'none');
    }
    const sandbox = await this.ensureForMission(orgId, missionId);
    if (!sandbox.externalId) throw new SandboxUnavailableError(driver.name);
    await this.event(sandbox.id, 'terminal_open', 'Interactive terminal attached');
    return driver.execPty(sandbox.externalId);
  }

  /** Destroy sandboxes past their retention window (called opportunistically). */
  async cleanupExpired() {
    const now = new Date();
    const expired = await this.prisma.sandbox.findMany({
      where: { status: { in: ['RUNNING', 'STOPPED'] }, retentionExpiresAt: { lte: now } },
    });
    for (const sb of expired) {
      if (sb.externalId && this.driver()) await this.driver()!.destroy(sb.externalId).catch(() => undefined);
      await this.prisma.sandbox.update({
        where: { id: sb.id },
        data: { status: 'DESTROYED', destroyedAt: now },
      });
      await this.event(sb.id, 'destroyed', 'Retention window elapsed');
    }
    return { destroyed: expired.length };
  }

  private event(sandboxId: string, kind: string, message: string) {
    return this.prisma.sandboxEvent.create({ data: { sandboxId, kind, message } });
  }
}
