/**
 * Organization API routes
 */

import { db } from "../../db/connection";
import { orgs, members, proposals, treasuries } from "../../db/schema";
import { eq, and, count, sql } from "drizzle-orm";
import { authenticate } from "../../auth/rbac";
import { ok } from "../../lib/response";
import { Errors } from "../../lib/errors";

/**
 * GET /me/orgs — List organizations the authenticated user belongs to
 */
export async function listMyOrgs(req: Request): Promise<Response> {
  const user = await authenticate(req);

  const rows = await db
    .select({
      id: orgs.id,
      name: orgs.name,
      slug: orgs.slug,
      type: orgs.type,
      status: orgs.status,
      role: members.role,
    })
    .from(members)
    .innerJoin(orgs, eq(members.orgId, orgs.id))
    .where(and(eq(members.userId, user.sub), eq(members.status, "active")));

  return ok(rows);
}

/**
 * GET /orgs/:id — Get org details
 */
export async function getOrg(
  req: Request,
  params: Record<string, string>
): Promise<Response> {
  await authenticate(req);

  const [org] = await db
    .select()
    .from(orgs)
    .where(eq(orgs.id, params.id))
    .limit(1);

  if (!org) throw Errors.notFound("Organization");

  return ok(org);
}

/**
 * PATCH /orgs/:id — Update org settings
 */
export async function updateOrg(
  req: Request,
  params: Record<string, string>
): Promise<Response> {
  await authenticate(req);

  const body = (await req.json()) as Partial<typeof orgs.$inferInsert>;

  const [updated] = await db
    .update(orgs)
    .set({ ...body, updatedAt: new Date().toISOString() })
    .where(eq(orgs.id, params.id))
    .returning();

  if (!updated) throw Errors.notFound("Organization");

  return ok(updated);
}

/**
 * GET /orgs/:id/stats — Dashboard stats
 */
export async function getOrgStats(
  req: Request,
  params: Record<string, string>
): Promise<Response> {
  await authenticate(req);

  const orgId = params.id;

  const [memberCount] = await db
    .select({ count: count() })
    .from(members)
    .where(and(eq(members.orgId, orgId), eq(members.status, "active")));

  const [proposalCount] = await db
    .select({ count: count() })
    .from(proposals)
    .where(eq(proposals.orgId, orgId));

  const [openProposals] = await db
    .select({ count: count() })
    .from(proposals)
    .where(
      and(
        eq(proposals.orgId, orgId),
        sql`${proposals.status} IN ('open', 'voting')`
      )
    );

  const [treasury] = await db
    .select()
    .from(treasuries)
    .where(eq(treasuries.orgId, orgId))
    .limit(1);

  return ok({
    members: memberCount?.count ?? 0,
    proposals: proposalCount?.count ?? 0,
    openProposals: openProposals?.count ?? 0,
    treasuryBalance: treasury?.balance ?? 0,
    reserveBalance: treasury?.reserveBalance ?? 0,
    cycleNumber: treasury?.cycleNumber ?? 0,
  });
}
