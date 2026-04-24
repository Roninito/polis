/**
 * Rate limiter middleware — sliding window counter using Redis or in-memory fallback.
 *
 * Limits are per-IP for unauthenticated routes, per-user for authenticated.
 */

import { Errors } from "../lib/errors";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory fallback (used when Redis is unavailable)
const memStore = new Map<string, RateLimitEntry>();

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memStore) {
    if (entry.resetAt <= now) memStore.delete(key);
  }
}, 60_000);

interface RateLimitConfig {
  windowMs: number;
  max: number;
}

const LIMITS: Record<string, RateLimitConfig> = {
  default: { windowMs: 60_000, max: 100 },
  auth: { windowMs: 60_000, max: 10 },
  setup: { windowMs: 60_000, max: 20 },
  ai: { windowMs: 60_000, max: 30 },
};

let redisClient: any = null;

/**
 * Initialize Redis-backed rate limiting.
 */
export async function initRateLimiter(): Promise<void> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log("[rate-limit] No REDIS_URL — using in-memory store");
    return;
  }

  try {
    const Redis = (await import("ioredis")).default;
    redisClient = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 3 });
    await redisClient.connect();
    console.log("[rate-limit] Redis-backed rate limiting active");
  } catch {
    console.warn("[rate-limit] Redis unavailable — falling back to in-memory");
    redisClient = null;
  }
}

/**
 * Resolve which rate limit tier applies to a request.
 */
function getTier(pathname: string): RateLimitConfig {
  if (pathname.startsWith("/api/v1/auth")) return LIMITS.auth;
  if (pathname.startsWith("/api/v1/setup")) return LIMITS.setup;
  if (pathname.includes("/sar")) return LIMITS.ai;
  return LIMITS.default;
}

/**
 * Get client identifier — IP address or user ID from auth header.
 */
function getClientKey(req: Request): string {
  // Prefer user ID from auth header
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    // Use a hash of the token as key (avoid storing full tokens)
    return `user:${simpleHash(auth)}`;
  }
  // Fall back to IP
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
  return `ip:${ip}`;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

/**
 * Check rate limit. Returns Response if limited, null if allowed.
 * Also sets rate limit headers on the eventual response.
 */
export async function checkRateLimit(req: Request): Promise<{ limited: boolean; headers: Record<string, string> }> {
  const url = new URL(req.url);
  const tier = getTier(url.pathname);
  const clientKey = getClientKey(req);
  const key = `rl:${clientKey}:${url.pathname.split("/").slice(0, 4).join("/")}`;

  let count: number;
  let resetAt: number;

  if (redisClient) {
    // Redis sliding window
    const now = Date.now();
    const windowStart = now - tier.windowMs;
    const multi = redisClient.multi();
    multi.zremrangebyscore(key, 0, windowStart);
    multi.zadd(key, now, `${now}:${Math.random()}`);
    multi.zcard(key);
    multi.pexpire(key, tier.windowMs);
    const results = await multi.exec();
    count = results?.[2]?.[1] ?? 0;
    resetAt = now + tier.windowMs;
  } else {
    // In-memory fallback
    const now = Date.now();
    const entry = memStore.get(key);
    if (!entry || entry.resetAt <= now) {
      memStore.set(key, { count: 1, resetAt: now + tier.windowMs });
      count = 1;
      resetAt = now + tier.windowMs;
    } else {
      entry.count++;
      count = entry.count;
      resetAt = entry.resetAt;
    }
  }

  const remaining = Math.max(0, tier.max - count);
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(tier.max),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
  };

  return { limited: count > tier.max, headers };
}

/**
 * Rate limit middleware — returns 429 Response if exceeded, null if ok.
 */
export async function rateLimit(req: Request): Promise<Response | null> {
  // Skip rate limiting for health checks
  const url = new URL(req.url);
  if (url.pathname === "/healthz" || url.pathname === "/readyz") return null;

  const { limited, headers } = await checkRateLimit(req);

  if (limited) {
    return new Response(
      JSON.stringify(Errors.rateLimited().toJSON()),
      {
        status: 429,
        headers: { "Content-Type": "application/json", ...headers, "Retry-After": "60" },
      }
    );
  }

  return null;
}
