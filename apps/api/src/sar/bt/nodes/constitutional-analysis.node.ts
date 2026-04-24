/**
 * ConstitutionalAnalysisNode — Analyze phase
 *
 * Checks the proposal against the organization's constitution.
 * Identifies conflicts, alignment, and constitutional implications.
 */

import { BTStatus, type SARLeafNode, type SARNodeContext, type AnalysisSlot } from "../types";

export class ConstitutionalAnalysisNode implements SARLeafNode {
  id    = "constitutional-analysis";
  label = "Analyze: Constitutional Alignment";

  async tick(context: SARNodeContext): Promise<BTStatus> {
    try {
      const { orgId, refId, senseInput, sarContext, provider } = context;
      const constitution = context.memory.constitution ?? "";

      const prompt = this.buildPrompt(senseInput, constitution);
      const analysis = await provider.analyze(prompt, {
        ...sarContext,
        constitution,
      });

      const slot: AnalysisSlot = {
        summary:          analysis.summary,
        riskLevel:        analysis.riskLevel,
        recommendation:   analysis.recommendation,
        reasoning:        analysis.reasoning,
        conflicts:        analysis.constitutionalConflicts,
        suggestedActions: analysis.suggestedActions,
        completedAt:      new Date().toISOString(),
      };

      context.memory.constitutionalAnalysis = slot;

      context.emit({
        type:      "sar:constitutional_complete",
        source:    this.id,
        orgId,
        refId,
        payload:   { riskLevel: slot.riskLevel, conflicts: slot.conflicts.length },
        timestamp: new Date().toISOString(),
      });

      return BTStatus.SUCCESS;
    } catch (err) {
      context.emit({
        type:      "sar:constitutional_failed",
        source:    this.id,
        orgId:     context.orgId,
        payload:   { error: err instanceof Error ? err.message : String(err) },
        timestamp: new Date().toISOString(),
      });
      // Analysis failure is non-fatal — tree can still continue with other nodes
      return BTStatus.FAILURE;
    }
  }

  private buildPrompt(sense: string, constitution: string): string {
    return [
      "You are a constitutional governance analyst.",
      "Analyze the following proposal against the organization's constitution.",
      "Identify any conflicts, alignment, or implications.",
      "",
      "PROPOSAL:",
      sense,
      "",
      "CONSTITUTION:",
      constitution || "(No constitution provided)",
      "",
      "Provide your constitutional analysis.",
    ].join("\n");
  }
}
