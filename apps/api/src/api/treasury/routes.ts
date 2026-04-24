/**
 * Treasury & Ledger API routes
 */

import { db } from "../../db/connection";
import { treasuries, ledger } from "../../db/schema";
import { eq, desc } from "drizzle-orm";
import { authenticate, requireRole } from "../../auth/rbac";
import { ok, created } from "../../lib/response";
import { Errors } from "../../lib/errors";
import { hmacSign } from "../../lib/hmac";
import { validateNoAutonomousSpending } from "../../sar/constraints";

/**
 * GET /orgs/:id/treasury — Treasury summary
 */
export async function getTreasury(
  req: Request,
  params: Record<string, string>
): Promise<Response> {
  await authenticate(req);

  const [treasury] = await db
    .select()
    .from(treasuries)
    .where(eq(treasuries.orgId, params.id))
    .limit(1);

  if (!treasury) throw Errors.notFound("Treasury");

  return ok({
    balance: treasury.balance,
    reserveBalance: treasury.reserveBalance,
    poolBalance: treasury.poolBalance,
    currency: treasury.currency,
    cycleNumber: treasury.cycleNumber,
    nextPayoutAt: treasury.nextPayoutAt,
  });
}

/**
 * GET /orgs/:id/ledger — Paginated transaction log
 */
export async function getLedger(
  req: Request,
  params: Record<string, string>
): Promise<Response> {
  await authenticate(req);

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  const entries = await db
    .select()
    .from(ledger)
    .where(eq(ledger.orgId, params.id))
    .orderBy(desc(ledger.createdAt))
    .limit(limit)
    .offset(offset);

  return ok(entries);
}

/**
 * POST /orgs/:id/ledger — Record a transaction (admin only)
 *
 * CONSTRAINT 1: Payouts require a vote reference.
 * Ledger entries are HMAC-signed and append-only.
 */
export async function recordTransaction(
  req: Request,
  params: Record<string, string>
): Promise<Response> {
  await requireRole("admin")(req, params);

  const body = (await req.json()) as {
    type: string;
    memberId?: string;
    amount: number;
    note?: string;
    cycleRef?: number;
    voteId?: string;
  };

  if (!body.type || body.amount == null) {
    throw Errors.badRequest("type and amount are required");
  }

  // CONSTRAINT 1: Validate spending has a vote reference
  validateNoAutonomousSpending({
    type: body.type,
    amount: body.amount,
    voteId: body.voteId,
  });

  // Get current treasury balance
  const [treasury] = await db
    .select()
    .from(treasuries)
    .where(eq(treasuries.orgId, params.id))
    .limit(1);

  if (!treasury) throw Errors.notFound("Treasury");

  const newBalance = treasury.balance + body.amount;

  // Sign the transaction
  const payload = JSON.stringify({
    orgId: params.id,
    type: body.type,
    amount: body.amount,
    balance: newBalance,
    timestamp: Date.now(),
  });
  const hmac = await hmacSign(payload);

  // Append to ledger (never update or delete)
  const [entry] = await db
    .insert(ledger)
    .values({
      orgId: params.id,
      type: body.type,
      memberId: body.memberId,
      amount: body.amount,
      balance: newBalance,
      note: body.note,
      hmac,
      cycleRef: body.cycleRef,
    })
    .returning();

  // Update treasury balance
  await db
    .update(treasuries)
    .set({
      balance: newBalance,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(treasuries.orgId, params.id));

  return created(entry);
}
