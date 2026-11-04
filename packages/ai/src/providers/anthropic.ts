import { AiProviderError, type ChatProvider, type ChatRequest, type ChatResponse } from '../types.js';

export function buildAnthropicBody(req: ChatRequest): Record<string, unknown> {
  return {
    model: req.model,
    max_tokens: req.maxTokens,
    temperature: req.temperature,
    ...(req.system ? { system: req.system } : {}),
    // Anthropic Messages API: only user/assistant turns in `messages`.
    messages: req.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content })),
  };
}

interface AnthropicResponse {
  model?: string;
  content?: { type: string; text?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
}

export function parseAnthropicResponse(json: unknown, fallbackModel: string): ChatResponse {
  const r = json as AnthropicResponse;
  const content = (r.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');
  return {
    content,
    model: r.model ?? fallbackModel,
    usage: {
      inputTokens: r.usage?.input_tokens ?? 0,
      outputTokens: r.usage?.output_tokens ?? 0,
    },
  };
}

export class AnthropicProvider implements ChatProvider {
  readonly kind = 'ANTHROPIC' as const;
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = 'https://api.anthropic.com',
  ) {}

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(buildAnthropicBody(req)),
    });
    if (!res.ok) {
      throw new AiProviderError('ANTHROPIC', res.status, await res.text());
    }
    return parseAnthropicResponse(await res.json(), req.model);
  }
}
