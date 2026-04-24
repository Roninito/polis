/**
 * POLIS SAR Engine — Governance AI powered by @polis/sar chain patterns.
 *
 * SAR = Sense → Analyze → Respond
 *
 * The SAR engine is bound by 6 hardcoded constitutional constraints
 * that cannot be overridden by any tenant, AI prompt, or operator.
 */

import type { AIProvider, SARContext, SARAnalysis } from "../ai/provider.interface";
import { db } from "../db/connection";
import { sarLog } from "../db/schema";

export enum SARTask {
  PROPOSAL_INTAKE      = "proposal_intake",
  CONSTITUTIONAL_CHECK = "constitutional_check",
  CYCLE_MONITORING     = "cycle_monitoring",
  CHARTER_GENERATION   = "charter_generation",
  VOTE_ANALYSIS        = "vote_analysis",
  LEDGER_AUDIT         = "ledger_audit",
  HARDSHIP_REVIEW      = "hardship_review",
}

export interface SARInput {
  task: SARTask;
  orgId: string;
  refId?: string;
  sense: string;
  context: SARContext;
}

export interface SARResult {
  id: string;
  task: SARTask;
  sense: string;
  analyze: string;
  respond: string;
  analysis?: SARAnalysis;
  status: "completed" | "failed";
}

/**
 * Execute a SAR pass — the core governance intelligence operation.
 *
 * CONSTRAINT 4: No silent actions — log entry is written BEFORE any action.
 */
export async function executeSAR(
  provider: AIProvider,
  input: SARInput
): Promise<SARResult> {
  const { task, orgId, refId, sense, context } = input;

  // Build task-specific prompt
  const prompt = buildPrompt(task, sense, context);

  let analysis: SARAnalysis;
  let analyzeText: string;
  let respondText: string;
  let status: "completed" | "failed" = "completed";

  try {
    analysis = await provider.analyze(prompt, context);
    analyzeText = `${analysis.summary}\n\nRisk Level: ${analysis.riskLevel}\nReasoning: ${analysis.reasoning}`;

    if (analysis.constitutionalConflicts.length > 0) {
      analyzeText += `\n\nConstitutional Conflicts:\n${analysis.constitutionalConflicts.map((c, i) => `${i + 1}. ${c}`).join("\n")}`;
    }

    respondText = `${analysis.recommendation}\n\nSuggested Actions:\n${analysis.suggestedActions.map((a, i) => `${i + 1}. ${a}`).join("\n")}`;
  } catch (err) {
    status = "failed";
    analyzeText = `SAR analysis failed: ${err instanceof Error ? err.message : "Unknown error"}`;
    respondText = "No action taken due to analysis failure.";
    analysis = {
      summary: analyzeText,
      recommendation: respondText,
      constitutionalConflicts: [],
      riskLevel: "low",
      reasoning: analyzeText,
      suggestedActions: [],
    };
  }

  // CONSTRAINT 4: Write log BEFORE any downstream action
  const [logEntry] = await db
    .insert(sarLog)
    .values({
      orgId,
      task,
      refId: refId ?? null,
      sense,
      analyze: analyzeText,
      respond: respondText,
      status,
      modelUsed: provider.name,
    })
    .returning();

  return {
    id: logEntry.id,
    task,
    sense,
    analyze: analyzeText,
    respond: respondText,
    analysis,
    status,
  };
}

/**
 * Build a task-specific prompt for the AI provider.
 */
function buildPrompt(task: SARTask, sense: string, _context: SARContext): string {
  const taskInstructions: Record<SARTask, string> = {
    [SARTask.PROPOSAL_INTAKE]: `A new proposal has been submitted. Analyze it for:
- Alignment with the organization's constitution
- Potential conflicts with existing laws
- Financial feasibility (if applicable)
- Risk assessment
- Recommended voting period and quorum`,

    [SARTask.CONSTITUTIONAL_CHECK]: `Review the following for constitutional compliance:
- Check against every article in the constitution
- Identify any direct or indirect conflicts
- Flag ambiguous areas that may need interpretation
- Provide a clear pass/fail recommendation`,

    [SARTask.CYCLE_MONITORING]: `Perform a routine governance cycle check:
- Identify upcoming deadlines (voting periods, payment cycles)
- Flag overdue items
- Check member status (any late payments, inactive members)
- Recommend any proactive actions`,

    [SARTask.CHARTER_GENERATION]: `Generate or refine organizational charter content:
- Use formal governance language
- Ensure internal consistency
- Include standard governance clauses
- Adapt to the organization type`,

    [SARTask.VOTE_ANALYSIS]: `Analyze a completed or in-progress vote:
- Verify quorum requirements
- Calculate results
- Check for procedural compliance
- Flag any anomalies (timing, eligibility)`,

    [SARTask.LEDGER_AUDIT]: `Audit the treasury ledger:
- Verify transaction integrity (HMAC signatures)
- Check running balances
- Flag unusual patterns or discrepancies
- Verify alignment with approved disbursements`,

    [SARTask.HARDSHIP_REVIEW]: `Review a member hardship claim:
- Assess claim validity against org policies
- Recommend accommodations (if any)
- Suggest voting options for the council
- Protect member privacy in the analysis`,
  };

  return `[SAR Task: ${task}]\n\n${taskInstructions[task]}\n\nSensed Event:\n${sense}`;
}
