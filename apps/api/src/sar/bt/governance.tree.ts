/**
 * POLIS Governance Analysis Behavior Tree
 *
 * Defines the canonical SAR governance workflow as a behavior tree:
 *
 *   Sequence [
 *     ProposalSenseNode,           ← Sense phase
 *     Parallel (failFast=false) [  ← Analyze phase (all run, partial success OK)
 *       Selector [                   Constitutional (with fallback)
 *         ConstitutionalAnalysisNode,
 *         FallbackConstitutionalNode, (skips if AI unavailable)
 *       ],
 *       FinancialImpactNode,          Financial impact
 *       RiskAssessmentNode,           Risk assessment
 *     ],
 *     SynthesizeRecommendationNode ← Respond phase
 *   ]
 *
 * The Parallel node uses failFast=false so partial analysis results
 * still flow into Synthesize even if one analysis leg fails (e.g., AI timeout).
 *
 * The Selector wrapper on ConstitutionalAnalysis provides a graceful
 * fallback if the AI provider returns an error.
 */

import type { BTNodeConfig } from "./types";
import {
  ProposalSenseNode,
  ConstitutionalAnalysisNode,
  FinancialImpactNode,
  RiskAssessmentNode,
  SynthesizeRecommendationNode,
} from "./nodes";

// Simple passthrough fallback for when constitutional analysis fails
// (e.g., no constitution document uploaded)
import { BTStatus, type SARLeafNode, type SARNodeContext } from "./types";

class SkipConstitutionalNode implements SARLeafNode {
  id    = "skip-constitutional";
  label = "Analyze: Skip Constitutional (No Document)";

  async tick(context: SARNodeContext): Promise<BTStatus> {
    // No constitution — write empty slot so synthesize can proceed
    context.memory.constitutionalAnalysis = {
      summary:          "No constitution document available for analysis.",
      riskLevel:        "low",
      recommendation:   "Consider uploading a constitution document for deeper governance analysis.",
      reasoning:        "Constitutional analysis skipped — no document provided.",
      conflicts:        [],
      suggestedActions: ["Upload organization constitution in settings"],
      completedAt:      new Date().toISOString(),
    };
    return BTStatus.SUCCESS;
  }
}

/**
 * The primary governance analysis tree.
 * Used for proposal_intake and vote_analysis tasks.
 */
export const GovernanceAnalysisTree: BTNodeConfig = {
  type: "sequence",
  label: "Governance Analysis",
  children: [
    // ── Phase 1: SENSE ─────────────────────────────────────────────
    {
      type: "leaf",
      node: new ProposalSenseNode(),
    },

    // ── Phase 2: ANALYZE (parallel — partial results OK) ───────────
    {
      type:     "parallel",
      label:    "Multi-Dimensional Analysis",
      failFast: false, // Continue even if one analysis fails
      children: [
        // Constitutional analysis with graceful fallback
        {
          type:  "selector",
          label: "Constitutional Analysis (with fallback)",
          children: [
            { type: "leaf", node: new ConstitutionalAnalysisNode() },
            { type: "leaf", node: new SkipConstitutionalNode() },
          ],
        },
        // Financial impact (best-effort)
        { type: "leaf", node: new FinancialImpactNode() },
        // Risk assessment (best-effort)
        { type: "leaf", node: new RiskAssessmentNode() },
      ],
    },

    // ── Phase 3: RESPOND ───────────────────────────────────────────
    {
      type: "leaf",
      node: new SynthesizeRecommendationNode(),
    },
  ],
};
