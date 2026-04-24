/**
 * FinancialImpactNode — Analyze phase
 *
 * Estimates the financial impact of a governance proposal.
 * Runs in parallel with constitutional and risk analysis.
 */

import { BTStatus, type SARLeafNode, type SARNodeContext, type AnalysisSlot } from "../types";

export class FinancialImpactNode implements SARLeafNode {
  id    = "financial-impact";
  label = "Analyze: Financial Impact";

  async tick(context: SARNodeContext): Promise<BTStatus> {
    try {
      const { orgId, refId, senseInput, sarContext, provider } = context;

      const prompt = this.buildPrompt(senseInput);
      const analysis = await provider.analyze(prompt, sarContext);

      const slot: AnalysisSlot = {
        summary:          analysis.summary,
        riskLevel:        analysis.riskLevel,
        recommendation:   analysis.recommendation,
        reasoning:        analysis.reasoning,
        conflicts:        [],
        suggestedActions: analysis.suggestedActions,
        completedAt:      new Date().toISOString(),
      };

      context.memory.financialImpact = slot;

      context.emit({
        type:      "sar:financial_complete",
        source:    this.id,
        orgId,
        refId,
        payload:   { riskLevel: slot.riskLevel },
        timestamp: new Date().toISOString(),
      });

      return BTStatus.SUCCESS;
    } catch (err) {
      // Financial analysis failure is non-fatal
      context.emit({
        type:      "sar:financial_failed",
        source:    this.id,
        orgId:     context.orgId,
        payload:   { error: err instanceof Error ? err.message : String(err) },
        timestamp: new Date().toISOString(),
      });
      return BTStatus.FAILURE;
    }
  }

  private buildPrompt(sense: string): string {
    return [
      "You are a financial governance analyst.",
      "Analyze the financial implications of the following governance proposal.",
      "Consider budget impact, resource requirements, and financial sustainability.",
      "",
      "PROPOSAL:",
      sense,
      "",
      "Provide your financial impact analysis.",
    ].join("\n");
  }
}
