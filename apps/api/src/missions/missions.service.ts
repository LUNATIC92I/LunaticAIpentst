import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { ScopeGuardService } from '../scope/scope-guard.service';
import { AiService } from '../ai/ai.service';
import { canTransition } from './mission-state';
import type { ScopeEntry } from '@lunatic/scope-engine';
import type { ChatMessage, AgentProfile } from '@lunatic/ai';
import type {
  AddScopeEntryDto,
  CreateMissionDto,
  PostMessageDto,
  ScopeCheckDto,
  UpdateMissionDto,
} from './missions.dto';
import type { TaskStatus } from '@lunatic/database';

/**
 * System prompt for CHAT mode. It binds the assistant to authorized,
 * scope-limited behaviour. The scope guard still enforces every active action
 * server-side regardless of what the model is told — this prompt cannot widen
 * authority, it only sets expectations for the conversation.
 */
function securitySystemPrompt(mission: { name: string; scopeSummary: unknown }): string {
  const scope = JSON.stringify(mission.scopeSummary ?? []);
  return [
    'You are a cybersecurity assistant inside the LUNATIC PENTEST AI platform.',
    'You support AUTHORIZED, in-scope security testing only.',
    `Mission: "${mission.name}". Authorized scope entries: ${scope}.`,
    'Never suggest acting on targets outside the authorized scope. All active',
    'operations are independently enforced by the platform scope guard; do not',
    'claim to have run a tool or confirmed a vulnerability unless evidence exists.',
    'Distinguish potential vs. detected vs. reproduced vs. confirmed findings.',
  ].join(' ');
}

