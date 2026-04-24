/**
 * Health Check Endpoints
 *
 * Kubernetes-ready health checks:
 * - /healthz: Liveness probe (is the app running?)
 * - /readyz: Readiness probe (can the app handle requests?)
 *
 * Both endpoints return JSON with status and detailed health information.
 */

import { getDatabase } from "../../db/factory";
import { getLogger } from "../../lib/logger";
import { isFirstRun } from "../../config/loader";

const logger = getLogger("health");

interface HealthStatus {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  checks?: Record<string, {
    status: "ok" | "error";
    message?: string;
    latency?: number;
  }>;
  uptime?: number;
}

const startTime = Date.now();

/**
 * GET /healthz — Liveness probe
 * 
 * Simple check that the app is running and able to respond.
 * Should return quickly without heavy operations.
 */
export async function getHealthz(): Promise<Response> {
  try {
    return Response.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
    } as HealthStatus);
  } catch (error) {
    logger.error("Health check failed", error instanceof Error ? error : new Error(String(error)));
    return Response.json({
      status: "error",
      timestamp: new Date().toISOString(),
    } as HealthStatus, { status: 500 });
  }
}

/**
 * GET /readyz — Readiness probe
 *
 * Comprehensive check that the app is ready to handle traffic.
 * Verifies database connectivity and required services.
 * May return 503 if the app is not yet ready.
 */
export async function getReadyz(): Promise<Response> {
  const checks: Record<string, { status: "ok" | "error"; message?: string; latency?: number }> = {};

  // Check if setup is required
  if (await isFirstRun()) {
    return Response.json({
      status: "degraded",
      timestamp: new Date().toISOString(),
      checks: {
        setup: {
          status: "error",
          message: "Setup wizard not completed",
        },
      },
    } as HealthStatus, { status: 503 });
  }

  // Check database connectivity
  try {
    const dbStart = performance.now();
    const { db } = await getDatabase();

    // Simple query to verify connection
    await (db.execute ? db.execute("SELECT 1") : (db.raw ? db.raw("SELECT 1") : Promise.resolve()));

    const dbLatency = performance.now() - dbStart;
    checks.database = {
      status: "ok",
      latency: Math.round(dbLatency),
    };
  } catch (error) {
    checks.database = {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  // Determine overall status
  const allHealthy = Object.values(checks).every(check => check.status === "ok");

  return Response.json({
    status: allHealthy ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    checks,
    uptime: Math.floor((Date.now() - startTime) / 1000),
  } as HealthStatus, {
    status: allHealthy ? 200 : 503,
  });
}

/**
 * POST /readyz — Kubernetes startup probe
 *
 * Extended readiness check for startup probes (which can have longer timeouts).
 * Waits for all services to be ready.
 */
export async function postReadyz(): Promise<Response> {
  const maxAttempts = 30; // 30 attempts
  const delayMs = 1000; // 1 second between attempts
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Check if first run is complete
      if (await isFirstRun()) {
        throw new Error("Setup wizard not completed");
      }

      // Try to connect to database
      const { db } = await getDatabase();
      await (db.execute ? db.execute("SELECT 1") : (db.raw ? db.raw("SELECT 1") : Promise.resolve()));

      // All checks passed
      return Response.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        checks: {
          setup: { status: "ok" },
          database: { status: "ok" },
        },
        ready: true,
      } as HealthStatus);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxAttempts - 1) {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  // All attempts exhausted
  return Response.json({
    status: "error",
    timestamp: new Date().toISOString(),
    checks: {
      database: {
        status: "error",
        message: lastError?.message || "Timeout waiting for readiness",
      },
    },
    ready: false,
  } as HealthStatus, { status: 503 });
}
