<script lang="ts">
  import { page } from "$app/stores";
  import { api } from "$lib/api/client";
  import ErrorDisplay from "$lib/components/ErrorDisplay.svelte";
  import SkeletonLoader from "$lib/components/SkeletonLoader.svelte";
  import { onMount } from "svelte";

  let orgId = $derived($page.params.id);
  let entries = $state<any[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let expanded = $state<string | null>(null);
  let filterTask = $state<string>("");
  let filterStatus = $state<string>("");
  let offset = $state(0);
  let limit = 20;
  let hasMore = $state(false);

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    loading = true;
    error = null;
    try {
      const data = await api.listSarLog(orgId, limit + 1, offset, {
        task: filterTask || undefined,
        status: filterStatus || undefined,
      });
      hasMore = data.length > limit;
      entries = data.slice(0, limit);
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load SAR log";
    } finally {
      loading = false;
    }
  }

  function toggle(id: string) {
    expanded = expanded === id ? null : id;
  }

  function nextPage() {
    offset += limit;
    loadData();
  }

  function prevPage() {
    offset = Math.max(0, offset - limit);
    loadData();
  }

  const taskLabels: Record<string, string> = {
    proposal_intake: "Proposal Intake",
    constitutional_check: "Constitutional Check",
    cycle_monitoring: "Cycle Monitoring",
    charter_generation: "Charter Generation",
    vote_analysis: "Vote Analysis",
    ledger_audit: "Ledger Audit",
    hardship_review: "Hardship Review",
  };

  const statusLabels: Record<string, string> = {
    completed: "Completed",
    in_progress: "In Progress",
    failed: "Failed",
  };
</script>

<div>
  <header class="page-header">
    <h1>🤖 SAR Log</h1>
    <span class="meta mono">Sense → Analyze → Respond · Append-only</span>
  </header>

  {#if loading}
    <SkeletonLoader type="card" count={5} />
  {:else if error}
    <ErrorDisplay message={error} onRetry={loadData} />
  {:else}
    <div class="filters card">
      <label>
        <span>Filter by Task:</span>
        <select bind:value={filterTask}>
          <option value="">All Tasks</option>
          <option value="proposal_intake">Proposal Intake</option>
          <option value="constitutional_check">Constitutional Check</option>
          <option value="cycle_monitoring">Cycle Monitoring</option>
          <option value="charter_generation">Charter Generation</option>
          <option value="vote_analysis">Vote Analysis</option>
          <option value="ledger_audit">Ledger Audit</option>
          <option value="hardship_review">Hardship Review</option>
        </select>
      </label>
      <label>
        <span>Filter by Status:</span>
        <select bind:value={filterStatus}>
          <option value="">All Status</option>
          <option value="completed">Completed</option>
          <option value="in_progress">In Progress</option>
          <option value="failed">Failed</option>
        </select>
      </label>
    </div>

    <div class="entries">
      {#each entries as entry}
        <button class="card entry" class:expanded={expanded === entry.id} onclick={() => toggle(entry.id)}>
          <div class="entry-header">
            <span class="badge badge-blue">{taskLabels[entry.task] ?? entry.task}</span>
            <span class="badge {entry.status === 'completed' ? 'badge-green' : entry.status === 'failed' ? 'badge-red' : 'badge-yellow'}">{statusLabels[entry.status] ?? entry.status}</span>
            {#if entry.refId}
              <span class="mono ref">{entry.refId}</span>
            {/if}
            <span class="date">{new Date(entry.createdAt).toLocaleString()}</span>
          </div>

          {#if expanded === entry.id}
            <div class="sar-detail">
              <div class="sar-phase">
                <div class="phase-label">SENSE</div>
                <div class="phase-content">{entry.sense}</div>
              </div>
              <div class="sar-phase">
                <div class="phase-label">ANALYZE</div>
                <div class="phase-content">{entry.analyze}</div>
              </div>
              <div class="sar-phase">
                <div class="phase-label">RESPOND</div>
                <div class="phase-content">{entry.respond}</div>
              </div>
              {#if entry.modelUsed}
                <div class="model-info mono">
                  Model: {entry.modelUsed} {entry.tokensUsed ? `· ${entry.tokensUsed} tokens` : ""} {entry.costCents ? `· $${(entry.costCents / 100).toFixed(2)}` : ""}
                </div>
              {/if}
            </div>
          {:else}
            <p class="sense-preview">{entry.sense.slice(0, 120)}{entry.sense.length > 120 ? "..." : ""}</p>
          {/if}
        </button>
      {/each}
      {#if entries.length === 0}
        <div class="card"><p class="empty">No SAR entries found.</p></div>
      {/if}
    </div>

    {#if entries.length > 0}
      <div class="pagination">
        <button onclick={prevPage} disabled={offset === 0}>← Previous</button>
        <span class="page-info">Page {Math.floor(offset / limit) + 1}</span>
        <button onclick={nextPage} disabled={!hasMore}>Next →</button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .page-header { display: flex; align-items: baseline; gap: 16px; margin-bottom: 24px; }
  .meta { font-size: 12px; color: var(--ink3); }

  .filters {
    display: flex;
    gap: 16px;
    margin-bottom: 24px;
    padding: 16px;
  }

  .filters label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
  }

  .filters label span {
    font-weight: 600;
    color: var(--ink3);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .filters select {
    padding: 6px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--paper);
    color: var(--ink);
    font-size: 13px;
  }

  .entries { display: flex; flex-direction: column; gap: 12px; }
  .entry {
    text-align: left; width: 100%; cursor: pointer;
    transition: box-shadow 0.15s;
    background: var(--paper);
    border: 1px solid var(--border);
  }
  .entry:hover { box-shadow: var(--shadow-lg); }
  .entry-header { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .ref { font-size: 11px; color: var(--ink3); }
  .date { font-size: 12px; color: var(--ink3); margin-left: auto; }
  .sense-preview { font-size: 13px; color: var(--ink2); margin-top: 8px; margin-bottom: 0; }

  .sar-detail { margin-top: 16px; }
  .sar-phase { margin-bottom: 16px; }
  .phase-label {
    font-size: 10px; font-weight: 600; letter-spacing: 0.15em;
    color: var(--gold); margin-bottom: 6px;
  }
  .phase-content { 
    font-size: 13px; 
    line-height: 1.6; 
    color: var(--ink2); 
    white-space: pre-wrap;
    word-break: break-word;
  }
  .model-info { font-size: 11px; color: var(--ink3); margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); }
  .empty { text-align: center; color: var(--ink3); padding: 32px; }

  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin-top: 24px;
  }

  .pagination button {
    padding: 6px 12px;
    background: var(--paper);
    border: 1px solid var(--border);
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
  }

  .pagination button:hover:not(:disabled) {
    background: var(--paper2);
  }

  .pagination button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .page-info {
    font-size: 12px;
    color: var(--ink3);
  }
</style>
