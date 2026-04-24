/**
 * API Key authentication — org-scoped keys with SHA-256 hashing.
 *
 * Key format: pk_live_<32 char nanoid>
 * Storage: prefix stored in plaintext for lookup, full key SHA-256 hashed.
 */

import { nanoid } from "nanoid";
import { createHash } from "crypto";
import { db } from "../db/connection";
import { apiKeys } from "../db/schema";
import { eq } from "drizzle-orm";
import { Errors } from "../lib/errors";

const KEY_PREFIX = "pk_live_";

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Generate a new API key pair (full key + hash).
 */
export async function generateApiKey(): Promise<{
  key: string;
  prefix: string;
  hash: string;
}> {
  const suffix = nanoid(32);
  const fullKey = `${KEY_PREFIX}${suffix}`;
  const prefix = `${KEY_PREFIX}${suffix.slice(0, 4)}`;
  const hash = sha256(fullKey);

  return { key: fullKey, prefix, hash };
}

/**
 * Authenticate a request via X-API-Key header.
 * Returns the org ID the key is scoped to.
 */
export async function authenticateApiKey(
  req: Request
): Promise<{ orgId: string; keyId: string }> {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || !apiKey.startsWith(KEY_PREFIX)) {
    throw Errors.unauthorized("Invalid API key");
  }

  const keyHash = sha256(apiKey);

  const [found] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1);

  if (!found) {
    throw Errors.unauthorized("Invalid API key");
  }

  if (found.expiresAt && found.expiresAt < new Date().toISOString()) {
    throw Errors.unauthorized("API key expired");
  }

  // Update last used timestamp (fire and forget)
  db.update(apiKeys)
    .set({ lastUsedAt: new Date().toISOString() })
    .where(eq(apiKeys.id, found.id))
    .execute()
    .catch(() => {});

  return { orgId: found.orgId, keyId: found.id };
}
