/**
 * SvelteKit server hooks — routes /api/* and /healthz to the POLIS API handler.
 *
 * This makes the API and frontend run as a single server on one port.
 */

import { initApi, handleApiRequest } from "@polis/api/handler";
import type { Handle } from "@sveltejs/kit";

// Initialize API services once at startup
initApi().catch((err) => {
  console.error("[polis] API init failed:", err);
});

export const handle: Handle = async ({ event, resolve }) => {
  const url = new URL(event.request.url);

  // Route API, health, and WebSocket requests to the POLIS API handler
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname === "/healthz" ||
    url.pathname === "/readyz" ||
    url.pathname === "/ws"
  ) {
    const response = await handleApiRequest(event.request);
    if (response) return response;
  }

  // Everything else → SvelteKit (pages, static assets, etc.)
  return resolve(event);
};
