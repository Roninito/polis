/**
 * AI Provider Factory — resolves the correct provider from config.
 */

import type { AIProvider } from "./provider.interface";
import type { AIConfig } from "../config/types";
import { AnthropicProvider } from "./anthropic";
import { OpenAIProvider } from "./openai";
import { OllamaProvider } from "./ollama";
import { CustomProvider } from "./custom";

/**
 * Create an AI provider instance from config.
 */
export function createProvider(config: AIConfig): AIProvider {
  switch (config.provider) {
    case "anthropic":
      return new AnthropicProvider({
        apiKey: config.apiKey ?? config.apiKeyRef,
        model: config.model,
      });
    case "openai":
      return new OpenAIProvider({
        apiKey: config.apiKey ?? config.apiKeyRef,
        model: config.model,
      });
    case "ollama":
      return new OllamaProvider({
        baseUrl: config.baseUrl,
        model: config.model,
      });
    case "custom":
      return new CustomProvider({
        apiKey: config.apiKey ?? config.apiKeyRef,
        model: config.model,
        baseUrl: config.baseUrl,
      });
    default:
      throw new Error(`Unknown AI provider: ${config.provider}`);
  }
}

/**
 * SAR task to model tier routing.
 * Maps task types to the appropriate model tier for cost optimization.
 */
export const TASK_MODEL_TIER: Record<string, "fast" | "standard" | "batch"> = {
  cycle_monitoring:    "fast",
  proposal_intake:     "standard",
  constitutional_check:"standard",
  charter_generation:  "standard",
  vote_analysis:       "standard",
  ledger_audit:        "batch",
  hardship_review:     "standard",
};

export { type AIProvider } from "./provider.interface";
