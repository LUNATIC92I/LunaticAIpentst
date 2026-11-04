import { AiProviderError, type ChatProvider, type ChatRequest, type ChatResponse } from '../types.js';

export function buildGeminiBody(req: ChatRequest): Record<string, unknown> {
  return {
    ...(req.system ? { systemInstruction: { parts: [{ text: req.system }] } } : {}),
    contents: req.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    generationConfig: { maxOutputTokens: req.maxTokens, temperature: req.temperature },
  };
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

export function parseGeminiResponse(json: unknown, fallbackModel: string): ChatResponse {
  const r = json as GeminiResponse;
  const content = (r.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
  return {
    content,
    model: fallbackModel,
    usage: {
      inputTokens: r.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: r.usageMetadata?.candidatesTokenCount ?? 0,
    },
  };
}

export class GeminiProvider implements ChatProvider {
  readonly kind = 'GEMINI' as const;
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta',
  ) {}

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const url = `${this.baseUrl}/models/${encodeURIComponent(req.model)}:generateContent?key=${this.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildGeminiBody(req)),
    });
    if (!res.ok) {
      throw new AiProviderError('GEMINI', res.status, await res.text());
    }
    return parseGeminiResponse(await res.json(), req.model);
  }
}
