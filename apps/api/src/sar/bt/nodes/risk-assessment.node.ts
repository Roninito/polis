/**
 * RiskAssessmentNode — Analyze phase
 *
 * Evaluates governance, legal, operational, and reputational risks
 * associated with the proposal. Runs in parallel with other analysis nodes.
 */

import { BTStatus, type SARLeafNode, type SARNodeContext, type AnalysisSlot } from "../types";

export class RiskAssessmentNode implements SARLeafNode {
  id    = "risk-assessment";
  label = "Analyze: Risk Assessment";

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
        conflicts:        analysis.constitutionalConflicts,
        suggestedActions: analysis.suggestedActions,
        completedAt:      new Date().toISOString(),
      };

      context.memory.riskAssessment = slot;

      context.emit({
        type:      "sar:risk_complete",
        source:    this.id,
        orgId,
        refId,
        payload:   { riskLevel: slot.riskLevel },
        timestamp: new Date().toISOString(),
      });

      return BTStatus.SUCCESS;
    } catch (err) {
      context.emit({
        type:      "sar:risk_failed",
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
      "You are a risk management analyst specializing in organizational governance.",
      "Assess the risks associated with the following governance proposal.",
      "Consider: governance risk, legal risk, operational risk, reputational risk.",
      "Rate overall risk as: low, medium, high, or critical.",
      "",
      "PROPOSAL:",
      sense,
      "",
      "Provide your risk assessment.",
    ].join("\n");
  }
}
