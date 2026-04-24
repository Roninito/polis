/**
 * Distributed Tracing with OpenTelemetry
 *
 * Adds trace IDs to all logs and tracks requests across API → DB → SAR → Email.
 * Provides correlation IDs for cross-service tracing.
 */

import { randomUUID } from "crypto";
import { getLogger } from "./logger";

const logger = getLogger("tracing");

interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  sampled?: boolean;
}

/**
 * Global trace context storage (in production, use AsyncLocalStorage for async context)
 */
class TraceContextManager {
  private contexts = new Map<string, TraceContext>();
  private currentContextKey = "__default__";

  /**
   * Generate a new trace context
   */
  static generateTraceContext(): TraceContext {
    return {
      traceId: randomUUID(),
      spanId: randomUUID(),
      sampled: Math.random() < 0.1, // 10% sampling rate
    };
  }

  /**
   * Start a new trace
   */
  startTrace(): TraceContext {
    const context = TraceContextManager.generateTraceContext();
    this.contexts.set(this.currentContextKey, context);
    return context;
  }

  /**
   * Get current trace context
   */
  getCurrentContext(): TraceContext | null {
    return this.contexts.get(this.currentContextKey) || null;
  }

  /**
   * Set current trace context
   */
  setCurrentContext(context: TraceContext): void {
    this.contexts.set(this.currentContextKey, context);
  }

  /**
   * Create a child span
   */
  createSpan(parentContext?: TraceContext): TraceContext {
    const parent = parentContext || this.getCurrentContext();
    if (!parent) {
      return this.startTrace();
    }

    return {
      traceId: parent.traceId,
      spanId: randomUUID(),
      parentSpanId: parent.spanId,
      sampled: parent.sampled,
    };
  }

  /**
   * Clear context
   */
  clearContext(): void {
    this.contexts.delete(this.currentContextKey);
  }

  /**
   * Export context for distributed tracing (W3C Trace Context)
   */
  exportTraceContext(context?: TraceContext): Record<string, string> {
    const ctx = context || this.getCurrentContext();
    if (!ctx) return {};

    return {
      "traceparent": `00-${ctx.traceId.replace(/-/g, "")}-${ctx.spanId.replace(/-/g, "")}-${ctx.sampled ? "01" : "00"}`,
      "x-trace-id": ctx.traceId,
      "x-span-id": ctx.spanId,
      ...(ctx.parentSpanId && { "x-parent-span-id": ctx.parentSpanId }),
    };
  }

  /**
   * Parse trace context from headers
   */
  parseTraceContext(headers: Record<string, string> | Headers): TraceContext | null {
    const traceparent = this.getHeader(headers, "traceparent");
    const traceId = this.getHeader(headers, "x-trace-id");
    const spanId = this.getHeader(headers, "x-span-id");
    const parentSpanId = this.getHeader(headers, "x-parent-span-id");

    if (traceparent) {
      const parts = traceparent.split("-");
      if (parts.length >= 3) {
        return {
          traceId: parts[1].match(/.{1,8}/g)?.join("-") || traceId || randomUUID(),
          spanId: parts[2].match(/.{1,8}/g)?.join("-") || spanId || randomUUID(),
          parentSpanId,
          sampled: parts[3] === "01",
        };
      }
    }

    if (traceId && spanId) {
      return {
        traceId,
        spanId,
        parentSpanId,
      };
    }

    return null;
  }

  /**
   * Helper to get header value (works with Headers or plain object)
   */
  private getHeader(headers: Record<string, string> | Headers, name: string): string | undefined {
    if (headers instanceof Headers) {
      return headers.get(name) || undefined;
    }
    return headers[name] || headers[name.toLowerCase()];
  }
}

export const traceContextManager = new TraceContextManager();

/**
 * Initialize distributed tracing for a request
 */
export function initializeTracing(headers?: Record<string, string> | Headers): TraceContext {
  let context = null;

  if (headers) {
    context = traceContextManager.parseTraceContext(headers);
  }

  if (!context) {
    context = TraceContextManager.generateTraceContext();
  }

  traceContextManager.setCurrentContext(context);
  logger.setContext({
    traceId: context.traceId,
    spanId: context.spanId,
  });

  return context;
}

/**
 * Get current trace context
 */
export function getCurrentTraceContext(): TraceContext | null {
  return traceContextManager.getCurrentContext();
}

/**
 * Create a child span (for sub-operations)
 */
export function createSpan(operation: string, parentContext?: TraceContext): SpanHandle {
  const childContext = traceContextManager.createSpan(parentContext);
  const startTime = performance.now();

  return {
    context: childContext,
    end: (attributes?: Record<string, any>) => {
      const duration = (performance.now() - startTime) / 1000;
      logger.debug(`Span completed: ${operation}`, {
        duration,
        spanId: childContext.spanId,
        traceId: childContext.traceId,
        ...attributes,
      });
    },
  };
}

interface SpanHandle {
  context: TraceContext;
  end: (attributes?: Record<string, any>) => void;
}

/**
 * Middleware to initialize tracing for incoming requests
 */
export function tracingMiddleware(req: Request): TraceContext {
  const headers = Object.fromEntries(req.headers.entries());
  const context = initializeTracing(headers);

  logger.info("Request started", {
    method: req.method,
    path: new URL(req.url).pathname,
    traceId: context.traceId,
  });

  return context;
}

/**
 * Export trace context as HTTP headers (for outgoing requests)
 */
export function getTraceHeaders(): Record<string, string> {
  return traceContextManager.exportTraceContext();
}

/**
 * Log with trace context automatically included
 */
export function logWithTrace(message: string, level: "debug" | "info" | "warn" | "error" = "info", data?: Record<string, any>): void {
  const context = getCurrentTraceContext();
  const logData = {
    ...data,
    ...(context && {
      traceId: context.traceId,
      spanId: context.spanId,
    }),
  };

  logger.log(level, message, logData);
}

/**
 * Wrap async function with tracing
 */
export async function withTracing<T>(
  operation: string,
  fn: (span: SpanHandle) => Promise<T>
): Promise<T> {
  const span = createSpan(operation);
  try {
    return await fn(span);
  } finally {
    span.end();
  }
}

/**
 * Get trace ID from current context
 */
export function getTraceId(): string | null {
  return traceContextManager.getCurrentContext()?.traceId || null;
}

/**
 * Get span ID from current context
 */
export function getSpanId(): string | null {
  return traceContextManager.getCurrentContext()?.spanId || null;
}

/**
 * Reset tracing context (when request completes)
 */
export function resetTracing(): void {
  traceContextManager.clearContext();
  logger.clearContext();
}
