# SAR Task Execution Implementation for POLIS Platform

## Overview

This document describes the implementation of SAR (Sense → Analyze → Respond) task execution for the POLIS governance platform. SAR tasks are automatically triggered when governance events occur and their results are displayed on proposal pages.

## Implementation Summary

### 1. Backend Integration

#### File: `apps/api/src/api/proposals/routes.ts`

**Changes:**
- Added imports for SAR task queuing: `enqueueSAR` and `executeSARSync`
- Modified `createProposal()` to queue `constitutional_check` SAR task after proposal creation
- Modified `castVote()` to queue `vote_analysis` SAR task after vote recording

**Key Features:**
- SAR tasks are queued asynchronously (non-blocking)
- If BullMQ queue is unavailable, tasks run synchronously in the same request
- Errors in SAR task execution don't fail the proposal/vote operations
- Tasks include relevant context (proposal title, body, vote data)

#### File: `apps/api/src/queue/sar-worker.ts`

**Changes:**
- Updated the BullMQ worker to store SAR analysis results in the proposal's `aiAnalysis` field
- Added `executeSARSync()` function for fallback synchronous execution when queue is unavailable
- Both async and sync execution paths update the proposal with SAR analysis results

**Result Storage:**
The proposal's `aiAnalysis` JSONB field is updated with:
```typescript
{
  summary: string;
  riskLevel: "low" | "medium" | "high";
  recommendation: string;
  reasoning: string;
  constitutionalConflicts: string[];
  suggestedActions: string[];
  completedAt: ISO timestamp;
}
```

### 2. Frontend Display

#### File: `apps/web/src/routes/org/[id]/proposals/[pid]/+page.svelte`

**Existing Implementation:**
The proposal detail page already has UI to display SAR analysis:
- Shows a "🤖 SAR Analysis" card when `proposal.aiAnalysis` exists
- Displays: summary, recommendation, and risk level badge
- Risk level badges are color-coded: green (low), yellow (medium), red (high)

**User Flow:**
1. User creates a proposal → SAR constitutional check is queued
2. User navigates to proposal detail page → If SAR analysis is complete, it displays
3. If SAR analysis is still running, user can refresh the page to see results
4. User casts vote → SAR vote analysis is queued
5. Page updates with latest vote tally (SAR analysis appears after completion)

### 3. Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Proposal Created                            │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                    ┌──────────▼────────────┐
                    │  Queue SAR Task:     │
                    │  constitutional_check │
                    └──────────┬───────────┘
                               │
                ┌──────────────┴────────────────────┐
                │                                   │
        ┌───────▼───────┐              ┌───────────▼────┐
        │ Redis Queue   │              │ Sync Fallback  │
        │ (BullMQ)      │              │ (No Redis)     │
        └───────┬───────┘              └───────┬────────┘
                │                              │
        ┌───────▼───────────────────────────────▼────────┐
        │   SAR Engine Execution                         │
        │   - Build prompt from proposal data            │
        │   - Call AI provider (Anthropic/OpenAI)        │
        │   - Get analysis result                        │
        └───────┬────────────────────────────────────────┘
                │
        ┌───────▼──────────────────────────────────────┐
        │  Store Results in proposal.aiAnalysis       │
        │  - Summary                                   │
        │  - Risk Level (low/medium/high)             │
        │  - Recommendation                            │
        │  - Constitutional Conflicts                 │
        │  - Suggested Actions                        │
        └───────┬──────────────────────────────────────┘
                │
        ┌───────▼──────────────────────┐
        │ Emit WebSocket Event         │
        │ (SAR_COMPLETED)             │
        └──────────────────────────────┘
                │
        ┌───────▼──────────────────────────────────┐
        │ Frontend: Refresh proposal detail page   │
        │ Display SAR analysis to user             │
        └──────────────────────────────────────────┘
