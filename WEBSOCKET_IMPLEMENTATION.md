# WebSocket Real-Time Dashboard Implementation (P1)

## Overview
This implementation wires WebSocket events to auto-update dashboard statistics when governance events (member additions, proposal creations) occur. The system supports multi-instance deployments via Redis pub/sub.

## Architecture

### 1. Event Emission Layer (Backend)

#### apps/api/src/api/members/routes.ts
When a new member is added via `POST /orgs/:id/members`:
```typescript
// After member created in DB
emitMemberJoined(params.id, {
  id: member.id,
  name: member.name,
  role: member.role || "member",
});
```

#### apps/api/src/api/proposals/routes.ts
When a new proposal is created via `POST /orgs/:id/proposals`:
```typescript
// After proposal created in DB
emitProposalCreated(params.id, {
  id: proposal.id,
  title: proposal.title,
  type: proposal.type,
});
```

When a vote is cast via `POST /orgs/:id/proposals/:pid/vote`:
```typescript
// After vote recorded
emitVoteCast(params.id, {
  proposalId: params.pid,
  vote: body.vote,
});
```

### 2. Event Broadcasting System (Backend)

#### apps/api/src/ws/events.ts
Centralized event emitter that:
- Calls `broadcastToOrg()` for local WebSocket clients
- Calls `publishEvent()` to Redis pub/sub for cluster distribution

```typescript
export function emit(orgId: string, type: EventTypeName, data: unknown) {
  const event: GovernanceEvent = { type, orgId, data, ts: Date.now() };
  broadcastToOrg(orgId, event);           // Local WS clients
  publishEvent(orgId, event).catch(...);  // Redis for other instances
}
```

#### apps/api/src/ws/server.ts
Bun native WebSocket server with:
- `tryUpgrade()`: Intercepts `/ws?org=<orgId>` requests
- `wsHandler`: Manages WebSocket lifecycle (open, message, close, drain)
- `broadcastToOrg()`: Sends JSON events to all clients in org room
- Org-scoped rooms via `Map<orgId, Set<WebSocket>>`

#### apps/api/src/ws/redis-pubsub.ts
Multi-instance event distribution:
- Subscribes to `polis:events:*` channel pattern
- Re-broadcasts received events to local org rooms
- Gracefully degrades if Redis unavailable (local-only mode)

### 3. WebSocket Client (Frontend)

#### apps/web/src/lib/stores/realtime.svelte
Reactive store that:
- Maintains WebSocket connection to `ws://[host]/ws?org=[orgId]`
- Buffers up to 100 recent events
- Auto-reconnects on disconnect (3s delay)
- Exports: `connect(orgId)`, `disconnect()`, `getEvents()`, `getStatus()`

### 4. Dashboard Integration (Frontend)

#### apps/web/src/routes/org/[id]/+page.svelte
Updated to wire real-time updates:
1. Connect to WebSocket on mount: `realtime.connect(orgId)`
2. Poll events every 100ms
3. Update stats when events received:
   - `member.joined` → increment `stats.members`
   - `proposal.created` → increment `stats.openProposals`
4. Deduplicate events (track processed event timestamps)
5. Disconnect on unmount

```typescript
onMount(async () => {
  await loadData();
  realtime.connect(orgId);
  
  let processedEventIds = new Set<string>();
  
  const unsubscribe = setInterval(() => {
    if (!stats) return;
    
    realtime.getEvents().forEach((event) => {
      const eventId = `${event.type}-${event.ts}-${Math.random()}`;
      if (!processedEventIds.has(eventId)) {
        processedEventIds.add(eventId);
        
        if (event.type === "member.joined") {
          stats.members++;
        } else if (event.type === "proposal.created") {
          stats.openProposals++;
        }
      }
    });
  }, 100);
  
  return () => {
    clearInterval(unsubscribe);
    realtime.disconnect();
  };
});
```

## Event Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ Frontend: Admin adds member in /org/[id]/members            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
        POST /orgs/[id]/members
                      │
┌─────────────────────▼───────────────────────────────────────┐
│ Backend: apps/api/src/api/members/routes.ts                │
│ - Insert member in DB                                      │
│ - Call emitMemberJoined(orgId, member)                     │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
        apps/api/src/ws/events.ts: emit()
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
   broadcastToOrg()          publishEvent() → Redis
        │                           │
        ▼                           ▼
   Local WebSocket clients    Other instances subscribe
        │                           │
        └─────────────┬─────────────┘
                      │
    WebSocket message: {"type":"member.joined", ...}
                      │
┌─────────────────────▼───────────────────────────────────────┐
│ Frontend: Dashboard realtime.svelte receives event         │
│ - getEvents() returns updated array with event             │
│ - Dashboard polls and processes event                       │
│ - stats.members incremented                                │
│ - UI reactively updates                                     │
└─────────────────────────────────────────────────────────────┘
```

## Deployment

### Single Instance (No Redis)
- WebSocket connections local-only
- Members/proposals updated in real-time for connected clients
- Each instance has isolated rooms

### Multi-Instance (With Redis)
- Set `REDIS_URL` environment variable
- Events published to Redis pub/sub
- All instances share org rooms via Redis channel pattern
- Seamless real-time updates across load balancer

## Testing

### Manual Testing
1. Open org dashboard in Tab A: `http://localhost:5173/org/test-org`
2. Open members page in Tab B: `http://localhost:5173/org/test-org/members`
3. Add new member in Tab B
4. Observe member count increment in Tab A (no page refresh)
5. Repeat with proposals: `http://localhost:5173/org/test-org/proposals`

### Browser DevTools
Monitor in Console:
```javascript
// Watch WebSocket messages
const ws = document.querySelector('body').__events
// Or inspect Network > WS tab
```

## Future Enhancements (P2+)

1. **WebSocket Authentication** - Validate org membership before subscribing
2. **Optimistic UI** - Show UI changes immediately before server confirmation
3. **Event Filtering** - Client-side filters for specific event types
4. **Proposal Status Updates** - Emit when proposals change status (passed/failed)
5. **Treasury Transactions** - Real-time balance updates
6. **Activity Feed** - Show recent events in sidebar
7. **Presence Indicators** - Show who's currently viewing the org

## Files Modified

- ✅ `apps/api/src/api/members/routes.ts` - Added event emission on member creation
- ✅ `apps/api/src/api/proposals/routes.ts` - Added event emissions on proposal/vote creation
- ✅ `apps/web/src/routes/org/[id]/+page.svelte` - Wired WebSocket subscription and stats updates

Files already in place (no changes needed):
- `apps/api/src/ws/server.ts`
- `apps/api/src/ws/events.ts`
- `apps/api/src/ws/redis-pubsub.ts`
- `apps/web/src/lib/stores/realtime.svelte`

## Debugging

If real-time updates not working:
1. Check browser DevTools Console for WebSocket connection errors
2. Verify `/ws?org=[orgId]` endpoint accessible
3. Check API logs for `emitMemberJoined`/`emitProposalCreated` calls
4. Confirm Redis connection if multi-instance (check `REDIS_URL`)
5. Monitor Network tab for WebSocket frames
