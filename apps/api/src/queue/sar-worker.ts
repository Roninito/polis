/**
 * SAR Job Queue Worker — processes governance tasks asynchronously via BullMQ.
 *
 * Heavy SAR operations (cycle monitoring, ledger audits) are enqueued
 * and processed here to avoid blocking API responses.
 *
 * Architecture: SAR Chain Behavior Tree
 * Each job is executed as a behavior tree:
 *
 *   Sense → Analyze (parallel: constitutional + financial + risk) → Respond
 *
 * Follows the SAR Chain pattern from sar-engine and mngr projects.
 */

import { Worker, Queue, type Job } from "bullmq";
import { SARTask } from "../sar/engine";
import {
  GovernanceBTCompositor,
  GovernanceAnalysisTree,
  BTStatus,
  type SARNodeContext,
  type SARNodeMemory,
  type BTEvent,
} from "../sar/bt";
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
      console.log(`[sar-worker] BT job ${job.id}: task=${job.data.task} refId=${job.data.refId}`);

      const config   = await loadConfig();
      const provider = createProvider(config.ai);

      // Build SAR BT context
      const memory: SARNodeMemory = {};
      const btContext: SARNodeContext = {
        orgId:      job.data.orgId,
        refId:      job.data.refId,
        task:       job.data.task,
        senseInput: job.data.sense,
        sarContext: {
          orgId:        job.data.orgId,
          orgName:      "",
          constitution: job.data.constitutionText ?? "",
        },
        provider,
        memory,
        emit: (event: BTEvent) => {
          if (event.type === "bt:tree_end" || event.type.startsWith("sar:")) {
            console.log(`[sar-bt] ${event.type} source=${event.source}`);
          }
        },
      };

      // Execute the governance behavior tree (Sense → Analyze → Respond)
      const compositor = new GovernanceBTCompositor();
      const result     = await compositor.execute(GovernanceAnalysisTree, btContext);

      console.log(
        `[sar-worker] BT complete status=${result.status} ` +
        `duration=${result.durationMs}ms errors=${result.errors.length}`
      );

      // Persist analysis to DB if proposal-related and tree succeeded
      if (job.data.refId && result.status === BTStatus.SUCCESS && result.analysis) {
        try {
          const { db }        = await import("../db/connection");
          const { proposals } = await import("../db/schema");
          const { eq }        = await import("drizzle-orm");

          await db
            .update(proposals)
            .set({
              aiAnalysis: {
                summary:                 result.analysis.summary,
                riskLevel:               result.analysis.riskLevel,
                recommendation:          result.analysis.recommendation,
                reasoning:               result.analysis.reasoning,
                constitutionalConflicts: result.analysis.constitutionalConflicts,
                suggestedActions:        result.analysis.suggestedActions,
                completedAt:             new Date().toISOString(),
              },
              updatedAt: new Date().toISOString(),
            })
            .where(eq(proposals.id, job.data.refId));

          console.log(`[sar-worker] Persisted BT analysis to proposal ${job.data.refId}`);
        } catch (err) {
          console.error(`[sar-worker] Failed to persist analysis:`, err);
        }
      }

      // Emit real-time completion event
      emitSARCompleted(job.data.orgId, {
        id:     job.id ?? "",
        task:   job.data.task,
        status: result.status === BTStatus.SUCCESS ? "completed" : "failed",
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
 * Execute SAR task synchronously via BT (fallback when queue is unavailable).
 * Uses the same GovernanceAnalysisTree as the async worker.
 */
export async function executeSARSync(data: SARJobData): Promise<void> {
  try {
    const config   = await loadConfig();
    const provider = createProvider(config.ai);

    const memory: SARNodeMemory = {};
    const btContext: SARNodeContext = {
      orgId:      data.orgId,
      refId:      data.refId,
      task:       data.task,
      senseInput: data.sense,
      sarContext: {
        orgId:        data.orgId,
        orgName:      "",
        constitution: data.constitutionText ?? "",
      },
      provider,
      memory,
      emit: (event: BTEvent) => {
        if (event.type.startsWith("sar:") || event.type === "bt:tree_end") {
          console.log(`[sar-bt-sync] ${event.type} source=${event.source}`);
        }
      },
    };

    const compositor = new GovernanceBTCompositor();
    const result     = await compositor.execute(GovernanceAnalysisTree, btContext);

    if (data.refId && result.status === BTStatus.SUCCESS && result.analysis) {
      try {
        const { db }        = await import("../db/connection");
        const { proposals } = await import("../db/schema");
        const { eq }        = await import("drizzle-orm");

        await db
          .update(proposals)
          .set({
            aiAnalysis: {
              summary:                 result.analysis.summary,
              riskLevel:               result.analysis.riskLevel,
              recommendation:          result.analysis.recommendation,
              reasoning:               result.analysis.reasoning,
              constitutionalConflicts: result.analysis.constitutionalConflicts,
              suggestedActions:        result.analysis.suggestedActions,
              completedAt:             new Date().toISOString(),
            },
            updatedAt: new Date().toISOString(),
          })
          .where(eq(proposals.id, data.refId));

        console.log(`[sar-worker] Sync BT analysis persisted for proposal ${data.refId}`);
      } catch (err) {
        console.error(`[sar-worker] Failed to persist sync analysis:`, err);
      }
    }

    console.log(`[sar-worker] Sync BT complete: ${data.task} status=${result.status} duration=${result.durationMs}ms`);
  } catch (err) {
    console.error("[sar-worker] Sync BT execution failed:", err);
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
