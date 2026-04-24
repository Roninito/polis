/**
 * Custom Provider — any OpenAI-compatible API endpoint.
 */

import { BaseProvider, type CompletionOptions } from "./base-provider";

export class CustomProvider extends BaseProvider {
  name = "custom";
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(config: { apiKey?: string; model?: string; baseUrl?: string }) {
    super();
    this.apiKey = config.apiKey ?? "";
    this.model = config.model ?? "default";
    this.baseUrl = config.baseUrl ?? "http://localhost:8080/v1";
  }

  protected getCompletionOptions(): CompletionOptions {
    return {
      model: this.model,
      baseUrl: this.baseUrl,
      apiKey: this.apiKey,
    };
  }
}
