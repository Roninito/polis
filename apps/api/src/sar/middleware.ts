/**
 * SAR Governance Middleware — bridges the @polis/sar middleware stack
 * with the POLIS governance engine.
 *
 * Uses the Koa-style middleware pattern from @polis/sar:
 *   - Each middleware receives (ctx, next) and can modify ctx before/after
 *   - Middleware stack executes in order, with next() passing to the next layer
 */

import type { AIProvider, SARContext, SARAnalysis } from "../ai/provider.interface";
import { sanitizeUserContent } from "../sar/constraints";

interface GovernanceContext {
  task: string;
  orgId: string;
  input: string;
  contextData: SARContext;
  sanitized?: boolean;
  blocked?: boolean;
  violations?: string[];
  startTime?: number;
  elapsedMs?: number;
  costCents?: number;
  modelUsed?: string;
  tokensUsed?: number;
}

/**
 * Constitutional Guard Middleware
 * Runs constraint validation before AI analysis proceeds.
 */
export function constitutionalGuard(): (ctx: GovernanceContext, next: () => Promise<void>) => Promise<void> {
  return async (ctx, next) => {
    // Check for prompt injection patterns
    const sanitized = sanitizeUserContent(ctx.input);
    if (sanitized !== ctx.input) {
      ctx.input = sanitized;
      ctx.sanitized = true;
    }

    // Run structural constraints
    const violations: string[] = [];

    // Check if input attempts to override governance rules
    const overridePatterns = [
      /override\s+(constitution|constraint|rule)/gi,
      /bypass\s+(vote|approval|quorum)/gi,
      /skip\s+(review|audit|check)/gi,
    ];

    for (const pattern of overridePatterns) {
      if (pattern.test(ctx.input)) {
        violations.push(`Blocked pattern: ${pattern.source}`);
      }
    }

    if (violations.length > 0) {
      ctx.blocked = true;
      ctx.violations = violations;
      return; // Don't call next — block the chain
    }

    await next();
  };
}

/**
 * Audit Logger Middleware
 * Tracks timing of SAR passes for the audit trail.
 */
export function auditLogger(): (ctx: GovernanceContext, next: () => Promise<void>) => Promise<void> {
  return async (ctx, next) => {
    ctx.startTime = Date.now();
    await next();
    ctx.elapsedMs = Date.now() - (ctx.startTime ?? Date.now());
  };
}

/**
 * Cost Tracker Middleware
 * Estimates and records token usage and cost for billing.
 */
export function costTracker(): (ctx: GovernanceContext, next: () => Promise<void>) => Promise<void> {
  return async (ctx, next) => {
    await next();

    const model = ctx.modelUsed ?? "unknown";
    const tokensUsed = ctx.tokensUsed ?? 0;

    // Cost per 1K tokens in cents
    const costPer1K: Record<string, number> = {
      "claude-sonnet-4-20250514": 0.3,
      "claude-3-haiku-20240307": 0.025,
      "gpt-4o": 0.25,
      "gpt-4o-mini": 0.015,
    };

    const rate = costPer1K[model] ?? 0.1;
    ctx.costCents = Math.ceil((tokensUsed / 1000) * rate * 100) / 100;
  };
}

/**
 * Prompt Sanitizer Middleware
 * Strips potential prompt injection patterns (Constraint 5).
 */
export function promptSanitizer(): (ctx: GovernanceContext, next: () => Promise<void>) => Promise<void> {
  return async (ctx, next) => {
    ctx.input = sanitizeUserContent(ctx.input);
    ctx.sanitized = true;
    await next();
  };
}

/**
 * Execute a full governance SAR pass using the middleware stack.
 */
export async function executeGovernanceSAR(
  provider: AIProvider,
  task: string,
  orgId: string,
  input: string,
  context: SARContext,
): Promise<{
  analysis: SARAnalysis | null;
  blocked: boolean;
  violations: string[];
  elapsedMs: number;
  costCents: number;
}> {
  const ctx: GovernanceContext = {
    task,
    orgId,
    input,
    contextData: context,
  };

  // Build middleware pipeline
  const middlewares = [
    promptSanitizer(),
    constitutionalGuard(),
    auditLogger(),
    costTracker(),
  ];

  // Execute middleware stack manually (Koa-style compose)
  async function compose(index: number): Promise<void> {
    if (index >= middlewares.length) return;
    await middlewares[index](ctx, () => compose(index + 1));
  }

  await compose(0);

  if (ctx.blocked) {
    return {
      analysis: null,
      blocked: true,
      violations: ctx.violations ?? [],
      elapsedMs: ctx.elapsedMs ?? 0,
      costCents: ctx.costCents ?? 0,
    };
  }

  // Run actual AI analysis through provider
  const analysis = await provider.analyze(ctx.input, context);

  return {
    analysis,
    blocked: false,
    violations: [],
    elapsedMs: ctx.elapsedMs ?? 0,
    costCents: ctx.costCents ?? 0,
  };
}
