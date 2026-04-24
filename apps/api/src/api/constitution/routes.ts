/**
 * Constitution & Laws API routes
 * GET /orgs/:id/constitution — Get current constitution with articles
 * GET /orgs/:id/laws — List operating laws
 * POST /orgs/:id/laws — Create a new law
 */

import { ok, created } from "../../lib/response";
import { Errors } from "../../lib/errors";

export async function getConstitution(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const match = url.pathname.match(/\/orgs\/([^/]+)\/constitution/);
  const orgId = match?.[1];
  if (!orgId) throw Errors.notFound("Organization not found");

  return ok({
    orgId,
    version: 1,
    preamble: "We, the members of this organization, establish this constitution to govern our collective affairs with transparency, fairness, and democratic participation.",
    ratifiedAt: new Date().toISOString(),
    articles: [
      {
        number: 1,
        title: "Membership",
        body: "All members shall have equal voting rights. Membership may be granted by majority vote of existing members.",
      },
      {
        number: 2,
        title: "Governance",
        body: "Decisions shall be made through proposals submitted to the collective and decided by vote. The SAR engine provides analysis but does not make autonomous decisions.",
      },
      {
        number: 3,
        title: "Treasury",
        body: "All financial transactions must be approved by human members. The SAR engine shall not autonomously spend funds. A minimum reserve of 15% shall be maintained.",
      },
    ],
  });
}

export async function listLaws(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const match = url.pathname.match(/\/orgs\/([^/]+)\/laws/);
  const orgId = match?.[1];
  if (!orgId) throw Errors.notFound("Organization not found");

  return ok([
    {
      id: "law-1",
      orgId,
      title: "Contribution Schedule",
      body: "Members contribute monthly on the first business day. Amount is determined by member tier.",
      status: "active",
      enactedAt: new Date().toISOString(),
    },
    {
      id: "law-2",
      orgId,
      title: "Emergency Procedures",
      body: "Emergency proposals bypass the standard 7-day voting period and require 2/3 supermajority within 48 hours.",
      status: "active",
      enactedAt: new Date().toISOString(),
    },
  ]);
}

export async function createLaw(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const match = url.pathname.match(/\/orgs\/([^/]+)\/laws/);
  const orgId = match?.[1];
  if (!orgId) throw Errors.notFound("Organization not found");

  const body = (await req.json()) as { title?: string; body?: string };
  if (!body.title || !body.body) {
    throw Errors.validation("Title and body are required");
  }

  return created({
    id: `law-${Date.now()}`,
    orgId,
    title: body.title,
    body: body.body,
    status: "active",
    enactedAt: new Date().toISOString(),
  });
}
