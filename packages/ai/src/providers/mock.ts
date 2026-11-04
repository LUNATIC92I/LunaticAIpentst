import type { ChatProvider, ChatRequest, ChatResponse } from '../types.js';

/** Rough token estimate (~4 chars/token) for usage accounting with the mock. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

/**
 * Development-only provider. It does NOT call any model and never pretends to be
 * one: its replies are explicitly labelled as coming from a local echo model.
 * It exists so the chat/agent pipeline can be exercised end-to-end without a
 * real provider key. Never select it for production analysis.
 */
export class MockProvider implements ChatProvider {
  readonly kind = 'MOCK' as const;

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const lastUser = [...req.messages].reverse().find((m) => m.role === 'user');
    const content =
      `[dev-echo model — not a real AI provider]\n\n` +
      `Received: "${(lastUser?.content ?? '').slice(0, 400)}"\n\n` +
      `Configure a real provider key (Settings → AI providers) to get genuine ` +
      `assistant analysis. This echo exists only to exercise the pipeline.`;
    const inputTokens = estimateTokens((req.system ?? '') + req.messages.map((m) => m.content).join(' '));
    return {
      content,
      model: req.model || 'mock-echo',
      usage: { inputTokens, outputTokens: estimateTokens(content) },
    };
  }
}
