/**
 * Proposal & Voting API routes
 */

import { db } from "../../db/connection";
import { proposals, votes, members, orgs } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { authenticate } from "../../auth/rbac";
import { ok, created } from "../../lib/response";
import { Errors } from "../../lib/errors";
import { emitProposalCreated, emitVoteCast } from "../../ws/events";
import { sendEmail } from "../../email/provider";
import { renderProposalCreatedTemplate } from "../../email/templates";


/**
 * GET /orgs/:id/proposals — List proposals
 */
export async function listProposals(
  req: Request,
  params: Record<string, string>
): Promise<Response> {
  await authenticate(req);

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const type = url.searchParams.get("type");

  const results = await db
    .select()
    .from(proposals)
    .where(eq(proposals.orgId, params.id))
    .orderBy(proposals.createdAt);

  const filtered = results.filter((p: any) => {
    if (status && p.status !== status) return false;
    if (type && p.type !== type) return false;
    return true;
  });

  return ok(filtered);
}

/**
 * POST /orgs/:id/proposals — Submit proposal (triggers async SAR analysis)
 */
export async function createProposal(
  req: Request,
  params: Record<string, string>
): Promise<Response> {
  const user = await authenticate(req);

  const body = (await req.json()) as {
    type: string;
    title: string;
    body: string;
    votingEnds?: string;
  };

  if (!body.type || !body.title || !body.body) {
    throw Errors.badRequest("type, title, and body are required");
  }

  // Find member record for the authenticated user
  const [member] = await db
    .select()
    .from(members)
    .where(and(eq(members.orgId, params.id), eq(members.userId, user.sub)))
    .limit(1);

  // Get org details
  const [org] = await db
    .select()
    .from(orgs)
    .where(eq(orgs.id, params.id))
    .limit(1);

  if (!org) throw Errors.notFound("Organization");

  const [proposal] = await db
    .insert(proposals)
    .values({
      orgId: params.id,
      type: body.type,
      title: body.title,
      body: body.body,
      proposedBy: member?.id,
      votingEnds: body.votingEnds ? new Date(body.votingEnds).toISOString() : undefined,
    })
    .returning();

  // Emit WebSocket event for real-time dashboard updates
  emitProposalCreated(params.id, {
    id: proposal.id,
    title: proposal.title,
    type: proposal.type,
  });

  // Send notification emails to all org members (async, don't block request)
  (async () => {
    try {
      const orgMembers = await db
        .select()
        .from(members)
        .where(and(eq(members.orgId, params.id), eq(members.status, "active")));

      const votingDeadline = proposal.votingEnds
        ? new Date(proposal.votingEnds).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "TBD";

      const baseUrl = process.env.PUBLIC_URL || "http://localhost:5173";
      const voteLink = `${baseUrl}/org/${params.id}/proposals/${proposal.id}`;

      for (const m of orgMembers) {
        if (!m.email) continue;

        try {
          const html = renderProposalCreatedTemplate({
            memberName: m.name,
            orgName: org.name,
            proposalTitle: proposal.title,
            proposalType: proposal.type,
            proposalBody: proposal.body.substring(0, 200),
            proposedBy: member?.name || "Unknown",
            votingDeadline,
            voteLink,
          });

          await sendEmail({
            to: m.email,
            subject: `New Proposal: ${proposal.title}`,
            html,
          });
        } catch (error) {
          console.error(`[email] Failed to send proposal notification to ${m.email}:`, error);
        }
      }
    } catch (error) {
      console.error("[email] Failed to send proposal notifications:", error);
    }
  })();

  // TODO: Queue async SAR analysis (proposal_intake task)

  return created(proposal);
}

/**
 * GET /orgs/:id/proposals/:pid — Get proposal detail
 */
export async function getProposal(
  req: Request,
  params: Record<string, string>
): Promise<Response> {
  await authenticate(req);

  const [proposal] = await db
    .select()
    .from(proposals)
    .where(
      and(eq(proposals.orgId, params.id), eq(proposals.id, params.pid))
    )
    .limit(1);

  if (!proposal) throw Errors.notFound("Proposal");

  return ok(proposal);
}

