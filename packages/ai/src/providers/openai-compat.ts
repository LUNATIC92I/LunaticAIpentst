import type { ChatRequest, ChatResponse } from '../types.js';

/**
 * OpenAI Chat Completions mapping, shared by OpenAI, DeepSeek and OpenRouter
 * (all expose the same /v1/chat/completions shape). Pure functions so the
 * mapping is unit-tested without network access.
 */
export function buildOpenAIBody(req: ChatRequest): Record<string, unknown> {
  const messages = [
    ...(req.system ? [{ role: 'system', content: req.system }] : []),
    ...req.messages.map((m) => ({ role: m.role, content: m.content })),
  ];
  return {
    model: req.model,
    messages,
    max_tokens: req.maxTokens,
    temperature: req.temperature,
  };
}

interface OpenAIResponse {
  model?: string;
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export function parseOpenAIResponse(json: unknown, fallbackModel: string): ChatResponse {
  const r = json as OpenAIResponse;
  const content = r.choices?.[0]?.message?.content ?? '';
  return {
    content,
    model: r.model ?? fallbackModel,
    usage: {
      inputTokens: r.usage?.prompt_tokens ?? 0,
      outputTokens: r.usage?.completion_tokens ?? 0,
    },
  };
}
