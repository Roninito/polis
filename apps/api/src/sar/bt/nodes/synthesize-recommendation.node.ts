/**
 * SynthesizeRecommendationNode — Respond phase
 *
 * Combines all analysis slots from memory (constitutional, financial, risk)
 * into a single unified SARAnalysis recommendation.
 *
 * This is the final "Respond" phase — it reads what all Analyze nodes wrote
 * and synthesizes a single governance recommendation for the proposal.
 */

import { BTStatus, type SARLeafNode, type SARNodeContext } from "../types";
import type { SARAnalysis } from "../../../ai/provider.interface";

export class SynthesizeRecommendationNode implements SARLeafNode {
  id    = "synthesize-recommendation";
  label = "Respond: Synthesize Governance Recommendation";

  async tick(context: SARNodeContext): Promise<BTStatus> {
    try {
      const {
        constitutionalAnalysis: constitutional,
        financialImpact:        financial,
        riskAssessment:         risk,
      } = context.memory;

      // Need at least one analysis to synthesize from
      const analyses = [constitutional, financial, risk].filter(Boolean);
      if (analyses.length === 0) {
        return BTStatus.FAILURE;
      }

      // Determine aggregate risk level (take highest)
      const riskOrder = { low: 0, medium: 1, high: 2, critical: 3 } as const;
      type RiskLevel = keyof typeof riskOrder;
      const riskLevel = analyses.reduce<RiskLevel>((highest, a) => {
        const lvl = (a!.riskLevel ?? "low") as RiskLevel;
        return riskOrder[lvl] > riskOrder[highest] ? lvl : highest;
      }, "low");

      // Collect all conflicts and actions
      const allConflicts = analyses.flatMap(a => a!.conflicts);
      const allActions   = analyses.flatMap(a => a!.suggestedActions);

      // Build synthesis summary
      const summaryParts: string[] = [];
      if (constitutional) summaryParts.push(`Constitutional: ${constitutional.summary}`);
      if (financial)      summaryParts.push(`Financial: ${financial.summary}`);
      if (risk)           summaryParts.push(`Risk: ${risk.summary}`);

      const dominantAnalysis = (
        risk ?? constitutional ?? financial
      )!;

      const synthesized: SARAnalysis = {
        summary:                summaryParts.join(" | "),
        recommendation:         dominantAnalysis.recommendation,
        constitutionalConflicts: allConflicts,
        riskLevel,
        reasoning:              [
          constitutional?.reasoning,
          financial?.reasoning,
          risk?.reasoning,
        ].filter(Boolean).join("\n\n---\n\n"),
        suggestedActions:       [...new Set(allActions)], // deduplicate
      };

      context.memory.synthesizedAnalysis = synthesized;

      context.emit({
        type:      "sar:synthesize_complete",
        source:    this.id,
        orgId:     context.orgId,
        refId:     context.refId,
        payload:   {
          riskLevel,
          conflictsCount:    allConflicts.length,
          actionsCount:      allActions.length,
          analysesUsed:      analyses.length,
        },
        timestamp: new Date().toISOString(),
      });

      return BTStatus.SUCCESS;
    } catch (err) {
      context.emit({
        type:      "sar:synthesize_failed",
        source:    this.id,
        orgId:     context.orgId,
        payload:   { error: err instanceof Error ? err.message : String(err) },
        timestamp: new Date().toISOString(),
      });
      return BTStatus.FAILURE;
    }
  }
}