/**
 * PATCH /orgs/:id/proposals/:pid — Update draft proposal
 */
export async function updateProposal(
  req: Request,
  params: Record<string, string>
): Promise<Response> {
  await authenticate(req);

  const body = (await req.json()) as Partial<typeof proposals.$inferInsert>;

  // Only allow updates to drafts
  const [existing] = await db
    .select()
    .from(proposals)
    .where(
      and(eq(proposals.orgId, params.id), eq(proposals.id, params.pid))
    )
    .limit(1);

  if (!existing) throw Errors.notFound("Proposal");
  if (existing.status !== "draft") {
    throw Errors.badRequest("Can only update draft proposals");
  }

  const [updated] = await db
    .update(proposals)
    .set({ ...body, updatedAt: new Date().toISOString() })
    .where(eq(proposals.id, params.pid))
    .returning();

  return ok(updated);
}

/**
 * POST /orgs/:id/proposals/:pid/vote — Cast vote
 */
export async function castVote(
  req: Request,
  params: Record<string, string>
): Promise<Response> {
  const user = await authenticate(req);

  const body = (await req.json()) as {
    vote: "yea" | "nay" | "abstain";
    reason?: string;
  };

  if (!body.vote || !["yea", "nay", "abstain"].includes(body.vote)) {
    throw Errors.badRequest('vote must be "yea", "nay", or "abstain"');
  }

  // Find member
  const [member] = await db
    .select()
    .from(members)
    .where(and(eq(members.orgId, params.id), eq(members.userId, user.sub)))
    .limit(1);

  if (!member) throw Errors.forbidden("Not a member of this organization");
  if (member.status !== "active") throw Errors.forbidden("Member is not active");

  // Check proposal exists and is in voting status
  const [proposal] = await db
    .select()
    .from(proposals)
    .where(
      and(eq(proposals.orgId, params.id), eq(proposals.id, params.pid))
    )
    .limit(1);

  if (!proposal) throw Errors.notFound("Proposal");
  if (proposal.status !== "voting" && proposal.status !== "open") {
    throw Errors.badRequest("Proposal is not open for voting");
  }

  if (proposal.votingEnds && proposal.votingEnds < new Date().toISOString()) {
    throw Errors.badRequest("Voting period has ended");
  }

  // Check for duplicate vote
  const [existingVote] = await db
    .select()
    .from(votes)
    .where(
      and(eq(votes.proposalId, params.pid), eq(votes.memberId, member.id))
    )
    .limit(1);

  if (existingVote) {
    throw Errors.conflict("You have already voted on this proposal");
  }

  // Cast vote
  const [vote] = await db
    .insert(votes)
    .values({
      proposalId: params.pid,
      memberId: member.id,
      vote: body.vote,
      reason: body.reason,
    })
    .returning();

  // Update tally
  const field =
    body.vote === "yea"
      ? "votesFor"
      : body.vote === "nay"
        ? "votesAgainst"
        : "abstain";

  await db
    .update(proposals)
    .set({
      [field === "votesFor"
        ? "votesFor"
        : field === "votesAgainst"
          ? "votesAgainst"
          : "abstain"]: proposal[field === "votesFor" ? "votesFor" : field === "votesAgainst" ? "votesAgainst" : "abstain"] + 1,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(proposals.id, params.pid));

  // Emit WebSocket event for real-time updates
  emitVoteCast(params.id, {
    proposalId: params.pid,
    vote: body.vote,
  });

  return created(vote);
}

/**
 * GET /orgs/:id/proposals/:pid/votes — Vote breakdown
 */
export async function getVotes(
  req: Request,
  params: Record<string, string>
): Promise<Response> {
  await authenticate(req);

  const results = await db
    .select()
    .from(votes)
    .where(eq(votes.proposalId, params.pid));

  return ok(results);
}
