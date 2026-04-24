/**
 * POLIS API Server — standalone Bun.js entry point.
 *
 * For development, use `bun run dev` which starts SvelteKit with the
 * API embedded via hooks.server.ts. This standalone mode is available
 * for API-only deployments or testing.
 */

import { initApi, handleApiRequest } from "./handler";
import { tryUpgrade, wsHandler } from "./ws/server";

const PORT = Number(process.env.PORT ?? 3143);
const HOST = process.env.HOST ?? "0.0.0.0";

async function boot() {
  await initApi();

  Bun.serve({
    port: PORT,
    hostname: HOST,
    websocket: wsHandler,

    async fetch(req, server) {
      // WebSocket upgrade
      if (tryUpgrade(req, server)) return undefined as unknown as Response;

      // Delegate to API handler
      const response = await handleApiRequest(req);
      if (response) return response;

      return Response.json(
        { error: { code: "NOT_FOUND", message: "Not found" } },
        { status: 404 }
      );
    },
  });

  console.log(`[polis] Standalone API server at http://${HOST}:${PORT}`);
}

boot().catch((err) => {
  console.error("[polis] Fatal boot error:", err);
  process.exit(1);
});
