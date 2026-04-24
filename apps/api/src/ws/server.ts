/**
 * WebSocket server — real-time governance event streaming.
 *
 * Bun natively supports WebSocket upgrades via `server.upgrade()`.
 * Clients subscribe to org-scoped event streams.
 */

import type { ServerWebSocket } from "bun";

export interface WSData {
  orgId: string;
  userId?: string;
}

// Org → set of connected sockets
const orgRooms = new Map<string, Set<ServerWebSocket<WSData>>>();

/**
 * Attempt WebSocket upgrade. Returns true if upgraded.
 */
export function tryUpgrade(req: Request, server: any): boolean {
  const url = new URL(req.url);
  if (url.pathname !== "/ws") return false;

  const orgId = url.searchParams.get("org");
  if (!orgId) return false;

  const userId = url.searchParams.get("user") ?? undefined;

  const success = server.upgrade(req, {
    data: { orgId, userId } satisfies WSData,
  });

  return !!success;
}

/**
 * Bun WebSocket handler config — pass to Bun.serve({ websocket: wsHandler })
 */
export const wsHandler = {
  open(ws: ServerWebSocket<WSData>) {
    const { orgId } = ws.data;
    if (!orgRooms.has(orgId)) {
      orgRooms.set(orgId, new Set());
    }
    orgRooms.get(orgId)!.add(ws);
    ws.subscribe(`org:${orgId}`);
    ws.send(JSON.stringify({ type: "connected", orgId }));
  },

  message(ws: ServerWebSocket<WSData>, message: string | Buffer) {
    // Clients can send ping/pong or subscribe to specific channels
    try {
      const data = JSON.parse(String(message));
      if (data.type === "ping") {
        ws.send(JSON.stringify({ type: "pong", ts: Date.now() }));
      }
    } catch {
      // ignore malformed messages
    }
  },

  close(ws: ServerWebSocket<WSData>) {
    const { orgId } = ws.data;
    const room = orgRooms.get(orgId);
    if (room) {
      room.delete(ws);
      if (room.size === 0) orgRooms.delete(orgId);
    }
    ws.unsubscribe(`org:${orgId}`);
  },

  drain(_ws: ServerWebSocket<WSData>) {
    // backpressure handling — no-op for now
  },
};

/**
 * Broadcast an event to all clients in an org room.
 */
export function broadcastToOrg(orgId: string, event: GovernanceEvent) {
  const room = orgRooms.get(orgId);
  if (!room) return;
  const payload = JSON.stringify(event);
  for (const ws of room) {
    ws.send(payload);
  }
}

/**
 * Get count of connected clients per org.
 */
export function getConnectionCount(orgId?: string): number {
  if (orgId) return orgRooms.get(orgId)?.size ?? 0;
  let total = 0;
  for (const room of orgRooms.values()) total += room.size;
  return total;
}

// Event types
export interface GovernanceEvent {
  type: string;
  orgId: string;
  data: unknown;
  ts: number;
}
