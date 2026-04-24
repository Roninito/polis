/**
 * Auth routes — login, register, refresh, logout
 */

import { db } from "../db/connection";
import { users, refreshTokens } from "../db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "./passwords";
import {
  createAccessToken,
  createRefreshToken,
  hashToken,
  verifyToken,
} from "./jwt";
import { Errors } from "../lib/errors";
import { createAccessTokenCookie, createRefreshTokenCookie, formatCookie, createClearCookie } from "./cookies";

/**
 * POST /auth/register
 * P2-HTTPONLY-COOKIES: Returns access token in httpOnly cookie, refresh token in secure httpOnly cookie
 */
export async function handleRegister(req: Request): Promise<Response> {
  const body = (await req.json()) as {
    email: string;
    password: string;
    name: string;
  };

  if (!body.email || !body.password || !body.name) {
    throw Errors.badRequest("email, password, and name are required");
  }

  // Check existing
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, body.email))
    .limit(1);

  if (existing) {
    throw Errors.conflict("Email already registered");
  }

  const passwordHash = await hashPassword(body.password);
  const [user] = await db
    .insert(users)
    .values({
      email: body.email,
      passwordHash,
      name: body.name,
    })
    .returning({ id: users.id, email: users.email, name: users.name, role: users.role });

  const accessToken = await createAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  const refreshToken = await createRefreshToken(user.id);
  const rtHash = await hashToken(refreshToken);

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: rtHash,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });

  // P2-HTTPONLY-COOKIES: Set access and refresh tokens in httpOnly cookies
  const accessTokenCookie = createAccessTokenCookie(accessToken);
  const refreshTokenCookie = createRefreshTokenCookie(refreshToken);
  
  const headers = new Headers({
    "Content-Type": "application/json",
    "Set-Cookie": [
      formatCookie(accessTokenCookie.name, accessTokenCookie.value, accessTokenCookie.options),
      formatCookie(refreshTokenCookie.name, refreshTokenCookie.value, refreshTokenCookie.options),
    ].join(", "),
  });

  return new Response(
    JSON.stringify({
      data: {
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        accessToken, // Still return in body for SPA use (will be ignored by browsers)
        refreshToken, // Still return in body for SPA use (will be ignored by browsers)
      },
    }),
    { status: 201, headers }
  );
}

/**
 * POST /auth/login
 * P2-HTTPONLY-COOKIES: Returns access token in httpOnly cookie, refresh token in secure httpOnly cookie
 */
export async function handleLogin(req: Request): Promise<Response> {
  const body = (await req.json()) as { email: string; password: string };

  if (!body.email || !body.password) {
    throw Errors.badRequest("email and password are required");
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, body.email))
    .limit(1);

  if (!user) {
    throw Errors.unauthorized("Invalid email or password");
  }

  const valid = await verifyPassword(body.password, user.passwordHash);
  if (!valid) {
    throw Errors.unauthorized("Invalid email or password");
  }

  // Update last login
  await db
    .update(users)
    .set({ lastLoginAt: new Date().toISOString() })
    .where(eq(users.id, user.id));

  const accessToken = await createAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  const refreshToken = await createRefreshToken(user.id);
  const rtHash = await hashToken(refreshToken);

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: rtHash,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });

  // P2-HTTPONLY-COOKIES: Set access and refresh tokens in httpOnly cookies
  const accessTokenCookie = createAccessTokenCookie(accessToken);
  const refreshTokenCookie = createRefreshTokenCookie(refreshToken);
  
  const headers = new Headers({
    "Content-Type": "application/json",
    "Set-Cookie": [
      formatCookie(accessTokenCookie.name, accessTokenCookie.value, accessTokenCookie.options),
      formatCookie(refreshTokenCookie.name, refreshTokenCookie.value, refreshTokenCookie.options),
    ].join(", "),
  });

  return new Response(
    JSON.stringify({
      data: {
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        accessToken, // Still return in body for SPA use (will be ignored by browsers)
        refreshToken, // Still return in body for SPA use (will be ignored by browsers)
      },
    }),
    { status: 200, headers }
  );
}

/**
 * POST /auth/refresh
 * Implements refresh token rotation: each refresh invalidates the old token and issues new one.
 * This prevents token theft attacks by ensuring stolen tokens become invalid after rotation.
 * P2-HTTPONLY-COOKIES: Returns new tokens in httpOnly cookies
 */
export async function handleRefresh(req: Request): Promise<Response> {
  const body = (await req.json()) as { refreshToken?: string };

  // Try to get refresh token from body (for API clients) or from cookies
  let refreshToken = body.refreshToken;
  
  if (!refreshToken) {
    // Try to extract from cookies if not in body
    const cookieHeader = req.headers.get("cookie");
    if (cookieHeader) {
      const cookies = cookieHeader.split(";").map((c) => c.trim());
      for (const cookie of cookies) {
        const [name, value] = cookie.split("=");
        if (name === "polis_refresh_token" && value) {
          refreshToken = decodeURIComponent(value);
          break;
        }
      }
    }
  }

  if (!refreshToken) {
    throw Errors.badRequest("refreshToken is required");
  }

  // Verify the JWT structure
  const payload = await verifyToken(refreshToken);
  const tokenHash = await hashToken(refreshToken);

  // Check if refresh token exists in DB
  const [stored] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .limit(1);

  if (!stored || stored.expiresAt < new Date().toISOString()) {
    throw Errors.unauthorized("Invalid or expired refresh token");
  }

  // Get user
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, payload.sub!))
    .limit(1);

  if (!user) {
    throw Errors.unauthorized("User not found");
  }

  // P2-JWT-ROTATION: Token rotation - delete old token atomically before issuing new one
  // This ensures old token is invalidated immediately, preventing token reuse
  await db
    .delete(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash));

  const newAccessToken = await createAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  const newRefreshToken = await createRefreshToken(user.id);
  const newRtHash = await hashToken(newRefreshToken);

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: newRtHash,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });

  // P2-HTTPONLY-COOKIES: Set new tokens in httpOnly cookies
  const accessTokenCookie = createAccessTokenCookie(newAccessToken);
  const refreshTokenCookie = createRefreshTokenCookie(newRefreshToken);
  
  const headers = new Headers({
    "Content-Type": "application/json",
    "Set-Cookie": [
      formatCookie(accessTokenCookie.name, accessTokenCookie.value, accessTokenCookie.options),
      formatCookie(refreshTokenCookie.name, refreshTokenCookie.value, refreshTokenCookie.options),
    ].join(", "),
  });

  return new Response(
    JSON.stringify({
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    }),
    { status: 200, headers }
  );
}

/**
 * POST /auth/logout
 * P2-HTTPONLY-COOKIES: Clears httpOnly cookies and invalidates refresh token
 */
export async function handleLogout(req: Request): Promise<Response> {
  const body = (await req.json()) as { refreshToken?: string };

  if (body.refreshToken) {
    const tokenHash = await hashToken(body.refreshToken);
    await db
      .delete(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash));
  }

  // P2-HTTPONLY-COOKIES: Clear httpOnly cookies
  const headers = new Headers({
    "Content-Type": "application/json",
    "Set-Cookie": [
      createClearCookie("polis_access_token"),
      createClearCookie("polis_refresh_token"),
    ].join(", "),
  });

  return new Response(
    JSON.stringify({ data: { message: "Logged out" } }),
    { status: 200, headers }
  );
}
