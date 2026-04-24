/**
 * SAR Job Queue Worker — processes governance tasks asynchronously via BullMQ.
 *
 * Heavy SAR operations (cycle monitoring, ledger audits) are enqueued
 * and processed here to avoid blocking API responses.
 */

import { Worker, Queue, type Job } from "bullmq";
import { executeSAR, SARTask, type SARInput } from "../sar/engine";
import { createProvider } from "../ai/factory";
import { loadConfig } from "../config/loader";
import { emitSARCompleted } from "../ws/events";

const QUEUE_NAME = "polis-sar";

let queue: Queue | null = null;
let worker: Worker | null = null;

interface SARJobData {
  task: string;
  orgId: string;
  refId?: string;
  sense: string;
  constitutionText?: string;
  proposals?: unknown[];
  members?: unknown[];
  financials?: unknown;
}

/**
 * Initialize the SAR job queue and worker.
 */
export async function initSARWorker(): Promise<void> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log("[sar-worker] No REDIS_URL — queue disabled (sync-only mode)");
    return;
  }

  const connection = parseRedisUrl(redisUrl);

  queue = new Queue(QUEUE_NAME, { connection });

  worker = new Worker(
    QUEUE_NAME,
    async (job: Job<SARJobData>) => {
      console.log(`[sar-worker] Processing job ${job.id}: ${job.data.task}`);

      const config = await loadConfig();
      const provider = createProvider(config.ai);

      const input: SARInput = {
        task: job.data.task as SARTask,
        orgId: job.data.orgId,
        refId: job.data.refId,
        sense: job.data.sense,
        context: {
          orgId: job.data.orgId,
          orgName: "",
          constitution: job.data.constitutionText ?? "",
        },
      };

      const result = await executeSAR(provider, input);

      // Update proposal with SAR analysis if this is a proposal-related task
      if (job.data.refId && result.analysis) {
        try {
          const { db } = await import("../db/connection");
          const { proposals } = await import("../db/schema");
          const { eq } = await import("drizzle-orm");

          await db
            .update(proposals)
            .set({
              aiAnalysis: {
                summary: result.analysis.summary,
                riskLevel: result.analysis.riskLevel,
                recommendation: result.analysis.recommendation,
                reasoning: result.analysis.reasoning,
                constitutionalConflicts: result.analysis.constitutionalConflicts,
                suggestedActions: result.analysis.suggestedActions,
                completedAt: new Date().toISOString(),
              },
              updatedAt: new Date().toISOString(),
            })
            .where(eq(proposals.id, job.data.refId));

          console.log(`[sar-worker] Updated proposal ${job.data.refId} with SAR analysis`);
        } catch (err) {
          console.error(`[sar-worker] Failed to update proposal with analysis:`, err);
        }
      }

      // Emit real-time event
      emitSARCompleted(job.data.orgId, {
        id: result.id,
        task: result.task,
        status: result.status,
      });

      return result;
    },
    {
      connection,
      concurrency: 3,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    }
  );

  worker.on("completed", (job) => {
    console.log(`[sar-worker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[sar-worker] Job ${job?.id} failed:`, err.message);
  });

  console.log("[sar-worker] Queue worker started");
}

/**
 * Enqueue a SAR job for async processing.
 */
export async function enqueueSAR(data: SARJobData, opts?: { priority?: number; delay?: number }): Promise<string | null> {
  if (!queue) {
    // No queue — fall back to sync execution
    console.warn("[sar-worker] Queue unavailable, run task synchronously");
    return null;
  }

  const job = await queue.add(data.task, data, {
    priority: opts?.priority ?? 0,
    delay: opts?.delay,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
  });

  return job.id ?? null;
}

/**
 * Execute SAR task synchronously (fallback when queue is unavailable).
 * Runs in the same request/process, returns immediately after completion.
 */
export async function executeSARSync(data: SARJobData): Promise<void> {
  try {
    const config = await loadConfig();
    const provider = createProvider(config.ai);

    const input: SARInput = {
      task: data.task as SARTask,
      orgId: data.orgId,
      refId: data.refId,
      sense: data.sense,
      context: {
        orgId: data.orgId,
        orgName: "",
        constitution: data.constitutionText ?? "",
      },
    };

    const result = await executeSAR(provider, input);

    // Update proposal with SAR analysis if this is a proposal-related task
    if (data.refId && result.analysis) {
      try {
        const { db } = await import("../db/connection");
        const { proposals } = await import("../db/schema");
        const { eq } = await import("drizzle-orm");

        await db
          .update(proposals)
          .set({
            aiAnalysis: {
              summary: result.analysis.summary,
              riskLevel: result.analysis.riskLevel,
              recommendation: result.analysis.recommendation,
              reasoning: result.analysis.reasoning,
              constitutionalConflicts: result.analysis.constitutionalConflicts,
              suggestedActions: result.analysis.suggestedActions,
              completedAt: new Date().toISOString(),
            },
            updatedAt: new Date().toISOString(),
          })
          .where(eq(proposals.id, data.refId));

        console.log(`[sar-worker] Updated proposal ${data.refId} with SAR analysis (sync)`);
      } catch (err) {
        console.error(`[sar-worker] Failed to update proposal with analysis:`, err);
      }
    }

    console.log(`[sar-worker] Sync execution completed: ${data.task} for ${data.refId}`);
  } catch (err) {
    console.error("[sar-worker] Sync execution failed:", err);
    // Don't rethrow — let the caller decide how to handle it
  }
}

/**
 * Get queue stats for monitoring.
 */
export async function getQueueStats() {
  if (!queue) return null;
  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
  ]);
  return { waiting, active, completed, failed };
}

/**
 * Graceful shutdown.
 */
export async function shutdownSARWorker(): Promise<void> {
  if (worker) await worker.close();
  if (queue) await queue.close();
}

/**
 * Parse Redis URL into BullMQ-compatible connection options.
 */
function parseRedisUrl(url: string): { host: string; port: number; password?: string } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    password: parsed.password || undefined,
  };
}
