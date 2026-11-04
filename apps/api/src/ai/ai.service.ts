import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { sealSecret, openSecret, lastFour } from '@lunatic/security';
import {
  createProvider,
  profileConfig,
  type ChatMessage,
  type ChatResponse,
  type ProviderKind,
  type AgentProfile,
  AiProviderError,
} from '@lunatic/ai';
import type { AddModelDto, AddProviderDto } from './ai.dto';

export class AiNotConfiguredError extends Error {
  constructor() {
    super('No AI provider is configured for this organization.');
  }
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  private masterKey(): string {
    return this.config.getOrThrow<string>('SECRETS_ENCRYPTION_KEY');
  }

  // ─── Provider / key / model management ───
  async addProvider(orgId: string, dto: AddProviderDto, actorId: string) {
    if (dto.kind !== 'MOCK' && !dto.apiKey) {
      throw new BadRequestException('An API key is required for this provider.');
    }
    const provider = await this.prisma.aiProvider.create({
      data: {
        orgId,
        kind: dto.kind as ProviderKind as never,
        label: dto.label,
        baseUrl: dto.baseUrl,
        state: 'CONFIGURED',
      },
    });

    if (dto.apiKey) {
      const sealed = sealSecret(dto.apiKey, this.masterKey());
      await this.prisma.apiKey.create({
        data: {
          providerId: provider.id,
          label: `${dto.label} key`,
          encryptedKey: sealed.ciphertext,
          keyIv: sealed.iv,
          keyTag: sealed.tag,
          lastFour: lastFour(dto.apiKey),
        },
      });
    }

    await this.prisma.aiModel.create({
      data: { providerId: provider.id, name: dto.defaultModel, displayName: dto.defaultModel, enabled: true },
    });

    await this.audit.record({
      orgId,
      actorId,
      action: 'ai.provider.add',
      target: provider.id,
      metadata: { kind: dto.kind },
    });
    return this.publicProvider(provider.id);
  }

  async listProviders(orgId: string) {
    const providers = await this.prisma.aiProvider.findMany({
      where: { orgId },
      include: { models: true, apiKeys: { where: { revokedAt: null }, select: { lastFour: true } } },
      orderBy: { createdAt: 'asc' },
    });
    // Never leak key material — only lastFour.
    return providers.map((p) => ({
      id: p.id,
      kind: p.kind,
      label: p.label,
      baseUrl: p.baseUrl,
      state: p.state,
      models: p.models.map((m) => ({ id: m.id, name: m.name, displayName: m.displayName, enabled: m.enabled })),
      keyLastFour: p.apiKeys[0]?.lastFour ?? null,
    }));
  }

  private async publicProvider(id: string) {
    const list = await this.prisma.aiProvider.findUniqueOrThrow({
      where: { id },
      include: { models: true, apiKeys: { where: { revokedAt: null }, select: { lastFour: true } } },
    });
    return {
      id: list.id,
      kind: list.kind,
      label: list.label,
      baseUrl: list.baseUrl,
      state: list.state,
      models: list.models.map((m) => ({ id: m.id, name: m.name, displayName: m.displayName, enabled: m.enabled })),
      keyLastFour: list.apiKeys[0]?.lastFour ?? null,
    };
  }

  async addModel(orgId: string, providerId: string, dto: AddModelDto) {
    await this.mustOwnProvider(orgId, providerId);
    return this.prisma.aiModel.create({
      data: { providerId, name: dto.name, displayName: dto.displayName ?? dto.name, enabled: true },
    });
  }

  async removeProvider(orgId: string, providerId: string, actorId: string) {
    await this.mustOwnProvider(orgId, providerId);
    await this.prisma.aiProvider.delete({ where: { id: providerId } });
    await this.audit.record({ orgId, actorId, action: 'ai.provider.remove', target: providerId });
    return { ok: true };
  }

  private async mustOwnProvider(orgId: string, providerId: string) {
    const p = await this.prisma.aiProvider.findFirst({ where: { id: providerId, orgId } });
    if (!p) throw new NotFoundException('Provider not found');
    return p;
  }

