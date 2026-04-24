/**
 * OpenAI Provider — GPT-4o / GPT-4o-mini
 */

import { BaseProvider, type CompletionOptions } from "./base-provider";

export class OpenAIProvider extends BaseProvider {
  name = "openai";
  private apiKey: string;
  private model: string;

  constructor(config: { apiKey?: string; model?: string }) {
    super();
    this.apiKey = config.apiKey ?? "";
    this.model = config.model ?? "gpt-4o";
  }

  protected getCompletionOptions(): CompletionOptions {
    return {
      model: this.model,
      baseUrl: "https://api.openai.com/v1",
      apiKey: this.apiKey,
    };
  }
}
