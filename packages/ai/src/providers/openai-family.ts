import { AiProviderError, type ChatProvider, type ChatRequest, type ChatResponse, type ProviderKind } from '../types.js';
import { buildOpenAIBody, parseOpenAIResponse } from './openai-compat.js';

/**
 * Adapter for every OpenAI-compatible endpoint (OpenAI, DeepSeek, OpenRouter,
 * or a CUSTOM base URL). They differ only in base URL and auth header value.
 */
export class OpenAICompatProvider implements ChatProvider {
  constructor(
    readonly kind: ProviderKind,
    private readonly apiKey: string,
    private readonly baseUrl: string,
  ) {}

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const res = await fetch(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(buildOpenAIBody(req)),
    });
    if (!res.ok) {
      throw new AiProviderError(this.kind, res.status, await res.text());
    }
    return parseOpenAIResponse(await res.json(), req.model);
  }
}

export const DEFAULT_BASE_URLS: Record<string, string> = {
  OPENAI: 'https://api.openai.com/v1',
  DEEPSEEK: 'https://api.deepseek.com/v1',
  OPENROUTER: 'https://openrouter.ai/api/v1',
};
