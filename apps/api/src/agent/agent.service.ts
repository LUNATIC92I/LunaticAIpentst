import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { ScopeGuardService } from '../scope/scope-guard.service';
import { SandboxService } from '../sandbox/sandbox.service';
import { SandboxUnavailableError } from '../sandbox/sandbox.types';
import { EvidenceService } from './evidence.service';
import { buildBaselinePlan, type PlanStep } from './plan';
import { autoApproves, type PermissionMode } from './gating';
import { profileConfig, type AgentProfile } from '@lunatic/ai';
import type { ScopeEntry } from '@lunatic/scope-engine';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly scopeGuard: ScopeGuardService,
    private readonly evidence: EvidenceService,
    private readonly sandbox: SandboxService,
  ) {}

  private async mustOwn(orgId: string, missionId: string) {
    const m = await this.prisma.task.findFirst({ where: { id: missionId, orgId } });
    if (!m) throw new NotFoundException('Mission not found');
    return m;
  }

  private async scopeEntries(missionId: string): Promise<ScopeEntry[]> {
    const rows = await this.prisma.scopeEntry.findMany({ where: { taskId: missionId } });
    return rows.map((r) => ({ type: r.type as ScopeEntry['type'], value: r.value, note: r.note ?? undefined }));
  }

  /** Build and persist a plan + one execution per step (gated by permission mode). */
  async plan(orgId: string, missionId: string, actorId: string) {
    const mission = await this.mustOwn(orgId, missionId);
    const entries = await this.scopeEntries(missionId);
    if (entries.length === 0) {
      throw new BadRequestException('Define an authorized scope before planning.');
    }

    const cfg = profileConfig(mission.agentProfile as AgentProfile);
    const steps = buildBaselinePlan(entries, cfg.maxPlanSteps);

    const latest = await this.prisma.taskPlan.findFirst({
      where: { taskId: missionId },
      orderBy: { version: 'desc' },
    });
    const version = (latest?.version ?? 0) + 1;

    const plan = await this.prisma.taskPlan.create({
      data: { taskId: missionId, version, steps: steps as object },
    });

    // One execution row per step; status reflects permission-mode gating.
    const mode = mission.permissionMode as PermissionMode;
    await this.prisma.$transaction(
      steps.map((s) =>
        this.prisma.taskExecution.create({
          data: {
            taskId: missionId,
            planId: plan.id,
            stepIndex: s.index,
            status: autoApproves(mode, s.risk) ? 'APPROVED' : 'PENDING',
            summary: s.title,
          },
        }),
      ),
    );

    if (mission.status === 'DRAFT' || mission.status === 'SCOPING') {
      await this.prisma.task.update({ where: { id: missionId }, data: { status: 'PLANNING' } });
    }
    await this.audit.record({ orgId, actorId, action: 'agent.plan', target: missionId, metadata: { version, steps: steps.length } });

    return { plan, steps, executions: await this.executions(orgId, missionId) };
  }

  async getPlan(orgId: string, missionId: string) {
    await this.mustOwn(orgId, missionId);
    const plan = await this.prisma.taskPlan.findFirst({
      where: { taskId: missionId },
      orderBy: { version: 'desc' },
    });
    return plan;
  }

  async executions(orgId: string, missionId: string) {
    await this.mustOwn(orgId, missionId);
    return this.prisma.taskExecution.findMany({
      where: { taskId: missionId },
      orderBy: { stepIndex: 'asc' },
      include: { toolRuns: { include: { outputs: true } } },
    });
  }

  async approve(orgId: string, missionId: string, execId: string, actorId: string, approved: boolean) {
    await this.mustOwn(orgId, missionId);
    const exec = await this.prisma.taskExecution.findFirst({ where: { id: execId, taskId: missionId } });
    if (!exec) throw new NotFoundException('Execution not found');
    if (exec.status !== 'PENDING') throw new BadRequestException(`Execution is ${exec.status}, not PENDING`);
    const updated = await this.prisma.taskExecution.update({
      where: { id: execId },
      data: { status: approved ? 'APPROVED' : 'REJECTED' },
    });
    await this.audit.record({
      orgId,
      actorId,
      action: approved ? 'agent.step.approve' : 'agent.step.reject',
      target: missionId,
      metadata: { execId, stepIndex: exec.stepIndex },
    });
    return updated;
  }

  /** Run the next APPROVED, not-yet-started step. Returns a status summary. */
  async advance(orgId: string, missionId: string, actorId: string) {
    const mission = await this.mustOwn(orgId, missionId);
    if (mission.emergencyStop) {
      return { status: 'emergency_stop', message: 'Emergency stop is active.' };
    }

    const plan = await this.getPlan(orgId, missionId);
    if (!plan) throw new BadRequestException('No plan — call plan first.');
    const steps = plan.steps as unknown as PlanStep[];

    const execs = await this.prisma.taskExecution.findMany({
      where: { taskId: missionId, planId: plan.id },
      orderBy: { stepIndex: 'asc' },
    });

    const next = execs.find((e) => e.status === 'APPROVED' && !e.startedAt);
    if (!next) {
      const pending = execs.some((e) => e.status === 'PENDING');
      if (pending) {
        await this.prisma.task.update({ where: { id: missionId }, data: { status: 'AWAITING_APPROVAL' } });
        return { status: 'awaiting_approval', message: 'Steps are waiting for approval.' };
      }
      await this.prisma.task.update({ where: { id: missionId }, data: { status: 'COMPLETED' } });
      return { status: 'completed', message: 'All approved steps have run.' };
    }

    if (mission.status !== 'RUNNING') {
      await this.prisma.task.update({ where: { id: missionId }, data: { status: 'RUNNING' } });
    }

    const step = steps[next.stepIndex]!;
    await this.prisma.taskExecution.update({
      where: { id: next.id },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    const result = await this.runStep(orgId, missionId, next.id, step);
    return { status: 'ran', stepIndex: step.index, action: step.action, result };
  }

  /** Advance repeatedly until no more approved runnable steps (safety-capped). */
  async advanceAll(orgId: string, missionId: string, actorId: string) {
    const results: unknown[] = [];
    for (let i = 0; i < 100; i++) {
      const r = await this.advance(orgId, missionId, actorId);
      results.push(r);
      if (r.status !== 'ran') break;
    }
    return results;
  }

  /** Execute a single planned step. Never fabricates tool output. */
  private async runStep(orgId: string, missionId: string, execId: string, step: PlanStep) {
    const mission = await this.prisma.task.findUniqueOrThrow({ where: { id: missionId } });
    const entries = await this.scopeEntries(missionId);

    // Authorization choke point — always runs before any action.
    const decision = await this.scopeGuard.check({
      target: step.target,
      entries,
      active: true,
      emergencyStop: mission.emergencyStop,
    });
    await this.prisma.taskExecution.update({
      where: { id: execId },
      data: { scopeDecision: decision as object },
    });

    if (!decision.allowed) {
      await this.prisma.taskExecution.update({
        where: { id: execId },
        data: { status: 'BLOCKED', finishedAt: new Date(), summary: `Blocked: ${decision.code}` },
      });
      await this.audit.record({ orgId, action: 'scope.block', target: missionId, metadata: { target: step.target, code: decision.code } });
      return { outcome: 'BLOCKED', code: decision.code, reason: decision.reason };
    }

    if (step.action === 'scope_verify') {
      await this.evidence.append({
        taskId: missionId,
        kind: 'note',
        summary: `Authorization verified for ${step.target}`,
        content: JSON.stringify(decision),
      });
      await this.finish(execId, 'SUCCEEDED', `Authorized (${decision.code})`);
      return { outcome: 'SUCCEEDED', code: decision.code, resolvedIps: decision.resolvedIps };
    }

    if (step.action === 'dns_recon') {
      const ips = decision.resolvedIps ?? [];
      const toolRun = await this.prisma.toolExecution.create({
        data: {
          taskId: missionId,
          executionId: execId,
          tool: 'dns',
          command: `resolve ${step.target}`,
          target: step.target,
          status: 'SUCCEEDED',
          scopeApproved: true,
          exitCode: 0,
          startedAt: new Date(),
          finishedAt: new Date(),
        },
      });
      const outputText = ips.length ? ips.join('\n') : '(no A/AAAA records)';
      await this.prisma.toolOutput.create({
        data: { toolRunId: toolRun.id, stream: 'result', content: outputText, bytes: outputText.length },
      });
      const ev = await this.evidence.append({
        taskId: missionId,
        kind: 'command_output',
        toolRunId: toolRun.id,
        summary: `DNS resolution for ${step.target}`,
        content: outputText,
      });
      // Informational, evidence-backed finding (never marked confirmed).
      await this.prisma.finding.create({
        data: {
          taskId: missionId,
          title: `Hosts resolved for ${step.target}`,
          description: ips.length ? `In-scope target resolves to: ${ips.join(', ')}.` : 'No A/AAAA records found.',
          state: 'POTENTIAL',
          severity: 'INFO',
          evidence: { connect: { id: ev.id } },
        },
      });
      await this.finish(execId, 'SUCCEEDED', `Resolved ${ips.length} address(es)`);
      return { outcome: 'SUCCEEDED', resolvedIps: ips };
    }

    // action === 'tool' — run the tool inside the isolated sandbox when one is
    // available. Rich argument construction + structured parsing land with the
    // tool adapters (Phase 9); here we run a real, basic invocation. If no
    // sandbox backend is reachable we record the intent honestly rather than
    // fabricate output.
    const argv = [step.tool ?? 'true', step.target];
    const toolRun = await this.prisma.toolExecution.create({
      data: {
        taskId: missionId,
        executionId: execId,
        tool: step.tool ?? 'tool',
        command: argv.join(' '),
        target: step.target,
        status: 'RUNNING',
        scopeApproved: true,
        startedAt: new Date(),
      },
    });

    try {
      const run = await this.sandbox.runTool(orgId, missionId, argv);
      const output = (run.result.stdout || '') + (run.result.stderr ? `\n${run.result.stderr}` : '');
      await this.prisma.toolOutput.create({
        data: { toolRunId: toolRun.id, stream: 'result', content: output.slice(0, 100_000), bytes: output.length },
      });
      await this.prisma.toolExecution.update({
        where: { id: toolRun.id },
        data: {
          status: run.result.exitCode === 0 ? 'SUCCEEDED' : 'FAILED',
          exitCode: run.result.exitCode,
          sandboxId: run.sandboxId,
          finishedAt: new Date(),
        },
      });
      await this.evidence.append({
        taskId: missionId,
        kind: 'command_output',
        toolRunId: toolRun.id,
        summary: `${step.tool} on ${step.target} (exit ${run.result.exitCode})`,
        content: output,
      });
      await this.finish(
        execId,
        run.result.exitCode === 0 ? 'SUCCEEDED' : 'FAILED',
        `${step.tool} exit ${run.result.exitCode}`,
      );
      return { outcome: run.result.exitCode === 0 ? 'SUCCEEDED' : 'FAILED', tool: step.tool, exitCode: run.result.exitCode };
    } catch (err) {
      if (err instanceof SandboxUnavailableError) {
        await this.prisma.toolExecution.update({
          where: { id: toolRun.id },
          data: { status: 'BLOCKED', finishedAt: new Date() },
        });
        await this.finish(execId, 'BLOCKED', 'Tool execution requires a sandbox runner — backend not available.');
        return {
          outcome: 'AWAITING_SANDBOX',
          tool: step.tool,
          toolRunId: toolRun.id,
          message: 'Target authorized; execution deferred until a sandbox backend is reachable.',
        };
      }
      await this.prisma.toolExecution.update({
        where: { id: toolRun.id },
        data: { status: 'FAILED', finishedAt: new Date() },
      });
      await this.finish(execId, 'FAILED', String(err).slice(0, 200));
      return { outcome: 'FAILED', tool: step.tool, error: String(err).slice(0, 200) };
    }
  }

  private async finish(execId: string, status: 'SUCCEEDED' | 'BLOCKED' | 'FAILED', summary: string) {
    await this.prisma.taskExecution.update({
      where: { id: execId },
      data: { status, finishedAt: new Date(), summary },
    });
  }

  // ─── Findings & evidence (read + integrity) ───
  async findings(orgId: string, missionId: string) {
    await this.mustOwn(orgId, missionId);
    return this.prisma.finding.findMany({
      where: { taskId: missionId },
      orderBy: { createdAt: 'desc' },
      include: { evidence: true },
    });
  }

  async verifyEvidence(orgId: string, missionId: string) {
    await this.mustOwn(orgId, missionId);
    return this.evidence.verifyChain(missionId);
  }
}
