/**
 * RBAC middleware — Role-Based Access Control
 *
 * Role hierarchy: superadmin > org_admin > council > member > observer
 * Higher roles inherit all permissions of lower roles.
 */

import { verifyToken, type TokenPayload } from "./jwt";
import { Errors } from "../lib/errors";
import { db } from "../db/connection";
import { members } from "../db/schema";
import { eq, and } from "drizzle-orm";

const ROLE_HIERARCHY: Record<string, number> = {
  superadmin: 100,
  org_admin: 80,
  founder: 80,
  admin: 80,
  council: 60,
  member: 40,
  observer: 20,
};

export type OrgRole = keyof typeof ROLE_HIERARCHY;

/**
 * Extract and verify JWT from request.
 * Checks Authorization header (Bearer) or cookie.
 */
export async function authenticate(req: Request): Promise<TokenPayload> {
  // Try Authorization header first
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    return verifyToken(token);
  }

  // Try cookie
  const cookies = req.headers.get("cookie") ?? "";
  const tokenCookie = cookies
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("polis_token="));

  if (tokenCookie) {
    const token = tokenCookie.split("=")[1];
    return verifyToken(token);
  }

  throw Errors.unauthorized();
}

/**
 * Check if a user's role meets the minimum required level.
 */
export function hasRole(userRole: string, minimumRole: string): boolean {
  const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[minimumRole] ?? 0;
  return userLevel >= requiredLevel;
}

/**
 * Middleware: require minimum role for route access.
 * Checks org membership role from the database when an orgId param is present.
 */
export function requireRole(minimumRole: string) {
  return async (req: Request, params?: Record<string, string>): Promise<TokenPayload> => {
    const payload = await authenticate(req);

    // Superadmins bypass org-level checks
    if (payload.role === "superadmin") return payload;

    // If we have an org ID in the URL, look up the user's org-specific role
    const orgId = params?.id;
    if (orgId && payload.sub) {
      const [membership] = await db
        .select({ role: members.role })
        .from(members)
        .where(and(
          eq(members.orgId, orgId),
          eq(members.userId, payload.sub),
          eq(members.status, "active")
        ))
        .limit(1);

      if (membership) {
        const effectiveRole = membership.role;
        if (!hasRole(effectiveRole, minimumRole)) {
          throw Errors.forbidden(`Requires ${minimumRole} role or higher`);
        }
        return payload;
      }
    }

    // Fall back to JWT role
    const effectiveRole = payload.orgRole ?? payload.role;
    if (!hasRole(effectiveRole, minimumRole)) {
      throw Errors.forbidden(`Requires ${minimumRole} role or higher`);
    }
    return payload;
  };
}

/**
 * Permission checking functions for common operations.
 */

export interface PermissionContext {
  role: string;
  orgId?: string;
}

export function canEditOrg(context: PermissionContext): boolean {
  return hasRole(context.role, 'org_admin');
}

export function canManageMembers(context: PermissionContext): boolean {
  return hasRole(context.role, 'org_admin');
}

export function canCreateProposal(context: PermissionContext): boolean {
  return hasRole(context.role, 'council');
}

export function canVote(context: PermissionContext): boolean {
  // Voting requires at least member role AND org context
  const canVoteRole = hasRole(context.role, 'member');
  if (context.role === 'superadmin') return true;
  return canVoteRole && context.orgId !== undefined;
}
