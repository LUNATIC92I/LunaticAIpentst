export type ProviderKind =
  | 'ANTHROPIC'
  | 'OPENAI'
  | 'GEMINI'
  | 'DEEPSEEK'
  | 'OPENROUTER'
  | 'CUSTOM'
  | 'MOCK';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  model: string;
  system?: string;
  messages: ChatMessage[];
  maxTokens: number;
  temperature: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ChatResponse {
  content: string;
  usage: TokenUsage;
  model: string;
}

export interface ProviderConfig {
  kind: ProviderKind;
  apiKey?: string;
  baseUrl?: string;
}

/** A provider adapter maps our neutral request to a vendor API and back. */
export interface ChatProvider {
  readonly kind: ProviderKind;
  chat(req: ChatRequest): Promise<ChatResponse>;
}

export class AiProviderError extends Error {
  constructor(
    public readonly kind: ProviderKind,
    public readonly status: number | undefined,
    message: string,
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}
