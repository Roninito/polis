/**
 * Redis pub/sub for multi-instance WebSocket event distribution.
 *
 * In standalone mode, this gracefully degrades — events are only local.
 * In multi-tenant / clustered mode, Redis distributes events across instances.
 */

import type { GovernanceEvent } from "./server";
import { broadcastToOrg } from "./server";

const CHANNEL_PREFIX = "polis:events:";

let publisher: any = null;
let subscriber: any = null;
let connected = false;

/**
 * Initialize Redis pub/sub connections.
 * Call once during boot if REDIS_URL is configured.
 */
export async function initRedisPubSub(): Promise<void> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log("[ws] No REDIS_URL — pub/sub disabled (local-only mode)");
    return;
  }

  try {
    const Redis = (await import("ioredis")).default;
    publisher = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 3 });
    subscriber = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 3 });

    await Promise.all([publisher.connect(), subscriber.connect()]);
    connected = true;

    // Subscribe to wildcard pattern for all org events
    await subscriber.psubscribe(`${CHANNEL_PREFIX}*`);

    subscriber.on("pmessage", (_pattern: string, channel: string, message: string) => {
      try {
        const orgId = channel.slice(CHANNEL_PREFIX.length);
        const event: GovernanceEvent = JSON.parse(message);
        // Re-broadcast to local WebSocket clients
        broadcastToOrg(orgId, event);
      } catch {
        // ignore malformed messages
      }
    });

    console.log("[ws] Redis pub/sub connected");
  } catch (err) {
    console.warn("[ws] Redis pub/sub failed to connect:", err instanceof Error ? err.message : err);
    connected = false;
  }
}

/**
 * Publish an event to Redis for distribution to other instances.
 */
export async function publishEvent(orgId: string, event: GovernanceEvent): Promise<void> {
  if (!connected || !publisher) return;
  await publisher.publish(`${CHANNEL_PREFIX}${orgId}`, JSON.stringify(event));
}

/**
 * Graceful shutdown — disconnect Redis clients.
 */
export async function shutdownRedisPubSub(): Promise<void> {
  if (subscriber) {
    await subscriber.punsubscribe().catch(() => {});
    subscriber.disconnect();
  }
  if (publisher) {
    publisher.disconnect();
  }
  connected = false;
}
