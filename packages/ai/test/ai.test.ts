import { describe, it, expect } from 'vitest';
import { buildOpenAIBody, parseOpenAIResponse } from '../src/providers/openai-compat.js';
import { buildAnthropicBody, parseAnthropicResponse } from '../src/providers/anthropic.js';
import { buildGeminiBody, parseGeminiResponse } from '../src/providers/gemini.js';
import { MockProvider, estimateTokens } from '../src/providers/mock.js';
import { createProvider } from '../src/registry.js';
import { profileConfig } from '../src/profiles.js';
import type { ChatRequest } from '../src/types.js';

const req: ChatRequest = {
  model: 'test-model',
  system: 'You are a security assistant.',
  messages: [
    { role: 'user', content: 'hello' },
    { role: 'assistant', content: 'hi' },
    { role: 'user', content: 'scan?' },
  ],
  maxTokens: 512,
  temperature: 0.3,
};

describe('OpenAI-compatible mapping', () => {
  it('builds a body with system prepended', () => {
    const body = buildOpenAIBody(req) as any;
    expect(body.model).toBe('test-model');
    expect(body.messages[0]).toEqual({ role: 'system', content: 'You are a security assistant.' });
    expect(body.messages).toHaveLength(4);
    expect(body.max_tokens).toBe(512);
  });
  it('parses a response + usage', () => {
    const res = parseOpenAIResponse(
      { model: 'm', choices: [{ message: { content: 'answer' } }], usage: { prompt_tokens: 10, completion_tokens: 5 } },
      'fallback',
    );
    expect(res.content).toBe('answer');
    expect(res.usage).toEqual({ inputTokens: 10, outputTokens: 5 });
  });
});

describe('Anthropic mapping', () => {
  it('keeps system separate and excludes it from messages', () => {
    const body = buildAnthropicBody(req) as any;
    expect(body.system).toBe('You are a security assistant.');
    expect(body.messages.every((m: any) => m.role !== 'system')).toBe(true);
    expect(body.messages).toHaveLength(3);
  });
  it('concatenates text blocks and reads usage', () => {
    const res = parseAnthropicResponse(
      { model: 'claude', content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }], usage: { input_tokens: 7, output_tokens: 3 } },
      'fallback',
    );
    expect(res.content).toBe('ab');
    expect(res.usage).toEqual({ inputTokens: 7, outputTokens: 3 });
  });
});

describe('Gemini mapping', () => {
  it('maps assistant->model and wraps parts', () => {
    const body = buildGeminiBody(req) as any;
    expect(body.systemInstruction.parts[0].text).toContain('security');
    expect(body.contents[1].role).toBe('model');
    expect(body.contents[0].parts[0].text).toBe('hello');
  });
  it('parses candidates + usage metadata', () => {
    const res = parseGeminiResponse(
      { candidates: [{ content: { parts: [{ text: 'g' }] } }], usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 2 } },
      'gemini-x',
    );
    expect(res.content).toBe('g');
    expect(res.usage).toEqual({ inputTokens: 4, outputTokens: 2 });
  });
});

describe('profiles', () => {
  it('are distinct real configs', () => {
    expect(profileConfig('STANDARD').maxTokens).toBeLessThan(profileConfig('PRO').maxTokens);
    expect(profileConfig('PRO').toolBudget).toBeLessThan(profileConfig('MAX').toolBudget);
  });
});

describe('mock provider + registry', () => {
  it('estimates tokens and echoes, clearly labelled', async () => {
    expect(estimateTokens('abcd')).toBe(1);
    const p = new MockProvider();
    const res = await p.chat(req);
    expect(res.content).toContain('dev-echo');
    expect(res.usage.outputTokens).toBeGreaterThan(0);
  });
  it('registry builds a mock provider', async () => {
    const p = createProvider({ kind: 'MOCK' });
    expect(p.kind).toBe('MOCK');
  });
  it('registry requires a key for real providers', () => {
    expect(() => createProvider({ kind: 'OPENAI' })).toThrow();
    expect(() => createProvider({ kind: 'CUSTOM', apiKey: 'k' })).toThrow(/baseUrl/);
  });
});