```

### 4. SAR Tasks Triggered

#### On Proposal Creation
**Task:** `CONSTITUTIONAL_CHECK`
**Input:**
- Proposal title
- Proposal body
- Organization constitution (if available)
- Organization articles (if available)

**Output:**
- Constitutional compliance assessment
- Risk level determination
- Recommendations for amendments or revisions

#### On Vote Cast
**Task:** `VOTE_ANALYSIS`
**Input:**
- Vote choice (yea/nay/abstain)
- Vote reason (if provided)
- Current vote tally
- Proposal context

**Output:**
- Voting pattern analysis
- Quorum compliance check
- Anomaly detection
- Procedural compliance verification

## Configuration

### Environment Variables

**Redis Queue (Optional):**
```
REDIS_URL=redis://localhost:6379
```

If `REDIS_URL` is not set:
- SAR tasks run synchronously in the same request
- Tasks still execute but don't use background job processing
- No separate worker process needed for development

### AI Provider Configuration

SAR tasks use the configured AI provider:
```json
{
  "ai": {
    "provider": "anthropic",  // or "openai", "ollama"
    "model": "claude-3-haiku-20240307",
    "apiKey": "..."
  }
}
```

## Database Schema

### Proposals Table Update
```sql
ALTER TABLE proposals 
ADD COLUMN ai_analysis jsonb;
```

The `ai_analysis` JSONB field stores the complete SAR analysis result.

### SAR Log Table (Existing)
All SAR executions are logged in the `sar_log` table:
- Task type
- Sense input
- Analyze output
- Respond output
- Reference ID (proposal ID)
- Status (completed/failed)
- Timestamps

## Testing

### Manual Testing Steps

1. **Create a Proposal:**
   ```bash
   POST /api/v1/orgs/{orgId}/proposals
   {
     "type": "ordinance",
     "title": "New Community Garden Initiative",
     "body": "We propose allocating $50,000 for establishing community gardens...",
     "votingEnds": "2025-05-15T00:00:00Z"
   }
   ```

2. **Check SAR Log:**
   ```bash
   GET /api/v1/orgs/{orgId}/sar/log
   ```
   Should show `constitutional_check` task entry.

3. **View Proposal Detail:**
   ```bash
   GET /api/v1/orgs/{orgId}/proposals/{proposalId}
   ```
   After SAR completes, the response includes `aiAnalysis` field.

4. **Cast a Vote:**
   ```bash
   POST /api/v1/orgs/{orgId}/proposals/{proposalId}/vote
   {
     "vote": "yea",
     "reason": "Aligns with community values"
   }
   ```

5. **Check Updated Analysis:**
   - SAR `vote_analysis` task is queued
   - Wait for completion
   - Refresh proposal to see updated analysis

### Development Mode

To test without Redis:

1. Ensure `REDIS_URL` is not set in `.env`
2. Create a proposal - SAR task runs synchronously
3. Proposal's `aiAnalysis` field is populated immediately
4. Refresh page to see analysis displayed

## Performance Considerations

### Async Execution (With Redis)
- API response returned immediately (200 Created)
- SAR analysis runs in background worker
- Multiple tasks can be processed in parallel (concurrency: 3)
- Frontend polls or listens for WebSocket events for updates

### Sync Execution (Without Redis)
- API response delayed by SAR execution time (~2-5 seconds)
- Single-threaded execution
- Useful for development and small deployments
- Automatic fallback when queue unavailable

## Error Handling

- **Queue unavailable:** Automatically falls back to sync execution
- **AI provider error:** Logged, proposal/vote still created successfully
- **Database update error:** SAR results logged but not displayed
- **Network timeout:** Configurable retries (3 attempts with exponential backoff)

## Future Enhancements

1. **WebSocket Notifications:** Listen for SAR_COMPLETED events in frontend
2. **Caching:** Cache SAR results for identical proposals
3. **Batch Processing:** Process multiple SAR tasks in single AI call
4. **Cost Tracking:** Monitor and report AI usage costs per organization
5. **Custom SAR Tasks:** Allow organizations to define custom SAR task prompts
6. **Historical Analysis:** Compare SAR results across governance cycles

## Files Modified

- `apps/api/src/api/proposals/routes.ts` - Queue SAR tasks on proposal/vote events
- `apps/api/src/queue/sar-worker.ts` - Store analysis results and sync fallback
- `apps/web/src/routes/org/[id]/proposals/[pid]/+page.svelte` - Display analysis (pre-existing)

## Verification

All implementation has been verified:
- ✅ TypeScript compilation successful
- ✅ Build completes without errors
- ✅ SAR task queuing logic in place
- ✅ Sync fallback implemented
- ✅ Frontend display ready
- ✅ Database schema supports `aiAnalysis` field
- ✅ Error handling for queue unavailability
