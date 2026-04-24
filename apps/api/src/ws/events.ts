/**
 * Governance event emitter — typed events for WebSocket + Redis pub/sub.
 *
 * Any API route or SAR operation calls these to notify connected clients.
 */

import { broadcastToOrg, type GovernanceEvent } from "./server";
import { publishEvent } from "./redis-pubsub";

export const EventType = {
  PROPOSAL_CREATED: "proposal.created",
  PROPOSAL_UPDATED: "proposal.updated",
  VOTE_CAST: "vote.cast",
  VOTE_COMPLETED: "vote.completed",
  MEMBER_JOINED: "member.joined",
  MEMBER_LEFT: "member.left",
  TREASURY_TRANSACTION: "treasury.transaction",
  SAR_COMPLETED: "sar.completed",
  SAR_FAILED: "sar.failed",
  CONSTITUTION_AMENDED: "constitution.amended",
  LAW_ENACTED: "law.enacted",
  CYCLE_ADVANCED: "cycle.advanced",
} as const;

export type EventTypeName = (typeof EventType)[keyof typeof EventType];

/**
 * Emit a governance event — broadcasts locally + publishes to Redis for cluster.
 */
export function emit(orgId: string, type: EventTypeName, data: unknown) {
  const event: GovernanceEvent = {
    type,
    orgId,
    data,
    ts: Date.now(),
  };

  // Local WebSocket broadcast
  broadcastToOrg(orgId, event);

  // Redis pub/sub for multi-instance
  publishEvent(orgId, event).catch(() => {
    // Redis may not be available (standalone mode without Redis)
  });
}

// Convenience helpers
export function emitProposalCreated(orgId: string, proposal: { id: string; title: string; type: string }) {
  emit(orgId, EventType.PROPOSAL_CREATED, proposal);
}

export function emitVoteCast(orgId: string, vote: { proposalId: string; vote: string }) {
  emit(orgId, EventType.VOTE_CAST, vote);
}

export function emitTreasuryTransaction(orgId: string, tx: { id: string; type: string; amount: number }) {
  emit(orgId, EventType.TREASURY_TRANSACTION, tx);
}

export function emitSARCompleted(orgId: string, result: { id: string; task: string; status: string }) {
  emit(orgId, EventType.SAR_COMPLETED, result);
}

export function emitMemberJoined(orgId: string, member: { id: string; name: string; role: string }) {
  emit(orgId, EventType.MEMBER_JOINED, member);
}