  // ─── Resolution + gateway ───
  private async resolve(orgId: string) {
    const provider = await this.prisma.aiProvider.findFirst({
      where: { orgId, state: 'CONFIGURED' },
      include: { models: { where: { enabled: true }, take: 1 }, apiKeys: { where: { revokedAt: null }, take: 1 } },
      orderBy: { createdAt: 'asc' },
    });
    if (!provider) return null;
    const model = provider.models[0];
    if (!model) return null;

    let apiKey: string | undefined;
    const key = provider.apiKeys[0];
    if (key) {
      apiKey = openSecret({ ciphertext: key.encryptedKey, iv: key.keyIv, tag: key.keyTag }, this.masterKey());
    }
    return { provider, model: model.name, apiKey };
  }

  async isConfigured(orgId: string): Promise<boolean> {
    return (await this.resolve(orgId)) !== null;
  }

  /** Build an adapter config for ONE specific provider (decrypts its own key). */
  private async providerConfig(orgId: string, providerId: string) {
    const provider = await this.prisma.aiProvider.findFirst({
      where: { id: providerId, orgId },
      include: { models: { where: { enabled: true }, take: 1 }, apiKeys: { where: { revokedAt: null }, take: 1 } },
    });
    if (!provider) throw new NotFoundException('Provider not found');
    const model = provider.models[0];
    if (!model) throw new BadRequestException('Provider has no enabled model');
    let apiKey: string | undefined;
    const key = provider.apiKeys[0];
    if (key) {
      apiKey = openSecret({ ciphertext: key.encryptedKey, iv: key.keyIv, tag: key.keyTag }, this.masterKey());
    }
    return { kind: provider.kind as ProviderKind, baseUrl: provider.baseUrl ?? undefined, apiKey, model: model.name };
  }

  async testProvider(orgId: string, providerId: string) {
    let cfg;
    try {
      cfg = await this.providerConfig(orgId, providerId);
    } catch (err) {
      return { ok: false, error: String(err).slice(0, 200) };
    }
    try {
      const provider = createProvider({ kind: cfg.kind, apiKey: cfg.apiKey, baseUrl: cfg.baseUrl });
      const res = await provider.chat({
        model: cfg.model,
        system: 'Reply with the single word: pong.',
        messages: [{ role: 'user', content: 'ping' }],
        maxTokens: 16,
        temperature: 0,
      });
      return { ok: true, model: res.model, usage: res.usage };
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof AiProviderError
            ? `${err.status}: ${err.message}`.slice(0, 300)
            : String(err).slice(0, 300),
      };
    }
  }

  /** Low-level chat: resolve provider, call adapter. Throws if not configured. */
  async chatRaw(
    orgId: string,
    input: { system?: string; messages: ChatMessage[]; profile: AgentProfile },
  ): Promise<ChatResponse> {
    const resolved = await this.resolve(orgId);
    if (!resolved) throw new AiNotConfiguredError();

    const provider = createProvider({
      kind: resolved.provider.kind as ProviderKind,
      apiKey: resolved.apiKey,
      baseUrl: resolved.provider.baseUrl ?? undefined,
    });
    const cfg = profileConfig(input.profile);
    return provider.chat({
      model: resolved.model,
      system: input.system,
      messages: input.messages,
      maxTokens: cfg.maxTokens,
      temperature: cfg.temperature,
    });
  }

  /** Chat + usage accounting (records a UsageRecord for the org). */
  async chat(
    orgId: string,
    input: { system?: string; messages: ChatMessage[]; profile: AgentProfile },
  ): Promise<ChatResponse> {
    const res = await this.chatRaw(orgId, input);
    const total = res.usage.inputTokens + res.usage.outputTokens;
    if (total > 0) {
      await this.prisma.usageRecord.create({
        data: { orgId, kind: 'ai_tokens', quantity: total, metadata: { model: res.model } },
      });
    }
    return res;
  }
}
