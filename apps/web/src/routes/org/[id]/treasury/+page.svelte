<script lang="ts">
  import { page } from "$app/stores";
  import { api } from "$lib/api/client";
  import ErrorDisplay from "$lib/components/ErrorDisplay.svelte";
  import SkeletonLoader from "$lib/components/SkeletonLoader.svelte";
  import { onMount } from "svelte";

  let orgId = $derived($page.params.id);
  let treasury = $state<any>(null);
  let ledger = $state<any[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let offset = $state(0);
  let limit = 20;
  let hasMore = $state(false);
  let sortBy = $state<"date" | "amount">("date");
  let sortDir = $state<"asc" | "desc">("desc");

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    loading = true;
    error = null;
    try {
      const [treasuryData, ledgerData] = await Promise.all([
        api.getTreasury(orgId),
        api.getLedger(orgId, limit + 1, offset),
      ]);
      treasury = treasuryData;
      hasMore = ledgerData.length > limit;
      ledger = ledgerData.slice(0, limit);
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load treasury";
    } finally {
      loading = false;
    }
  }

  function fmt(cents: number) {
    return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  }

  function fmtAmount(cents: number) {
    const val = fmt(Math.abs(cents));
    return cents >= 0 ? `+${val}` : `-${val}`;
  }

  function toggleSort(field: "date" | "amount") {
    if (sortBy === field) {
      sortDir = sortDir === "asc" ? "desc" : "asc";
    } else {
      sortBy = field;
      sortDir = "desc";
    }
    offset = 0;
    loadData();
  }

  function nextPage() {
    offset += limit;
    loadData();
  }

  function prevPage() {
    offset = Math.max(0, offset - limit);
    loadData();
  }

  const typeLabels: Record<string, string> = {
    contribution: "Contribution", payout: "Payout", reserve: "Reserve",
    penalty: "Penalty", fee: "Fee", refund: "Refund", adjustment: "Adjustment",
  };
</script>

<div>
  <h1>Treasury</h1>

  {#if loading}
    <SkeletonLoader type="table" count={5} />
  {:else if error}
    <ErrorDisplay message={error} onRetry={loadData} />
  {:else if treasury}
    <div class="stat-grid">
      <div class="card stat-card">
        <div class="stat-value">{fmt(treasury.balance)}</div>
        <div class="stat-label">Total Balance</div>
      </div>
      <div class="card stat-card">
        <div class="stat-value">{fmt(treasury.poolBalance)}</div>
        <div class="stat-label">Available Pool</div>
      </div>
      <div class="card stat-card">
        <div class="stat-value">{fmt(treasury.reserveBalance)}</div>
        <div class="stat-label">Reserve Fund</div>
      </div>
      <div class="card stat-card">
        <div class="stat-value">#{treasury.cycleNumber}</div>
        <div class="stat-label">Cycle</div>
      </div>
    </div>

    <div class="card">
      <div class="ledger-header">
        <h3>Ledger</h3>
        <span class="mono" style="font-size:11px;color:var(--ink3)">HMAC-signed · Append-only</span>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>
              <button class="sort-header" onclick={() => toggleSort("date")}>
                Date {sortBy === "date" ? (sortDir === "desc" ? "▼" : "▲") : ""}
              </button>
            </th>
            <th>Type</th>
            <th>
              <button class="sort-header" onclick={() => toggleSort("amount")}>
                Amount {sortBy === "amount" ? (sortDir === "desc" ? "▼" : "▲") : ""}
              </button>
            </th>
            <th>Balance</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {#each ledger as tx}
            <tr>
              <td>{new Date(tx.createdAt).toLocaleDateString()}</td>
              <td><span class="badge badge-blue">{typeLabels[tx.type] ?? tx.type}</span></td>
              <td class="mono" class:positive={tx.amount >= 0} class:negative={tx.amount < 0}>{fmtAmount(tx.amount)}</td>
              <td class="mono">{fmt(tx.balance)}</td>
              <td class="note">{tx.note ?? "—"}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      {#if ledger.length === 0}
        <p class="empty">No transactions recorded.</p>
      {:else}
        <div class="pagination">
          <button onclick={prevPage} disabled={offset === 0}>← Previous</button>
          <span class="page-info">Page {Math.floor(offset / limit) + 1}</span>
          <button onclick={nextPage} disabled={!hasMore}>Next →</button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  h1 { margin-bottom: 24px; }
  .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
  .stat-card { text-align: center; }
  .ledger-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }

  .table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .table th { text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink3); border-bottom: 1px solid var(--border); }
  .table td { padding: 10px 12px; border-bottom: 1px solid var(--paper2); }
  .positive { color: var(--green); }
  .negative { color: var(--red); }
  .note { font-size: 12px; color: var(--ink3); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .empty { text-align: center; color: var(--ink3); padding: 32px; }

  .sort-header {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--ink3);
    font-weight: inherit;
  }
  .sort-header:hover { color: var(--navy); }

  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
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
