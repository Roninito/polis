/**
 * SAR Log API routes
 */

import { db } from "../../db/connection";
import { sarLog } from "../../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { authenticate } from "../../auth/rbac";
import { ok } from "../../lib/response";
import { Errors } from "../../lib/errors";

/**
 * GET /orgs/:id/sar — Paginated SAR log
 */
export async function listSarLog(
  req: Request,
  params: Record<string, string>
): Promise<Response> {
  await authenticate(req);

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const task = url.searchParams.get("task");
  const status = url.searchParams.get("status");

  let results = await db
    .select()
    .from(sarLog)
    .where(eq(sarLog.orgId, params.id))
    .orderBy(desc(sarLog.createdAt))
    .limit(limit)
    .offset(offset);

  if (task) results = results.filter((e) => e.task === task);
  if (status) results = results.filter((e) => e.status === status);

  return ok(results);
}

/**
 * GET /orgs/:id/sar/:sid — Single SAR entry
 */
export async function getSarEntry(
  req: Request,
  params: Record<string, string>
): Promise<Response> {
  await authenticate(req);

  const [entry] = await db
    .select()
    .from(sarLog)
    .where(and(eq(sarLog.orgId, params.id), eq(sarLog.id, params.sid)))
    .limit(1);

  if (!entry) throw Errors.notFound("SAR entry");

  return ok(entry);
}
