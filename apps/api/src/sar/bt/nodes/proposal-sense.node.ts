/**
 * ProposalSenseNode — Phase 1 of the SAR governance BT
 *
 * SENSE: Gather proposal data, constitution, and org context
 * and write them into shared memory for downstream Analyze nodes.
 */

import { BTStatus, type SARLeafNode, type SARNodeContext } from "../types";

export class ProposalSenseNode implements SARLeafNode {
  id    = "proposal-sense";
  label = "Sense: Gather Proposal Context";

  async tick(context: SARNodeContext): Promise<BTStatus> {
    try {
      const { orgId, refId, senseInput, sarContext } = context;

      // Write sense data into shared memory for downstream nodes
      context.memory.constitution = sarContext.constitution ?? "";
      context.memory.orgContext   = {
        orgId,
        orgName:     sarContext.orgName,
        orgType:     (sarContext as Record<string, unknown>).orgType,
        memberCount: (sarContext as Record<string, unknown>).memberCount,
      };

      // If we have a refId (proposal), store its reference
      if (refId) {
        context.memory.proposal = {
          id:         refId,
          orgId,
          senseInput, // raw sense text is the proposal description
        };
      }

      context.emit({
        type:      "sar:sense_complete",
        source:    this.id,
        orgId,
        refId,
        payload:   { hasConstitution: !!context.memory.constitution, refId },
        timestamp: new Date().toISOString(),
      });

      return BTStatus.SUCCESS;
    } catch (err) {
      context.emit({
        type:      "sar:sense_failed",
        source:    this.id,
        orgId:     context.orgId,
        payload:   { error: err instanceof Error ? err.message : String(err) },
        timestamp: new Date().toISOString(),
      });
      return BTStatus.FAILURE;
    }
  }
}
