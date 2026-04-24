/**
 * POLIS configuration types.
 */

export type DeploymentMode = "multitenant" | "standalone";
export type ProviderType = "anthropic" | "openai" | "ollama" | "custom";

export interface AIConfig {
  provider: ProviderType;
  model: string;
  apiKeyRef: string;
  /** Resolved API key (after env ref resolution) */
  apiKey?: string;
  /** For Ollama / custom — the base URL */
  baseUrl?: string;
}

export interface EmailConfig {
  provider: "resend" | "sendgrid" | "mailgun" | "console";
  from: string;
  apiKeyRef?: string;
  /** Resolved API key (after env ref resolution) */
  apiKey?: string;
}

export interface PlatformConfig {
  domain: string;
  stripeKeyRef: string;
  stripeKey?: string;
  emailProvider: "resend" | "smtp";
  emailKeyRef?: string;
  emailKey?: string;
}

export type DatabaseEngine = "postgresql" | "sqlite";

export interface DatabaseConfig {
  engine: DatabaseEngine;
  url: string;
}

export interface PolisConfig {
  deploymentMode: DeploymentMode;
  setupComplete: boolean;
  setupDate: string;
  ai: AIConfig;
  db: DatabaseConfig;
  email?: EmailConfig;
  /** Only present in multi-tenant mode */
  platform?: PlatformConfig;
}
