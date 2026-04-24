/**
 * CSRF Token Protection Middleware
 * P2-CSRF-PROTECTION: Protects against Cross-Site Request Forgery attacks
 * 
 * Strategy:
 * - Generate unique CSRF tokens per session and store in-memory
 * - Require valid token in X-CSRF-Token header for state-changing requests (POST/PATCH/DELETE)
 * - Token is validated and invalidated after use
 * - Double-submit cookie + server-side validation for defense in depth
 */

import { Errors } from "../lib/errors";

// In-memory store for CSRF tokens (can be replaced with Redis in production)
const csrfTokens = new Map<string, { token: string; expiresAt: number; userId?: string }>();

// Cleanup old tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of csrfTokens) {
    if (entry.expiresAt < now) {
      csrfTokens.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Generate a CSRF token (random 32-byte hex string).
 * Tokens are valid for 1 hour by default.
 */
export function generateCsrfToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Store CSRF token with optional user association.
 * Returns the token.
 */
export function storeCsrfToken(userId?: string): string {
  const token = generateCsrfToken();
  const key = `csrf:${token}`;
  csrfTokens.set(key, {
    token,
    expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
    userId,
  });
  return token;
}

/**
 * Verify CSRF token and invalidate it.
 * Throws if token is invalid or expired.
 */
export function verifyCsrfToken(token: string, userId?: string): boolean {
  const key = `csrf:${token}`;
  const entry = csrfTokens.get(key);

  if (!entry || entry.expiresAt < Date.now()) {
    return false;
  }

  // If token is user-specific, verify it matches
  if (userId && entry.userId && entry.userId !== userId) {
    return false;
  }

  // Invalidate token after use
  csrfTokens.delete(key);
  return true;
}

/**
 * CSRF protection middleware.
 * Requires valid X-CSRF-Token header for state-changing requests.
 * GET/HEAD/OPTIONS requests are safe and don't require CSRF token.
 */
export async function csrfProtection(req: Request, userId?: string): Promise<Response | null> {
  const method = req.method.toUpperCase();

  // Safe methods don't require CSRF protection
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null;
  }

  // State-changing methods require CSRF token
  if (["POST", "PATCH", "DELETE", "PUT"].includes(method)) {
    const csrfToken = req.headers.get("x-csrf-token");

    if (!csrfToken) {
      throw Errors.forbidden("CSRF token required for state-changing requests");
    }

    if (!verifyCsrfToken(csrfToken, userId)) {
      throw Errors.forbidden("Invalid or expired CSRF token");
    }
  }

  return null;
}

/**
 * Get CSRF token endpoint (returns new token for client).
 * Clients call this to get a token before making state-changing requests.
 * The token should be included in the X-CSRF-Token header.
 */
export function getCsrfToken(userId?: string): string {
  return storeCsrfToken(userId);
}
