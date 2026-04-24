/**
 * POLIS API Handler — importable request handler.
 *
 * Extracted from index.ts so it can be used by SvelteKit hooks
 * (single-server mode) or standalone Bun.serve.
 */

import { loadConfig, isFirstRun } from "./config/loader";
import { features } from "./config/features";
import { Router } from "./api/router";
import { cors, handlePreflight } from "./middleware/cors";
import { rateLimit, initRateLimiter } from "./middleware/rate-limit";
import { csrfProtection } from "./middleware/csrf";
import { initRedisPubSub } from "./ws/redis-pubsub";
import { initSARWorker } from "./queue/sar-worker";
import { initDb } from "./db/connection";
import { initializeEmailService } from "./email/provider";
import { verifyToken } from "./auth/jwt";
import { extractCookie } from "./auth/cookies";

// Observability
import { getLogger } from "./lib/logger";
import { initSentry, captureException } from "./lib/sentry";
import { initMetrics, recordApiRequest, getMetricsText } from "./lib/metrics";
import { initializeTracing, tracingMiddleware, resetTracing, getTraceId } from "./lib/tracing";

// Auth routes
import { handleLogin, handleRegister, handleRefresh, handleLogout } from "./auth/routes";
import { setup2fa, verify2fa, disable2fa } from "./auth/totp";

// API routes
import { getOrg, updateOrg, getOrgStats, listMyOrgs } from "./api/orgs/routes";
import { listMembers, addMember, getMember, updateMember, removeMember } from "./api/members/routes";
import {
  listProposals, createProposal, getProposal, updateProposal,
  castVote, getVotes,
} from "./api/proposals/routes";
import { getTreasury, getLedger, recordTransaction } from "./api/treasury/routes";
import { listSarLog, getSarEntry } from "./api/sar/routes";
import { testDb, testAi, completeSetup, detectDb, createDb } from "./api/setup/routes";
import { getConstitution, listLaws, createLaw } from "./api/constitution/routes";
import { getCsrfToken } from "./middleware/csrf";

const logger = getLogger("api");
let initialized = false;
let firstRun = true;
let router: Router;

