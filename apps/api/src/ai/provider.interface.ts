/**
 * AI Provider Interface — pluggable AI backend for the SAR engine.
 *
 * All SAR AI calls go through this interface. The provider is resolved
 * at boot from polis.config.json.
 */

export interface SARContext {
  orgId: string;
  orgName: string;
  constitution?: string;
  laws?: string[];
  currentProposal?: {
    id: string;
    title: string;
    body: string;
    type: string;
  };
  treasuryBalance?: number;
  memberCount?: number;
  recentSarEntries?: Array<{
    task: string;
    sense: string;
    analyze: string;
    respond: string;
  }>;
}

export interface SARAnalysis {
  summary: string;
  recommendation: string;
  constitutionalConflicts: string[];
  riskLevel: "low" | "medium" | "high" | "critical";
  reasoning: string;
  suggestedActions: string[];
}

export type DraftType =
  | "charter"
  | "ordinance"
  | "resolution"
  | "report"
  | "notice";

export interface ClassifySchema {
  categories: string[];
  description: string;
}

export interface Classification {
  category: string;
  confidence: number;
  reasoning: string;
}

export interface AIProvider {
  name: string;

  /** Analyze a governance situation — core SAR capability. */
  analyze(prompt: string, context: SARContext): Promise<SARAnalysis>;

  /** Generate a draft document. */
  draft(prompt: string, type: DraftType): Promise<string>;

  /** Classify text into predefined categories. */
  classify(text: string, schema: ClassifySchema): Promise<Classification>;

  /** Health check — test connection to the AI provider. */
  ping(): Promise<boolean>;
}

export type ProviderType = "anthropic" | "openai" | "ollama" | "custom";
