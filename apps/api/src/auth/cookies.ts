/**
 * Cookie utilities for secure token management.
 * P2-HTTPONLY-COOKIES: Access tokens stored in httpOnly cookies to prevent XSS attacks.
 * Reduces attack surface compared to localStorage-based tokens.
 */

export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
  maxAge?: number;
  path?: string;
}

const PROD = process.env.NODE_ENV === "production";

/**
 * Set-Cookie header for access token (httpOnly, short-lived).
 * httpOnly prevents JavaScript from accessing the token (XSS protection).
 * Secure ensures HTTPS only in production.
 * SameSite=Lax prevents CSRF for navigation but allows forms.
 */
export function createAccessTokenCookie(token: string): { name: string; value: string; options: CookieOptions } {
  return {
    name: "polis_access_token",
    value: token,
    options: {
      httpOnly: true,
      secure: PROD,
      sameSite: "Lax",
      maxAge: 15 * 60, // 15 minutes
      path: "/",
    },
  };
}

/**
 * Set-Cookie header for refresh token (httpOnly, long-lived).
 * Used only for token refresh, not authentication.
 */
export function createRefreshTokenCookie(token: string): { name: string; value: string; options: CookieOptions } {
  return {
    name: "polis_refresh_token",
    value: token,
    options: {
      httpOnly: true,
      secure: PROD,
      sameSite: "Lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    },
  };
}

/**
 * Format cookie string for Set-Cookie header.
 */
export function formatCookie(name: string, value: string, options: CookieOptions): string {
  let cookie = `${name}=${encodeURIComponent(value)}`;

  if (options.path) cookie += `; Path=${options.path}`;
  if (options.maxAge !== undefined) cookie += `; Max-Age=${options.maxAge}`;
  if (options.httpOnly) cookie += "; HttpOnly";
  if (options.secure) cookie += "; Secure";
  if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;

  return cookie;
}

/**
 * Clear a cookie by setting Max-Age=0.
 */
export function createClearCookie(name: string): string {
  return `${name}=; Path=/; Max-Age=0; HttpOnly`;
}

/**
 * Extract token from Authorization header (for backward compatibility with Bearer tokens).
 * This is used in middleware to read tokens from either cookies or headers.
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

/**
 * Extract cookie value from Cookie header.
 * Returns null if cookie not found.
 */
export function extractCookie(cookieHeader: string | null, cookieName: string): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const [name, value] = cookie.split("=");
    if (name === cookieName && value) {
      return decodeURIComponent(value);
    }
  }
  return null;
}
