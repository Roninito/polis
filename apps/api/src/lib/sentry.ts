/**
 * Sentry Error Tracking Integration
 *
 * Captures unhandled exceptions, tracks error trends, and alerts on critical errors.
 * Integrates with the logging system for comprehensive error observability.
 */

import * as Sentry from "@sentry/node";
import { getLogger } from "./logger";

const logger = getLogger("sentry");

interface SentryConfig {
  dsn?: string;
  environment?: string;
  release?: string;
  tracesSampleRate?: number;
  debug?: boolean;
}

let initialized = false;

/**
 * Initialize Sentry error tracking
 */
export function initSentry(config: SentryConfig = {}): void {
  if (initialized) {
    logger.debug("Sentry already initialized");
    return;
  }

  const dsn = config.dsn || process.env.SENTRY_DSN;
  const environment = config.environment || process.env.NODE_ENV || "development";
  const release = config.release || process.env.APP_VERSION || "0.1.0";
  const tracesSampleRate = config.tracesSampleRate ?? 0.1;
  const debug = config.debug ?? false;

  if (!dsn) {
    logger.info("Sentry DSN not configured, error tracking disabled");
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment,
      release,
      tracesSampleRate,
      debug,
      beforeSend(event) {
        // Filter out sensitive data
        if (event.request?.headers?.authorization) {
          delete event.request.headers.authorization;
        }
        if (event.request?.cookies) {
          delete event.request.cookies;
        }
        return event;
      },
    });

    initialized = true;
    logger.info("Sentry initialized", { dsn, environment, release });
  } catch (error) {
    logger.error("Failed to initialize Sentry", error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Capture an exception
 */
export function captureException(error: Error | unknown, context?: Record<string, any>): void {
  if (context) {
    Sentry.setContext("error_context", context);
  }
  Sentry.captureException(error);
  logger.error("Exception captured by Sentry", error instanceof Error ? error : new Error(String(error)), context);
}

/**
 * Capture a message
 */
export function captureMessage(message: string, level: "fatal" | "error" | "warning" | "info" | "debug" = "error"): void {
  Sentry.captureMessage(message, level);
  logger.log(level === "fatal" ? "error" : (level as any), message);
}

/**
 * Set user context for error tracking
 */
export function setSentryUser(userId: string, email?: string, username?: string): void {
  Sentry.setUser({
    id: userId,
    email,
    username,
  });
}

/**
 * Clear user context
 */
export function clearSentryUser(): void {
  Sentry.setUser(null);
}

/**
 * Set custom context
 */
export function setSentryContext(name: string, context: Record<string, any>): void {
  Sentry.setContext(name, context);
}

/**
 * Middleware for Express/Fastify-like frameworks
 */
export function sentryRequestHandler() {
  return (req: Request): void => {
    if (!initialized) return;

    Sentry.setContext("http", {
      method: req.method,
      url: new URL(req.url).pathname,
      headers: Object.fromEntries(
        Array.from(req.headers.entries()).filter(
          ([key]) => !["authorization", "cookie"].includes(key.toLowerCase())
        )
      ),
    });
  };
}

/**
 * Error handler middleware
 */
export function sentryErrorHandler(error: Error, context?: Record<string, any>): void {
  if (!initialized) return;

  captureException(error, context);
}

/**
 * Get Sentry instance for advanced usage
 */
export function getSentryInstance() {
  return Sentry;
}

/**
 * Check if Sentry is initialized
 */
export function isSentryInitialized(): boolean {
  return initialized;
}
