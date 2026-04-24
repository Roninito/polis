<script lang="ts" module>
  /**
   * WebSocket real-time store — connects to POLIS WS endpoint
   * and exposes a reactive event stream for governance events.
   */

  let ws: WebSocket | null = null;
  let events = $state<GovernanceEvent[]>([]);
  let connectionStatus = $state<"connecting" | "connected" | "disconnected">("disconnected");
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let currentOrgId: string | null = null;

  interface GovernanceEvent {
    type: string;
    orgId: string;
    data: unknown;
    ts: number;
  }

  const MAX_EVENTS = 100;

  export function connect(orgId: string) {
    if (ws && currentOrgId === orgId) return;
    disconnect();

    currentOrgId = orgId;
    connectionStatus = "connecting";

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    ws = new WebSocket(`${protocol}//${host}/ws?org=${orgId}`);

    ws.onopen = () => {
      connectionStatus = "connected";
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    ws.onmessage = (e) => {
      try {
        const event: GovernanceEvent = JSON.parse(e.data);
        if (event.type === "connected" || event.type === "pong") return;
        events = [event, ...events].slice(0, MAX_EVENTS);
      } catch {}
    };

    ws.onclose = () => {
      connectionStatus = "disconnected";
      ws = null;
      // Auto-reconnect after 3 seconds
      if (currentOrgId) {
        reconnectTimer = setTimeout(() => {
          if (currentOrgId) connect(currentOrgId);
        }, 3000);
      }
    };

    ws.onerror = () => {
      connectionStatus = "disconnected";
    };
  }

  export function disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (ws) {
      ws.close();
      ws = null;
    }
    currentOrgId = null;
    connectionStatus = "disconnected";
  }

  export function getEvents() {
    return events;
  }

  export function getStatus() {
    return connectionStatus;
  }

  export function clearEvents() {
    events = [];
  }

  /**
   * Filter events by type. Returns a derived reactive array.
   */
  export function getEventsByType(type: string) {
    return events.filter((e) => e.type === type);
  }
</script>
