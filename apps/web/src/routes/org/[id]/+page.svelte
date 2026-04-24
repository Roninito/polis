<script lang="ts">
  import { page } from "$app/stores";
  import { api } from "$lib/api/client";
  import * as realtime from "$lib/stores/realtime.svelte";
  import { onMount } from "svelte";
  import ErrorDisplay from "$lib/components/ErrorDisplay.svelte";
  import SkeletonLoader from "$lib/components/SkeletonLoader.svelte";

  let orgId = $derived($page.params.id);
  let stats = $state<any>(null);
  let org = $state<any>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  let processedEventIds = new Set<string>();

  onMount(async () => {
    await loadData();
    
    // Connect to WebSocket for real-time updates
    realtime.connect(orgId);
    
    // Subscribe to events and update stats
    const unsubscribe = setInterval(() => {
      if (!stats) return;
      
      const events = realtime.getEvents();
      events.forEach((event) => {
        // Create unique event ID to avoid duplicate processing
        const eventId = `${event.type}-${event.ts}-${Math.random()}`;
        
        if (!processedEventIds.has(eventId)) {
          processedEventIds.add(eventId);
          
          if (event.type === "member.joined") {
            stats.members = (stats.members || 0) + 1;
          } else if (event.type === "proposal.created") {
            stats.openProposals = (stats.openProposals || 0) + 1;
          }
        }
      });
    }, 100);
    
    return () => {
      clearInterval(unsubscribe);
      realtime.disconnect();
    };
  });

  async function loadData() {
    loading = true;
    error = null;
    try {
      [org, stats] = await Promise.all([
        api.getOrg(orgId),
        api.getOrgStats(orgId),
      ]);
    } catch (e: any) {
      error = e instanceof Error ? e.message : "Failed to load dashboard";
    } finally {
      loading = false;
    }
  }

  function formatCurrency(cents: number) {
    return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  }
</script>

<div class="dashboard">
  <header class="page-header">
    <h1>{org?.name ?? "Dashboard"}</h1>
    {#if org?.type}
      <span class="badge badge-green">{org.type}</span>
    {/if}
  </header>

  {#if loading}
    <SkeletonLoader type="card" count={4} />
  {:else if error}
    <ErrorDisplay message={error} onRetry={loadData} />
  {:else if stats}
    <div class="stat-grid">
      <div class="card stat-card">
        <div class="stat-value">{stats.members}</div>
        <div class="stat-label">Active Members</div>
      </div>
      <div class="card stat-card">
        <div class="stat-value">{formatCurrency(stats.treasuryBalance)}</div>
        <div class="stat-label">Treasury Balance</div>
      </div>
      <div class="card stat-card">
        <div class="stat-value">{stats.openProposals}</div>
        <div class="stat-label">Open Proposals</div>
      </div>
      <div class="card stat-card">
        <div class="stat-value">#{stats.cycleNumber}</div>
        <div class="stat-label">Current Cycle</div>
      </div>
    </div>

    <div class="sections">
      <div class="card">
        <h3>Quick Actions</h3>
        <div class="actions">
          <a href="/org/{orgId}/proposals" class="btn btn-outline">View Proposals</a>
          <a href="/org/{orgId}/members" class="btn btn-outline">Manage Members</a>
          <a href="/org/{orgId}/treasury" class="btn btn-outline">Treasury</a>
          <a href="/org/{orgId}/sar" class="btn btn-outline">SAR Log</a>
        </div>
      </div>

      <div class="card">
        <h3>Reserve Fund</h3>
        <div class="reserve-bar">
          <div class="reserve-fill" style="width: {stats.treasuryBalance > 0 ? Math.round((stats.reserveBalance / stats.treasuryBalance) * 100) : 0}%"></div>
        </div>
        <p class="reserve-label">{formatCurrency(stats.reserveBalance)} reserved of {formatCurrency(stats.treasuryBalance)} total</p>
      </div>
    </div>
  {/if}
</div>

<style>
  .page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 24px;
  }
  .stat-card { text-align: center; }

  .sections { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }

  .reserve-bar {
    height: 8px;
    background: var(--paper3);
    border-radius: 99px;
    margin-top: 16px;
    overflow: hidden;
  }
  .reserve-fill {
    height: 100%;
    background: var(--green);
    border-radius: 99px;
    transition: width 0.3s;
  }
  .reserve-label { font-size: 12px; color: var(--ink3); margin-top: 8px; }
</style>