@Injectable()
export class MissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly scopeGuard: ScopeGuardService,
    private readonly ai: AiService,
  ) {}

  /** Load a mission ensuring it belongs to the caller's org (tenant isolation). */
  private async mustOwn(orgId: string, id: string) {
    const mission = await this.prisma.task.findFirst({ where: { id, orgId } });
    if (!mission) throw new NotFoundException('Mission not found');
    return mission;
  }

  list(orgId: string) {
    return this.prisma.task.findMany({
      where: { orgId },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { messages: true, findings: true, scopeEntries: true } } },
    });
  }

  async get(orgId: string, id: string) {
    await this.mustOwn(orgId, id);
    return this.prisma.task.findUnique({
      where: { id },
      include: {
        scopeEntries: true,
        _count: { select: { messages: true, findings: true, toolRuns: true, sandboxes: true } },
      },
    });
  }

  async create(orgId: string, ownerId: string, dto: CreateMissionDto, ip?: string) {
    const mission = await this.prisma.task.create({
      data: {
        orgId,
        ownerId,
        name: dto.name,
        description: dto.description,
        mode: dto.mode,
        permissionMode: dto.permissionMode,
        agentProfile: dto.agentProfile,
        status: 'DRAFT',
      },
    });
    await this.audit.record({ orgId, actorId: ownerId, action: 'mission.create', target: mission.id, ip });
    return mission;
  }

  async update(orgId: string, id: string, dto: UpdateMissionDto) {
    await this.mustOwn(orgId, id);
    return this.prisma.task.update({ where: { id }, data: dto });
  }

  async transition(orgId: string, id: string, to: TaskStatus, actorId: string) {
    const mission = await this.mustOwn(orgId, id);
    if (mission.status === to) return mission;
    if (!canTransition(mission.status, to)) {
      throw new BadRequestException(`Illegal transition ${mission.status} → ${to}`);
    }
    const updated = await this.prisma.task.update({ where: { id }, data: { status: to } });
    await this.audit.record({
      orgId,
      actorId,
      action: 'mission.transition',
      target: id,
      metadata: { from: mission.status, to },
    });
    return updated;
  }

  async setEmergencyStop(orgId: string, id: string, stop: boolean, actorId: string) {
    await this.mustOwn(orgId, id);
    const updated = await this.prisma.task.update({ where: { id }, data: { emergencyStop: stop } });
    await this.audit.record({
      orgId,
      actorId,
      action: stop ? 'mission.emergency_stop' : 'mission.emergency_clear',
      target: id,
    });
    return updated;
  }

  // ─── Scope ───
  async addScopeEntry(orgId: string, id: string, dto: AddScopeEntryDto, actorId: string) {
    await this.mustOwn(orgId, id);
    const entry = await this.prisma.scopeEntry.create({
      data: { taskId: id, type: dto.type, value: dto.value.trim(), note: dto.note },
    });
    await this.syncScopeSummary(id);
    await this.audit.record({
      orgId,
      actorId,
      action: 'mission.scope.add',
      target: id,
      metadata: { type: dto.type, value: dto.value },
    });
    return entry;
  }

  async removeScopeEntry(orgId: string, id: string, entryId: string, actorId: string) {
    await this.mustOwn(orgId, id);
    await this.prisma.scopeEntry.deleteMany({ where: { id: entryId, taskId: id } });
    await this.syncScopeSummary(id);
    await this.audit.record({ orgId, actorId, action: 'mission.scope.remove', target: id });
    return { ok: true };
  }

  private async syncScopeSummary(id: string) {
    const entries = await this.prisma.scopeEntry.findMany({ where: { taskId: id } });
    await this.prisma.task.update({
      where: { id },
      data: { scopeSummary: entries.map((e) => ({ type: e.type, value: e.value })) },
    });
  }

  /** Validate a target against the mission scope — the authorization choke point. */
  async scopeCheck(orgId: string, id: string, dto: ScopeCheckDto, actorId: string) {
    const mission = await this.mustOwn(orgId, id);
    const entries = await this.prisma.scopeEntry.findMany({ where: { taskId: id } });
    const scopeEntries: ScopeEntry[] = entries.map((e) => ({
      type: e.type as ScopeEntry['type'],
      value: e.value,
      note: e.note ?? undefined,
    }));

    const decision = await this.scopeGuard.check({
      target: dto.target,
      entries: scopeEntries,
      active: dto.active,
      allowPrivateRanges: dto.allowPrivateRanges,
      emergencyStop: mission.emergencyStop,
    });

    if (!decision.allowed) {
      await this.audit.record({
        orgId,
        actorId,
        action: 'scope.block',
        target: id,
        metadata: { target: dto.target, code: decision.code },
      });
    }
    return decision;
  }

  // ─── Chat (CHAT mode) ───
  async listMessages(orgId: string, id: string) {
    await this.mustOwn(orgId, id);
    return this.prisma.taskMessage.findMany({ where: { taskId: id }, orderBy: { createdAt: 'asc' } });
  }

  async postMessage(orgId: string, id: string, actorId: string, dto: PostMessageDto) {
    const mission = await this.mustOwn(orgId, id);
    const userMessage = await this.prisma.taskMessage.create({
      data: { taskId: id, role: 'user', content: dto.content },
    });
    await this.audit.record({ orgId, actorId, action: 'mission.message', target: id });

    const configured = await this.ai.isConfigured(orgId);
    if (!configured) {
      // Honest notice instead of a fabricated assistant response.
      const systemNotice = await this.prisma.taskMessage.create({
        data: {
          taskId: id,
          role: 'system',
          content:
            'AI provider not configured. Add a provider (Admin → AI providers) to receive assistant responses. Your message has been saved to the mission history.',
          metadata: { reason: 'ai_not_configured' },
        },
      });
      return { userMessage, systemNotice, assistantMessage: null, aiStatus: 'NOT_CONFIGURED' };
    }

    // Build model context from the real conversation (exclude internal notices).
    const history = await this.prisma.taskMessage.findMany({
      where: { taskId: id },
      orderBy: { createdAt: 'asc' },
    });
    const messages: ChatMessage[] = history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    try {
      const res = await this.ai.chat(orgId, {
        system: securitySystemPrompt(mission),
        messages,
        profile: mission.agentProfile as AgentProfile,
      });
      const assistantMessage = await this.prisma.taskMessage.create({
        data: {
          taskId: id,
          role: 'assistant',
          content: res.content,
          inputTokens: res.usage.inputTokens,
          outputTokens: res.usage.outputTokens,
          metadata: { model: res.model },
        },
      });
      return { userMessage, assistantMessage, systemNotice: null, aiStatus: 'CONFIGURED' };
    } catch (err) {
      const systemNotice = await this.prisma.taskMessage.create({
        data: {
          taskId: id,
          role: 'system',
          content: `Assistant request failed: ${String(err).slice(0, 300)}`,
          metadata: { reason: 'ai_error' },
        },
      });
      return { userMessage, systemNotice, assistantMessage: null, aiStatus: 'ERROR' };
    }
  }
}
