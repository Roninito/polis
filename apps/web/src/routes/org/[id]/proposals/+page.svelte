<script lang="ts">
  import { page } from "$app/stores";
  import { api } from "$lib/api/client";
  import { onMount } from "svelte";
  import ErrorDisplay from "$lib/components/ErrorDisplay.svelte";
  import LoadingSpinner from "$lib/components/LoadingSpinner.svelte";

  let orgId = $derived($page.params.id);
  let proposals = $state<any[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let filter = $state("all");
  let showCreate = $state(false);
  let newTitle = $state("");
  let newBody = $state("");
  let newType = $state("ordinance");
  let createError = $state<string | null>(null);
  let fieldErrors = $state<Record<string, string>>({});
  let creating = $state(false);

  async function loadProposals() {
    loading = true;
    error = null;
    try {
      proposals = await api.listProposals(orgId);
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load proposals";
    } finally {
      loading = false;
    }
  }

  onMount(loadProposals);

  function validateForm() {
    const errors: Record<string, string> = {};
    
    if (!newTitle || newTitle.trim().length === 0) {
      errors.title = "Title is required";
    } else if (newTitle.length > 200) {
      errors.title = "Title must be less than 200 characters";
    }
    
    if (!newBody || newBody.trim().length === 0) {
      errors.body = "Description is required";
    } else if (newBody.length > 5000) {
      errors.body = "Description must be less than 5000 characters";
    }
    
    return errors;
  }

  async function create() {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      fieldErrors = errors;
      createError = "Please fix the errors below";
      return;
    }
    
    creating = true;
    createError = null;
    fieldErrors = {};
    try {
      const p = await api.createProposal(orgId, { type: newType, title: newTitle, body: newBody });
      proposals = [...proposals, p];
      showCreate = false;
      newTitle = ""; newBody = ""; newType = "ordinance";
    } catch (e) {
      createError = e instanceof Error ? e.message : "Failed to create proposal";
    } finally {
      creating = false;
    }
  }

  let filtered = $derived(
    filter === "all" ? proposals : proposals.filter(p => p.status === filter)
  );

  const statusColors: Record<string, string> = {
    draft: "badge-yellow", open: "badge-blue", voting: "badge-blue",
    passed: "badge-green", failed: "badge-red", withdrawn: "badge-yellow",
  };
</script>