// Handler for getting CSRF token
async function handleGetCsrfToken(): Promise<Response> {
  const token = getCsrfToken();
  return Response.json(
    { data: { token } },
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

function buildRouter(): Router {
  const r = new Router();

  // P2-CSRF-PROTECTION: CSRF token endpoint
  r.get("/csrf/token", handleGetCsrfToken);

  // Auth
  r.post("/auth/login", handleLogin);
  r.post("/auth/register", handleRegister);
  r.post("/auth/refresh", handleRefresh);
  r.post("/auth/logout", handleLogout);
  r.post("/auth/2fa/setup", setup2fa);
  r.post("/auth/2fa/verify", verify2fa);
  r.post("/auth/2fa/disable", disable2fa);

  // Organizations
  r.get("/me/orgs", listMyOrgs);
  r.get("/orgs/:id", getOrg);
  r.patch("/orgs/:id", updateOrg);
  r.get("/orgs/:id/stats", getOrgStats);

  // Members
  r.get("/orgs/:id/members", listMembers);
  r.post("/orgs/:id/members", addMember);
  r.get("/orgs/:id/members/:mid", getMember);
  r.patch("/orgs/:id/members/:mid", updateMember);
  r.delete("/orgs/:id/members/:mid", removeMember);

  // Proposals & Voting
  r.get("/orgs/:id/proposals", listProposals);
  r.post("/orgs/:id/proposals", createProposal);
  r.get("/orgs/:id/proposals/:pid", getProposal);
  r.patch("/orgs/:id/proposals/:pid", updateProposal);
  r.post("/orgs/:id/proposals/:pid/vote", castVote);
  r.get("/orgs/:id/proposals/:pid/votes", getVotes);

  // Constitution & Laws
  r.get("/orgs/:id/constitution", getConstitution);
  r.get("/orgs/:id/laws", listLaws);
  r.post("/orgs/:id/laws", createLaw);

  // Treasury & Ledger
  r.get("/orgs/:id/treasury", getTreasury);
  r.get("/orgs/:id/ledger", getLedger);
  r.post("/orgs/:id/ledger", recordTransaction);

  // SAR Log
  r.get("/orgs/:id/sar", listSarLog);
  r.get("/orgs/:id/sar/:sid", getSarEntry);

  // Setup wizard
  r.post("/setup/detect-db", detectDb);
  r.post("/setup/create-db", createDb);
  r.post("/setup/test-db", testDb);
  r.post("/setup/test-ai", testAi);
  r.post("/setup/complete", completeSetup);

  return r;
}

/**
 * Initialize API services (call once at startup).
 */
export async function initApi(): Promise<void> {
  if (initialized) return;

  router = buildRouter();
  firstRun = await isFirstRun();

  // Initialize observability
  initMetrics();
  initSentry({
    environment: process.env.NODE_ENV || "development",
  });
  initializeTracing();

  await initRateLimiter();
  await initRedisPubSub();

  if (firstRun) {
    logger.info("First run detected — serving setup wizard");
  } else {
    const config = await loadConfig();
    logger.info(`Mode: ${config.deploymentMode}`);
    logger.info(`DB engine: ${config.db.engine}`);
    logger.info(`AI provider: ${config.ai.provider}`);

    // Initialize database connection
    await initDb();

    // Initialize email service
    if (config.email) {
      initializeEmailService({
        provider: config.email.provider,
        from: config.email.from,
        apiKey: config.email.apiKey,
      });
      logger.info(`Email provider: ${config.email.provider}`);
    } else {
      logger.info("Email service not configured");
    }

    if (features(config).multiTenant) {
      logger.info("Multi-tenant mode — platform features enabled");
    } else {
      logger.info("Standalone mode");
    }

    await initSARWorker();
  }

  initialized = true;
}

/**
 * Handle an API request. Returns a Response for API paths, or null for non-API paths.
 */
export async function handleApiRequest(req: Request): Promise<Response | null> {
  if (!initialized) await initApi();

  const url = new URL(req.url);
  const startTime = performance.now();

  // Initialize tracing for this request
  const traceId = getTraceId();
  if (!traceId) {
    tracingMiddleware(req);
  }

  try {
    // CORS preflight
    const preflight = handlePreflight(req);
    if (preflight) return preflight;

    // Metrics endpoint
    if (url.pathname === "/metrics") {
      const metricsText = await getMetricsText();
      return new Response(metricsText, {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // Health checks
    if (url.pathname === "/healthz") {
      return Response.json({ status: "ok", timestamp: new Date().toISOString() });
    }
    if (url.pathname === "/readyz") {
      const dbReady = !firstRun; // DB is ready when not in first-run mode
      return Response.json({
        status: dbReady ? "ready" : "not_ready",
        checks: { database: dbReady },
      });
    }

    // Only handle API routes, health checks, and WebSocket
    if (!url.pathname.startsWith("/api/") && url.pathname !== "/ws") {
      return null;
    }

    // Rate limiting
    const rateLimited = await rateLimit(req);
    if (rateLimited) return rateLimited;

    // First-run → only allow setup endpoints
    if (firstRun && url.pathname.startsWith("/api/v1") && !url.pathname.startsWith("/api/v1/setup")) {
      return cors(req, Response.json(
        { error: { code: "SETUP_REQUIRED", message: "Run the setup wizard at /setup" } },
        { status: 503 }
      ));
    }

    // P2-CSRF-PROTECTION: Extract user ID for CSRF token validation if authenticated
    let userId: string | undefined;
    try {
      // Try to get token from Authorization header
      const authHeader = req.headers.get("authorization");
      let token: string | null = null;
      
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.slice(7);
      } else {
        // Try to get from httpOnly cookie
        const cookieHeader = req.headers.get("cookie");
        token = extractCookie(cookieHeader, "polis_access_token");
      }

      if (token) {
        const payload = await verifyToken(token);
        userId = payload.sub;
      }
    } catch {
      // Token verification failed, proceed without user context
    }

    // P2-CSRF-PROTECTION: Apply CSRF protection to state-changing requests
    const csrfError = await csrfProtection(req, userId);
    if (csrfError) return cors(req, csrfError);

    // Route through API router
    const response = await router.handle(req);
    if (response) {
      const duration = (performance.now() - startTime) / 1000;
      const status = response.status;

      // Record metrics
      const route = url.pathname.replace(/\/[a-f0-9\-]+/g, "/:id"); // Normalize UUIDs
      recordApiRequest(req.method, route, status, duration);

      // Log request
      logger.info("Request completed", {
        method: req.method,
        path: url.pathname,
        status,
        duration,
        userId,
      });

      return cors(req, response);
    }

    const duration = (performance.now() - startTime) / 1000;
    recordApiRequest(req.method, url.pathname, 404, duration);

    return cors(req, Response.json(
      { error: { code: "NOT_FOUND", message: "Not found" } },
      { status: 404 }
    ));
  } catch (error) {
    const duration = (performance.now() - startTime) / 1000;
    const route = url.pathname.replace(/\/[a-f0-9\-]+/g, "/:id");
    recordApiRequest(req.method, route, 500, duration);

    captureException(error, {
      method: req.method,
      path: url.pathname,
      url: url.toString(),
    });

    logger.error("Unhandled request error", error instanceof Error ? error : new Error(String(error)), {
      method: req.method,
      path: url.pathname,
      duration,
    });

    return cors(req, Response.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    ));
  } finally {
    resetTracing();
  }
}

export { firstRun as isSetupMode };

/**
 * Re-initialize after setup completes (no restart needed).
 */
export async function reinitAfterSetup(): Promise<void> {
  firstRun = false;
  try {
    await initDb();
    await initSARWorker();
    const config = await loadConfig();
    if (config.email) {
      initializeEmailService({
        provider: config.email.provider,
        from: config.email.from,
        apiKey: config.email.apiKey,
      });
      logger.info(`Email provider initialized: ${config.email.provider}`);
    }
    logger.info(`Setup complete — DB engine: ${config.db.engine}, AI: ${config.ai.provider}`);
  } catch (e: any) {
    logger.error("Post-setup init error", e instanceof Error ? e : new Error(String(e)), {
      message: e.message,
    });
  }
}
