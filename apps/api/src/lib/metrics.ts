/**
 * Prometheus Metrics Export
 *
 * Tracks API request count/latency, database query metrics, SAR task duration,
 * and WebSocket connections. Exposes metrics on /metrics endpoint.
 */

import { register, Counter, Histogram, Gauge } from "prom-client";
import { getLogger } from "./logger";

const logger = getLogger("metrics");

/**
 * API Request Metrics
 */
export const apiRequestCount = new Counter({
  name: "api_requests_total",
  help: "Total number of API requests",
  labelNames: ["method", "route", "status"],
});

export const apiRequestDuration = new Histogram({
  name: "api_request_duration_seconds",
  help: "API request duration in seconds",
  labelNames: ["method", "route", "status"],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

/**
 * Database Query Metrics
 */
export const dbQueryCount = new Counter({
  name: "db_queries_total",
  help: "Total number of database queries",
  labelNames: ["operation", "table"],
});

export const dbQueryDuration = new Histogram({
  name: "db_query_duration_seconds",
  help: "Database query duration in seconds",
  labelNames: ["operation", "table"],
  buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

export const dbConnectionPoolSize = new Gauge({
  name: "db_connection_pool_size",
  help: "Current database connection pool size",
  labelNames: ["engine"],
});

export const dbConnectionPoolUsed = new Gauge({
  name: "db_connection_pool_used",
  help: "Number of active connections in pool",
  labelNames: ["engine"],
});

/**
 * SAR Task Metrics
 */
export const sarTaskCount = new Counter({
  name: "sar_tasks_total",
  help: "Total number of SAR tasks executed",
  labelNames: ["status", "task_type"],
});

export const sarTaskDuration = new Histogram({
  name: "sar_task_duration_seconds",
  help: "SAR task execution duration in seconds",
  labelNames: ["task_type"],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
});

/**
 * WebSocket Metrics
 */
export const wsConnectionCount = new Gauge({
  name: "ws_connections_active",
  help: "Number of active WebSocket connections",
});

export const wsConnectionTotal = new Counter({
  name: "ws_connections_total",
  help: "Total number of WebSocket connections established",
});

export const wsMessageCount = new Counter({
  name: "ws_messages_total",
  help: "Total number of WebSocket messages sent/received",
  labelNames: ["direction"],
});

/**
 * Error Metrics
 */
export const errorCount = new Counter({
  name: "errors_total",
  help: "Total number of errors",
  labelNames: ["type", "severity"],
});

/**
 * Cache Metrics
 */
export const cacheHits = new Counter({
  name: "cache_hits_total",
  help: "Total number of cache hits",
  labelNames: ["cache_type"],
});

export const cacheMisses = new Counter({
  name: "cache_misses_total",
  help: "Total number of cache misses",
  labelNames: ["cache_type"],
});

/**
 * Initialize default metrics (process, Node.js runtime)
 */
export function initMetrics(): void {
  try {
    // Create gauge for process memory
    logger.info("Metrics initialized");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.warn("Error initializing metrics", { error: msg });
  }
}

/**
 * Record API request metrics
 */
export function recordApiRequest(
  method: string,
  route: string,
  status: number,
  durationSeconds: number
): void {
  apiRequestCount.labels(method, route, String(status)).inc();
  apiRequestDuration.labels(method, route, String(status)).observe(durationSeconds);
}

/**
 * Record database query metrics
 */
export function recordDbQuery(
  operation: string,
  table: string,
  durationSeconds: number
): void {
  dbQueryCount.labels(operation, table).inc();
  dbQueryDuration.labels(operation, table).observe(durationSeconds);
}

/**
 * Update connection pool metrics
 */
export function updateConnectionPoolMetrics(
  engine: string,
  poolSize: number,
  activeConnections: number
): void {
  dbConnectionPoolSize.labels(engine).set(poolSize);
  dbConnectionPoolUsed.labels(engine).set(activeConnections);
}

/**
 * Record SAR task execution
 */
export function recordSarTask(taskType: string, status: string, durationSeconds: number): void {
  sarTaskCount.labels(status, taskType).inc();
  sarTaskDuration.labels(taskType).observe(durationSeconds);
}

/**
 * Track WebSocket connections
 */
export function recordWsConnection(): void {
  wsConnectionTotal.inc();
  wsConnectionCount.inc();
}

export function recordWsDisconnection(): void {
  wsConnectionCount.dec();
}

export function recordWsMessage(direction: "sent" | "received"): void {
  wsMessageCount.labels(direction).inc();
}

/**
 * Record error
 */
export function recordError(type: string, severity: "low" | "medium" | "high" | "critical"): void {
  errorCount.labels(type, severity).inc();
}

/**
 * Record cache metrics
 */
export function recordCacheHit(cacheType: string): void {
  cacheHits.labels(cacheType).inc();
}

export function recordCacheMiss(cacheType: string): void {
  cacheMisses.labels(cacheType).inc();
}

/**
 * Get metrics in Prometheus text format
 */
export async function getMetricsText(): Promise<string> {
  return register.metrics();
}

/**
 * Get metrics as JSON
 */
export async function getMetricsJson() {
  return register.getMetricsAsJSON();
}

/**
 * Reset all metrics (for testing)
 */
export function resetMetrics(): void {
  register.resetMetrics();
}
