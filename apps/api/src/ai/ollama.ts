/**
 * Ollama Provider — local AI via Ollama HTTP API.
 * OpenAI-compatible endpoint at /v1/chat/completions.
 */

import { BaseProvider, type CompletionOptions } from "./base-provider";

export class OllamaProvider extends BaseProvider {
  name = "ollama";
  private baseUrl: string;
  private model: string;

  constructor(config: { baseUrl?: string; model?: string }) {
    super();
    this.baseUrl = config.baseUrl ?? "http://localhost:11434";
    this.model = config.model ?? "llama3";
  }

  protected getCompletionOptions(): CompletionOptions {
    return {
      model: this.model,
      baseUrl: `${this.baseUrl}/v1`,
      apiKey: "ollama", // Ollama doesn't require auth
    };
  }

  async ping(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
