/**
 * JWT authentication — access tokens (15min) + refresh tokens (30 days).
 * Uses jose library for JWT operations.
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.POLIS_SESSION_SECRET ?? "dev-secret-change-me"
);

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "30d";
const ISSUER = "polis";

export interface TokenPayload extends JWTPayload {
  sub: string;      // user ID
  email: string;
  role: string;     // superadmin | user
  orgId?: string;   // current org context
  orgRole?: string; // role within org
}

/**
 * Create a signed JWT access token.
 */
export async function createAccessToken(payload: {
  userId: string;
  email: string;
  role: string;
  orgId?: string;
  orgRole?: string;
}): Promise<string> {
  return new SignJWT({
    email: payload.email,
    role: payload.role,
    orgId: payload.orgId,
    orgRole: payload.orgRole,
  } satisfies Partial<TokenPayload>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setSubject(payload.userId)
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

/**
 * Create a refresh token (longer-lived, stored hashed in DB).
 */
export async function createRefreshToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setSubject(userId)
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

/**
 * Verify and decode a JWT. Throws on invalid/expired tokens.
 */
export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, JWT_SECRET, {
    issuer: ISSUER,
  });
  return payload as TokenPayload;
}

/**
 * Hash a token for storage (refresh tokens stored hashed).
 */
export async function hashToken(token: string): Promise<string> {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(token).digest("hex");
}
