/**
 * TOTP 2FA stub — schema already has totpSecret/totpEnabled fields.
 * These endpoints allow enabling and verifying TOTP for user accounts.
 *
 * In v1.0 this is a structural stub — actual TOTP verification is deferred.
 */

import { ok } from "../lib/response";
import { Errors } from "../lib/errors";

/**
 * POST /auth/2fa/setup — Generate TOTP secret and QR URL
 */
export async function setup2fa(_req: Request): Promise<Response> {
  // Generate a stub secret — real implementation would use a TOTP library
  const secret = generateBase32Secret(20);
  const issuer = "POLIS";
  const account = "user@polis.app";

  const otpauthUrl = `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&digits=6&period=30`;

  return ok({
    secret,
    otpauthUrl,
    message: "Scan the QR code with your authenticator app, then verify with a code.",
  });
}

/**
 * POST /auth/2fa/verify — Verify a TOTP code to enable 2FA
 */
export async function verify2fa(req: Request): Promise<Response> {
  const body = (await req.json()) as { code?: string };
  if (!body.code || body.code.length !== 6) {
    throw Errors.validation("A 6-digit code is required");
  }

  // Stub: in production, verify against stored TOTP secret
  // For now, accept any 6-digit code for testing
  return ok({
    enabled: true,
    backupCodes: Array.from({ length: 8 }, () => generateBackupCode()),
    message: "2FA has been enabled. Save your backup codes securely.",
  });
}

/**
 * POST /auth/2fa/disable — Disable 2FA for the current user
 */
export async function disable2fa(req: Request): Promise<Response> {
  const body = (await req.json()) as { code?: string; backupCode?: string };
  if (!body.code && !body.backupCode) {
    throw Errors.validation("Provide a TOTP code or backup code to disable 2FA");
  }

  return ok({
    enabled: false,
    message: "2FA has been disabled.",
  });
}

function generateBase32Secret(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let result = "";
  const values = crypto.getRandomValues(new Uint8Array(length));
  for (const v of values) {
    result += chars[v % chars.length];
  }
  return result;
}

function generateBackupCode(): string {
  const values = crypto.getRandomValues(new Uint8Array(5));
  return Array.from(values, (v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}
