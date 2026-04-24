/**
 * Tenant context — resolves tenant from request and provides scoped DB access.
 *
 * In standalone mode: always returns the default (single) schema.
 * In multi-tenant mode: resolves tenant from subdomain, injects schema context.
 */

import { db, type Database } from "./connection";

export interface TenantContext {
  slug: string;
  schema: string;
  db: Database;
}

/**
 * Resolve tenant slug from the Host header.
 *
 * Examples:
 *   maplewood.polis.app → maplewood
 *   localhost:3000       → default (standalone)
 */
export function resolveTenantFromHost(host: string | null): string {
  if (!host) return "default";

  // Strip port
  const hostname = host.split(":")[0];

  // localhost or IP → standalone
  if (hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return "default";
  }

  // Subdomain extraction: <slug>.polis.app
  const parts = hostname.split(".");
  if (parts.length >= 3) {
    return parts[0];
  }

  return "default";
}

/**
 * Get tenant-scoped database instance.
 *
 * In standalone mode, returns the default db.
 * In multi-tenant mode, sets the PostgreSQL search_path to the tenant schema.
 */
export function getTenantDb(slug: string): TenantContext {
  const schemaName = slug === "default" ? "public" : `tenant_${slug}`;
  // TODO: In multi-tenant mode, execute SET search_path per connection
  return {
    slug,
    schema: schemaName,
    db,
  };
}
