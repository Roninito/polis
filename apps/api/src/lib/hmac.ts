/**
 * HMAC utilities — used for ledger transaction signing.
 */

const HMAC_SECRET = process.env.POLIS_SESSION_SECRET ?? "dev-secret-change-me";

/**
 * Sign a string payload with HMAC-SHA256.
 */
export async function hmacSign(payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(HMAC_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload)
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verify an HMAC-SHA256 signature.
 */
export async function hmacVerify(
  payload: string,
  signature: string
): Promise<boolean> {
  const expected = await hmacSign(payload);
  return expected === signature;
}
