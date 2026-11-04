import type { ChatProvider, ProviderConfig } from './types.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { GeminiProvider } from './providers/gemini.js';
import { OpenAICompatProvider, DEFAULT_BASE_URLS } from './providers/openai-family.js';
import { MockProvider } from './providers/mock.js';

/**
 * Factory: build a concrete provider adapter from a stored provider config.
 * The caller supplies the (already-decrypted) API key.
 */
export function createProvider(config: ProviderConfig): ChatProvider {
  switch (config.kind) {
    case 'ANTHROPIC':
      return new AnthropicProvider(requireKey(config), config.baseUrl);
    case 'GEMINI':
      return new GeminiProvider(requireKey(config), config.baseUrl);
    case 'OPENAI':
      return new OpenAICompatProvider('OPENAI', requireKey(config), config.baseUrl ?? DEFAULT_BASE_URLS.OPENAI!);
    case 'DEEPSEEK':
      return new OpenAICompatProvider('DEEPSEEK', requireKey(config), config.baseUrl ?? DEFAULT_BASE_URLS.DEEPSEEK!);
    case 'OPENROUTER':
      return new OpenAICompatProvider('OPENROUTER', requireKey(config), config.baseUrl ?? DEFAULT_BASE_URLS.OPENROUTER!);
    case 'CUSTOM':
      if (!config.baseUrl) throw new Error('CUSTOM provider requires a baseUrl');
      return new OpenAICompatProvider('CUSTOM', requireKey(config), config.baseUrl);
    case 'MOCK':
      return new MockProvider();
    default:
      throw new Error(`Unsupported provider kind: ${config.kind}`);
  }
}

function requireKey(config: ProviderConfig): string {
  if (!config.apiKey) throw new Error(`Provider ${config.kind} requires an API key`);
  return config.apiKey;
}
