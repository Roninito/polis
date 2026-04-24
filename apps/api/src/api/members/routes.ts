/**
 * Member API routes
 */

import { db } from "../../db/connection";
import { members, orgs } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { authenticate, requireRole } from "../../auth/rbac";
import { ok, created } from "../../lib/response";
import { Errors } from "../../lib/errors";
import { emitMemberJoined } from "../../ws/events";
import { sendEmail } from "../../email/provider";
import { renderMemberInviteTemplate } from "../../email/templates";

/**
 * GET /orgs/:id/members — List members
 */
export async function listMembers(
  req: Request,
  params: Record<string, string>
): Promise<Response> {
  await authenticate(req);

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const role = url.searchParams.get("role");

  let query = db.select().from(members).where(eq(members.orgId, params.id));

  // Note: additional filters applied in production with proper Drizzle conditions
  const results = await query;

  const filtered = results.filter((m: any) => {
    if (status && m.status !== status) return false;
    if (role && m.role !== role) return false;
    return true;
  });

  return ok(filtered);
}

/**
 * POST /orgs/:id/members — Invite / add member
 */
export async function addMember(
  req: Request,
  params: Record<string, string>
): Promise<Response> {
  await requireRole("admin")(req, params);

  const body = (await req.json()) as {
    name: string;
    email?: string;
    role?: string;
  };

  if (!body.name) throw Errors.badRequest("name is required");

  const [org] = await db
    .select()
    .from(orgs)
    .where(eq(orgs.id, params.id))
    .limit(1);

  if (!org) throw Errors.notFound("Organization");

  const [member] = await db
    .insert(members)
    .values({
      orgId: params.id,
      name: body.name,
      email: body.email,
      role: body.role ?? "member",
    })
    .returning();

  // Send welcome email if email address provided
  if (member.email) {
    try {
      const html = renderMemberInviteTemplate({
        memberName: member.name,
        memberEmail: member.email,
        orgName: org.name,
        memberRole: member.role || "member",
        loginLink: `${process.env.PUBLIC_URL || "http://localhost:5173"}/login`,
      });

      await sendEmail({
        to: member.email,
        subject: `Welcome to ${org.name} on POLIS`,
        html,
      });
    } catch (error) {
      console.error(`[email] Failed to send welcome email to ${member.email}:`, error);
      // Don't fail the request if email fails
    }
  }

  // Emit WebSocket event for real-time dashboard updates
  emitMemberJoined(params.id, {
    id: member.id,
    name: member.name,
    role: member.role || "member",
  });

  return created(member);
}

/**
 * GET /orgs/:id/members/:mid — Get member detail
 */
export async function getMember(
  req: Request,
  params: Record<string, string>
): Promise<Response> {
  await authenticate(req);

  const [member] = await db
    .select()
    .from(members)
    .where(
      and(eq(members.orgId, params.id), eq(members.id, params.mid))
    )
    .limit(1);

  if (!member) throw Errors.notFound("Member");

  return ok(member);
}

/**
 * PATCH /orgs/:id/members/:mid — Update member
 */
export async function updateMember(
  req: Request,
  params: Record<string, string>
): Promise<Response> {
  await requireRole("admin")(req, params);

  const body = (await req.json()) as Partial<typeof members.$inferInsert>;

  const [updated] = await db
    .update(members)
    .set(body)
    .where(
      and(eq(members.orgId, params.id), eq(members.id, params.mid))
    )
    .returning();

  if (!updated) throw Errors.notFound("Member");

  return ok(updated);
}

/**
 * DELETE /orgs/:id/members/:mid — Remove member
 */
export async function removeMember(
  req: Request,
  params: Record<string, string>
): Promise<Response> {
  await requireRole("admin")(req, params);

  const [member] = await db
    .update(members)
    .set({ status: "left" })
    .where(
      and(eq(members.orgId, params.id), eq(members.id, params.mid))
    )
    .returning();

  if (!member) throw Errors.notFound("Member");

  // TODO: Trigger SAR (member departure)

  return ok(member);
}
