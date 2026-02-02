/**
 * Type declarations for @langchain/openai so the IDE resolves the module.
 * Install: pnpm add @langchain/openai
 */
declare module "@langchain/openai" {
  export interface ChatOpenAIOptions {
    model?: string;
    temperature?: number;
    apiKey?: string;
    [key: string]: unknown;
  }

  export class ChatOpenAI {
    constructor(options?: ChatOpenAIOptions);
    invoke(input: string | unknown, options?: unknown): Promise<{ content: string }>;
  }
}