<div>
  <header class="page-header">
    <h1>Proposals</h1>
    <button class="btn btn-primary" onclick={() => { showCreate = !showCreate; fieldErrors = {}; createError = null; }}>+ New Proposal</button>
  </header>

  {#if error}
    <ErrorDisplay message={error} onRetry={loadProposals} />
  {/if}

  <div class="filters">
    {#each ["all", "draft", "voting", "passed", "failed"] as f}
      <button class="filter-btn" class:active={filter === f} onclick={() => filter = f}>
        {f.charAt(0).toUpperCase() + f.slice(1)}
      </button>
    {/each}
  </div>

  {#if showCreate}
    <div class="card create-form">
      <h3>New Proposal</h3>
      {#if createError}
        <div class="form-error">{createError}</div>
      {/if}
      <div class="form-stack">
        <div class="form-group">
          <label>Type</label>
          <select bind:value={newType}>
            <option value="ordinance">Ordinance</option>
            <option value="charter_amendment">Charter Amendment</option>
            <option value="resolution">Resolution</option>
            <option value="emergency">Emergency</option>
            <option value="law">Law</option>
            <option value="budget">Budget</option>
          </select>
        </div>

        <div class="form-group">
          <label>Title {#if fieldErrors.title}<span class="required">(required)</span>{/if}</label>
          <input 
            placeholder="Enter proposal title" 
            bind:value={newTitle}
            maxlength="200"
            class:input-error={fieldErrors.title}
          />
          {#if fieldErrors.title}
            <span class="field-error">{fieldErrors.title}</span>
          {/if}
          <span class="char-count">{newTitle.length}/200</span>
        </div>

        <div class="form-group">
          <label>Description {#if fieldErrors.body}<span class="required">(required)</span>{/if}</label>
          <textarea 
            placeholder="Describe the proposal in detail..." 
            bind:value={newBody}
            maxlength="5000"
            rows="4"
            class:input-error={fieldErrors.body}
          ></textarea>
          {#if fieldErrors.body}
            <span class="field-error">{fieldErrors.body}</span>
          {/if}
          <span class="char-count">{newBody.length}/5000</span>
        </div>

        <button class="btn btn-gold full-width" onclick={create} disabled={creating}>
          {creating ? "Submitting..." : "Submit Proposal"}
        </button>
      </div>
    </div>
  {/if}

  {#if loading}
    <LoadingSpinner />
  {:else}
    <div class="proposal-list">
      {#each filtered as p (p.id)}
        <a href="/org/{orgId}/proposals/{p.id}" class="card proposal-card">
          <div class="proposal-header">
            <span class="badge {statusColors[p.status] ?? ''}">{p.status}</span>
            <span class="proposal-type mono">{p.type}</span>
          </div>
          <h3>{p.title}</h3>
          <p class="proposal-body">{p.body.slice(0, 150)}{p.body.length > 150 ? '...' : ''}</p>
          <div class="proposal-footer">
            <span class="tally">👍 {p.votesFor ?? 0} &nbsp; 👎 {p.votesAgainst ?? 0} &nbsp; ⏸ {p.abstain ?? 0}</span>
            {#if p.votingEnds}
              <span class="deadline">Ends {new Date(p.votingEnds).toLocaleDateString()}</span>
            {/if}
          </div>
        </a>
      {/each}
      {#if filtered.length === 0}
        <p class="empty">No proposals found.</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  @media (max-width: 640px) {
    .page-header { flex-direction: column; align-items: flex-start; gap: 12px; }
  }

  .filters { display: flex; gap: 6px; margin-bottom: 20px; flex-wrap: wrap; }
  .filter-btn {
    padding: 6px 14px; border-radius: 99px; font-size: 12px; font-weight: 500;
    border: 1px solid var(--border); background: white; color: var(--ink2);
    transition: all 0.15s; cursor: pointer;
  }
  .filter-btn:hover { border-color: var(--navy); }
  .filter-btn.active { background: var(--navy); color: white; border-color: var(--navy); }

  .create-form { margin-bottom: 16px; }
  .create-form h3 { margin-bottom: 12px; }
  .form-stack { display: flex; flex-direction: column; gap: 14px; }
  
  .form-group {
    display: flex; flex-direction: column; gap: 6px;
  }

  .form-group label {
    font-size: 13px; font-weight: 500; color: var(--ink2);
  }

  .required {
    color: var(--red); font-size: 11px; margin-left: 4px;
  }

  .form-group input,
  .form-group select,
  .form-group textarea {
    padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius);
    font-size: 14px; font-family: inherit;
  }

  .form-group input:focus,
  .form-group select:focus,
  .form-group textarea:focus {
    outline: none; border-color: var(--navy); box-shadow: 0 0 0 3px rgba(30, 45, 74, 0.1);
  }

  .input-error {
    border-color: #991b1b !important;
    background: #fef2f2 !important;
  }

  .field-error {
    color: #991b1b; font-size: 12px; margin-top: -4px;
  }

  .char-count {
    font-size: 11px; color: var(--ink3); text-align: right;
  }

  .form-error {
    background: #fef2f2; border: 1px solid #fca5a5; border-radius: var(--radius);
    padding: 10px 12px; color: #991b1b; font-size: 13px; margin-bottom: 8px;
  }

  .full-width {
    width: 100%; justify-content: center;
  }

  .proposal-list { display: flex; flex-direction: column; gap: 12px; }
  .proposal-card { text-decoration: none; color: inherit; transition: box-shadow 0.15s; }
  .proposal-card:hover { box-shadow: var(--shadow-lg); text-decoration: none; }
  .proposal-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .proposal-type { font-size: 11px; color: var(--ink3); }
  .proposal-body { font-size: 13px; color: var(--ink2); margin-top: 6px; line-height: 1.5; }
  .proposal-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; font-size: 12px; color: var(--ink3); flex-wrap: wrap; gap: 8px; }
  .tally { font-size: 13px; }
  .empty { text-align: center; color: var(--ink3); padding: 48px 16px; }

  @media (max-width: 640px) {
    .proposal-footer { flex-direction: column; align-items: flex-start; }
  }
</style>
