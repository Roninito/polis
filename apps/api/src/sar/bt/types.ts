/**
 * POLIS Behavior Tree Types
 *
 * SAR Chain behavior tree architecture following the pattern from SAR Engine v2
 * and MNGR manager-engine. Governance analysis flows through composable leaf nodes:
 *
 *   Sense → Analyze (parallel) → Respond
 *
 * Each node is independent, testable, and returns a BTStatus that governs
 * tree traversal — enabling selector fallbacks, parallel execution, and
 * sequence requirements.
 */

import type { AIProvider, SARContext, SARAnalysis } from "../../ai/provider.interface";

// --- Status ---

export enum BTStatus {
  SUCCESS  = "SUCCESS",
  FAILURE  = "FAILURE",
  RUNNING  = "RUNNING",
}

// --- Shared execution context passed to every node ---

export interface SARNodeContext {
  /** Organization ID being analyzed */
  orgId: string;
  /** Reference entity ID (proposal ID, vote ID, etc.) */
  refId?: string;
  /** Task label (proposal_intake, vote_analysis, etc.) */
  task: string;
  /** Raw sense input text describing the event */
  senseInput: string;
  /** Governance context (constitution, org info) */
  sarContext: SARContext;
  /** AI provider for analysis */
  provider: AIProvider;
  /** Shared memory bag — nodes read and write here across phases */
  memory: SARNodeMemory;
  /** Event emitter for real-time UI updates */
  emit: (event: BTEvent) => void;
}

// --- Shared memory store (Sense → Analyze → Respond hand-off) ---

export interface SARNodeMemory {
  // Set by Sense phase
  proposal?: Record<string, unknown>;
  constitution?: string;
  orgContext?: Record<string, unknown>;

  // Set by Analyze phase nodes (each writes its own slot)
  constitutionalAnalysis?: AnalysisSlot;
  financialImpact?: AnalysisSlot;
  riskAssessment?: AnalysisSlot;
  voteAnalysis?: AnalysisSlot;

  // Set by Respond/Synthesize
  synthesizedAnalysis?: SARAnalysis;
  actionItems?: string[];

  // Raw slot store for extension
  [key: string]: unknown;
}

export interface AnalysisSlot {
  summary: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  recommendation: string;
  reasoning: string;
  conflicts: string[];
  suggestedActions: string[];
  completedAt: string;
}

// --- Events emitted during tree execution ---

export interface BTEvent {
  type: string;
  source: string;
  orgId: string;
  refId?: string;
  payload?: Record<string, unknown>;
  timestamp: string;
}

// --- Leaf node interface ---

export interface SARLeafNode {
  /** Unique identifier for this node — used in logging and metrics */
  id: string;
  /** Human-readable label */
  label: string;
  /** Execute node logic, return BTStatus */
  tick(context: SARNodeContext): Promise<BTStatus>;
}

// --- Tree configuration DSL ---

export type BTNodeConfig =
  | { type: "sequence";  label?: string; children: BTNodeConfig[] }
  | { type: "selector";  label?: string; children: BTNodeConfig[] }
  | { type: "parallel";  label?: string; children: BTNodeConfig[]; failFast?: boolean }
  | { type: "leaf";      node: SARLeafNode };

// --- Tree execution result ---

export interface BTResult {
  status: BTStatus;
  /** ms taken for the full tree */
  durationMs: number;
  /** Top-level analysis pulled from memory after success */
  analysis?: SARAnalysis;
  /** Any leaf node errors encountered */
  errors: Array<{ nodeId: string; error: string }>;
}
