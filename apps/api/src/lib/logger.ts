/**
 * Structured Logging with Pino
 *
 * Provides hierarchical, structured logging with context fields.
 * Outputs JSON for aggregation and includes request IDs, user/org IDs.
 */

import pino from "pino";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  userId?: string;
  orgId?: string;
  requestId?: string;
  [key: string]: any;
}

class Logger {
  private pino: pino.Logger;
  private context: LogContext = {};

  constructor(name: string = "polis") {
    const isDevelopment = process.env.NODE_ENV !== "production";

    this.pino = pino({
      name,
      level: process.env.LOG_LEVEL || "info",
      transport: isDevelopment
        ? {
            target: "pino-pretty",
            options: {
              colorize: true,
              singleLine: false,
              translateTime: "SYS:standard",
              ignore: "pid,hostname",
            },
          }
        : undefined,
    });
  }

  /**
   * Set context that will be included in all subsequent log messages
   */
  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Get current context
   */
  getContext(): LogContext {
    return { ...this.context };
  }

  /**
   * Clear context
   */
  clearContext(): void {
    this.context = {};
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger {
    const child = new Logger();
    child.context = { ...this.context, ...context };
    child.pino = this.pino.child({ ...this.context, ...context });
    return child;
  }

  /**
   * Log at debug level
   */
  debug(message: string, data?: Record<string, any>): void {
    this.pino.debug({ ...this.context, ...data }, message);
  }

  /**
   * Log at info level
   */
  info(message: string, data?: Record<string, any>): void {
    this.pino.info({ ...this.context, ...data }, message);
  }

  /**
   * Log at warn level
   */
  warn(message: string, data?: Record<string, any>): void {
    this.pino.warn({ ...this.context, ...data }, message);
  }

  /**
   * Log at error level
   */
  error(message: string, error?: Error | Record<string, any>, data?: Record<string, any>): void {
    if (error instanceof Error) {
      this.pino.error(
        { ...this.context, ...data, err: error },
        message
      );
    } else {
      this.pino.error({ ...this.context, ...error, ...data }, message);
    }
  }

  /**
   * Log with custom fields
   */
  log(level: LogLevel, message: string, data?: Record<string, any>): void {
    switch (level) {
      case "debug":
        this.debug(message, data);
        break;
      case "info":
        this.info(message, data);
        break;
      case "warn":
        this.warn(message, data);
        break;
      case "error":
        this.error(message, data);
        break;
    }
  }
}

// Global logger instance
let globalLogger: Logger | null = null;

/**
 * Get or create the global logger instance
 */
export function getLogger(name: string = "polis"): Logger {
  if (!globalLogger) {
    globalLogger = new Logger(name);
  }
  return globalLogger;
}

/**
 * Create a new logger instance (for child loggers with specific context)
 */
export function createLogger(name: string): Logger {
  return new Logger(name);
}

/**
 * Export the Logger class for TypeScript type safety
 */
export { Logger, LogContext, LogLevel };
