<script lang="ts">
  import { page } from "$app/stores";
  import { api } from "$lib/api/client";
  import { onMount } from "svelte";
  import ErrorDisplay from "$lib/components/ErrorDisplay.svelte";
  import SkeletonLoader from "$lib/components/SkeletonLoader.svelte";

  let orgId = $derived($page.params.id);
  let pid = $derived($page.params.pid);
  let proposal = $state<any>(null);
  let votes = $state<any[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let voteChoice = $state<"yea" | "nay" | "abstain" | "">("");
  let voteReason = $state("");
  let voting = $state(false);
  let voted = $state(false);
  let voteError = $state("");
  let voteSuccess = $state("");
  let userVote = $state<any>(null);

  onMount(async () => {
    await loadProposal();
  });

  async function loadProposal() {
    loading = true;
    error = null;
    try {
      [proposal, votes] = await Promise.all([
        api.getProposal(orgId, pid),
        api.getVotes(orgId, pid),
      ]);
      checkIfUserVoted();
    } catch (e: any) {
      error = e instanceof Error ? e.message : "Failed to load proposal";
    } finally {
      loading = false;
    }
  }

  function checkIfUserVoted() {
    if (!votes || votes.length === 0) {
      voted = false;
      userVote = null;
      return;
    }

    const userVoted = votes.find((v: any) => v.isCurrentUser === true);
    if (userVoted) {
      voted = true;
      userVote = userVoted;
    }
  }

  async function submitVote() {
    if (!voteChoice) return;
    voting = true;
    voteError = "";
    voteSuccess = "";
    try {
      await api.castVote(orgId, pid, voteChoice as "yea" | "nay" | "abstain", voteReason || undefined);
      voted = true;
      
      // Refresh proposal and votes to show updated tallies
      await loadProposal();
      
      voteSuccess = `✓ Your ${voteChoice} vote has been recorded!`;
      voteChoice = "";
      voteReason = "";
      
      setTimeout(() => { voteSuccess = ""; }, 4000);
    } catch (e) {
      voteError = e instanceof Error ? e.message : "Failed to cast vote";
    } finally {
      voting = false;
    }
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleString();
  }

  function isVotingClosed() {
    return proposal.status !== "voting" && proposal.status !== "open";
  }

  const statusColors: Record<string, string> = {
    draft: "badge-yellow", 
    open: "badge-blue", 
    voting: "badge-blue",
    passed: "badge-green", 
    failed: "badge-red",
  };
</script>

{#if loading}
  <SkeletonLoader />
{:else if error}
  <ErrorDisplay message={error} onRetry={loadProposal} />
{:else if proposal}
  <div>
    <a href="/org/{orgId}/proposals" class="back">← All Proposals</a>

    <header class="page-header">
      <div>
        <h1>{proposal.title}</h1>
        <div class="meta">
          <span class="badge {statusColors[proposal.status] ?? ''}">{proposal.status}</span>
          <span class="mono type">{proposal.type}</span>
          <span class="created-date">Created {formatDate(proposal.createdAt)}</span>
        </div>
      </div>
    </header>

    <div class="content-grid">
      <div class="main-col">
        <div class="card">
          <h3>Proposal</h3>
          <p class="body-text">{proposal.body}</p>
        </div>

        {#if proposal.aiAnalysis}
          <div class="card ai-card">
            <h3>🤖 SAR Analysis</h3>
            <div class="ai-content">
              <p><strong>Summary:</strong> {proposal.aiAnalysis.summary}</p>
              <p><strong>Recommendation:</strong> {proposal.aiAnalysis.recommendation}</p>
              <p>
                <strong>Risk Level:</strong> 
                <span class="badge {proposal.aiAnalysis.riskLevel === 'low' ? 'badge-green' : proposal.aiAnalysis.riskLevel === 'high' ? 'badge-red' : 'badge-yellow'}">
                  {proposal.aiAnalysis.riskLevel}
                </span>
              </p>
            </div>
          </div>
        {/if}

        <div class="card">
          <h3>Vote Record ({votes.length})</h3>
          {#if votes.length > 0}
            <div class="vote-list">
              {#each votes as v}
                <div class="vote-entry" class:user-vote={v.isCurrentUser}>
                  <span class="vote-icon">{v.vote === "yea" ? "👍" : v.vote === "nay" ? "👎" : "⏸"}</span>
                  <div class="vote-info">
                    <span class="vote-value">{v.vote}</span>
                    {#if v.reason}
                      <span class="vote-reason">{v.reason}</span>
                    {/if}
                    {#if v.isCurrentUser}
                      <span class="your-vote-badge">Your vote</span>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <p class="empty">No votes yet.</p>
          {/if}
        </div>
      </div>

      <div class="side-col">
        <div class="card tally-card">
          <h3>Vote Tally</h3>
          <div class="tally-grid">
            <div class="tally-item for">
              <div class="stat-value">{proposal.votesFor ?? 0}</div>
              <div class="stat-label">For</div>
            </div>
            <div class="tally-item against">
              <div class="stat-value">{proposal.votesAgainst ?? 0}</div>
              <div class="stat-label">Against</div>
            </div>
            <div class="tally-item abstain">
              <div class="stat-value">{proposal.abstain ?? 0}</div>
              <div class="stat-label">Abstain</div>
            </div>
          </div>
          
          {#if proposal.votingEnds}
            <p class="voting-deadline">
              {isVotingClosed() ? "Voting ended" : "Voting ends"}: 
              <strong>{formatDate(proposal.votingEnds)}</strong>
            </p>
          {/if}

          {#if proposal.status === "passed"}
            <div class="status-badge passed">✓ Proposal Passed</div>
          {:else if proposal.status === "failed"}
            <div class="status-badge failed">✗ Proposal Failed</div>
          {/if}
        </div>

        {#if voted}
          <div class="card voted-card">
            <h3>✓ You've Voted</h3>
            <p class="vote-confirmation">Your vote: <strong>{userVote?.vote.toUpperCase()}</strong></p>
            {#if userVote?.reason}
              <p class="your-reason">"{userVote.reason}"</p>
            {/if}
          </div>
        {:else if (proposal.status === "voting" || proposal.status === "open")}
          <div class="card vote-card">
            <h3>Cast Your Vote</h3>
            
            {#if voteError}
              <div class="vote-error">
                <span>⚠ {voteError}</span>
              </div>
            {/if}

            {#if voteSuccess}
              <div class="vote-success">
                <span>{voteSuccess}</span>
              </div>
            {/if}

            <div class="vote-options">
              <button 
                class="vote-btn yea" 
                class:selected={voteChoice === "yea"} 
                onclick={() => voteChoice = "yea"}
                disabled={voting}
              >
                👍 Yea
              </button>
              <button 
                class="vote-btn nay" 
                class:selected={voteChoice === "nay"} 
                onclick={() => voteChoice = "nay"}
                disabled={voting}
              >
                👎 Nay
              </button>
              <button 
                class="vote-btn abs" 
                class:selected={voteChoice === "abstain"} 
                onclick={() => voteChoice = "abstain"}
                disabled={voting}
              >
                ⏸ Abstain
              </button>
            </div>

            <textarea 
              placeholder="Add a reason for your vote (optional)" 
              bind:value={voteReason}
              rows="2"
              disabled={voting}
            ></textarea>

            <button 
              class="btn btn-primary full" 
              onclick={submitVote} 
              disabled={!voteChoice || voting}
            >
              {voting ? "Submitting..." : "Submit Vote"}
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{:else}
  <ErrorDisplay message="Proposal not found" onRetry={loadProposal} />
{/if}

<style>
  .back { 
    font-size: 13px; 
    color: var(--ink3); 
    display: inline-block; 
    margin-bottom: 16px; 
    text-decoration: none;
    cursor: pointer;
    transition: color 0.15s;
  }

  .back:hover { 
    color: var(--ink2); 
  }
  
  .page-header { 
    margin-bottom: 28px; 
  }

  .page-header h1 {
    margin: 0 0 12px 0;
    font-size: 28px;
  }

  .meta { 
    display: flex; 
    align-items: center; 
    gap: 12px; 
    font-size: 13px; 
    color: var(--ink3); 
    flex-wrap: wrap; 
  }

  .type { 
    font-size: 11px; 
  }

  .created-date {
    display: inline-block;
  }

  .content-grid { 
    display: grid; 
    grid-template-columns: 1fr 340px; 
    gap: 24px; 
  }

  .main-col { 
    display: flex; 
    flex-direction: column; 
    gap: 16px; 
  }

  .side-col { 
    display: flex; 
    flex-direction: column; 
    gap: 16px; 
  }

  .body-text { 
    margin-top: 12px; 
    font-size: 14px; 
    line-height: 1.7; 
    color: var(--ink2); 
    white-space: pre-wrap; 
    word-wrap: break-word;
  }

  .ai-card { 
    border-left: 3px solid var(--gold); 
  }

  .ai-content {
    margin-top: 12px;
  }

  .ai-card p { 
    margin: 8px 0; 
    font-size: 13px; 
    line-height: 1.5; 
  }

  .vote-list { 
    display: flex; 
    flex-direction: column; 
    gap: 8px; 
  }

  .vote-entry { 
    display: flex; 
    align-items: flex-start; 
    gap: 12px; 
    padding: 12px; 
    border-radius: var(--radius); 
    background: var(--paper2); 
    font-size: 13px;
    border-left: 3px solid var(--border);
  }

  .vote-entry.user-vote { 
    border-left-color: var(--gold); 
    background: #fef9f0; 
  }

  .vote-icon { 
    font-size: 18px;
    min-width: 20px;
  }

  .vote-info { 
    display: flex; 
    flex-direction: column; 
    gap: 4px; 
    flex: 1; 
  }

  .vote-value { 
    font-weight: 600;
    color: var(--ink2);
  }

  .vote-reason { 
    color: var(--ink3); 
    font-style: italic;
    font-size: 12px;
  }

  .your-vote-badge {
    font-size: 11px;
    color: var(--gold);
    font-weight: 600;
  }

  .empty { 
    color: var(--ink3); 
    font-size: 13px; 
    padding: 16px 0; 
  }

  .tally-card .tally-grid { 
    display: grid; 
    grid-template-columns: 1fr 1fr 1fr; 
    gap: 12px; 
    margin-top: 16px; 
  }

  .tally-item {
    text-align: center;
    padding: 12px 8px;
    border-radius: var(--radius);
    background: var(--paper2);
  }

  .tally-item.for {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
  }

  .tally-item.against {
    background: #fef2f2;
    border: 1px solid #fecaca;
  }

  .tally-item.abstain {
    background: #fef9f0;
    border: 1px solid #fed7aa;
  }

  .stat-value { 
    font-size: 28px; 
    font-weight: 700; 
    color: var(--navy); 
  }

  .stat-label { 
    font-size: 11px; 
    color: var(--ink3); 
    margin-top: 4px;
    font-weight: 500;
  }

  .voting-deadline { 
    font-size: 12px; 
    color: var(--ink3); 
    margin-top: 16px; 
  }

  .status-badge {
    margin-top: 16px;
    padding: 12px;
    border-radius: var(--radius);
    text-align: center;
    font-weight: 600;
    font-size: 14px;
  }

  .status-badge.passed {
    background: #dcfce7;
    color: #166534;
    border: 1px solid #86efac;
  }

  .status-badge.failed {
    background: #fee2e2;
    color: #991b1b;
    border: 1px solid #fecaca;
  }

  .voted-card { 
    background: #f0fdf4; 
    border: 1px solid #86efac;
  }

  .voted-card h3 { 
    color: #166534;
    margin: 0 0 12px 0;
  }

  .vote-confirmation {
    font-size: 13px;
    color: var(--ink2);
    margin: 0;
  }

  .your-reason { 
    color: var(--ink3); 
    font-style: italic;
    margin: 8px 0 0;
    font-size: 12px;
  }

  .vote-error { 
    background: #fef2f2; 
    border: 1px solid #fca5a5; 
    color: #991b1b; 
    padding: 10px 12px;
    border-radius: var(--radius); 
    margin-bottom: 12px; 
    font-size: 12px;
  }

  .vote-success {
    background: #f0fdf4;
    border: 1px solid #86efac;
    color: #166534;
    padding: 10px 12px;
    border-radius: var(--radius);
    margin-bottom: 12px;
    font-size: 12px;
  }

  .vote-card textarea { 
    width: 100%; 
    margin-top: 12px; 
    padding: 10px 12px; 
    border: 1px solid var(--border); 
    border-radius: var(--radius);
    font-family: inherit;
    font-size: 13px;
  }

  .vote-card textarea:focus {
    outline: none;
    border-color: var(--navy);
    box-shadow: 0 0 0 3px rgba(30, 45, 74, 0.1);
  }

  .vote-card textarea:disabled {
    opacity: 0.7;
  }

  .vote-card .full { 
    margin-top: 12px;
  }

  .vote-options { 
    display: flex; 
    gap: 8px; 
    margin-top: 12px; 
  }

  .vote-btn {
    flex: 1; 
    padding: 12px; 
    border: 1px solid var(--border); 
    border-radius: 8px;
    font-size: 14px; 
    text-align: center; 
    transition: all 0.15s; 
    background: white;
    cursor: pointer;
    font-weight: 500;
  }

  .vote-btn:hover:not(:disabled) { 
    border-color: var(--navy); 
  }

  .vote-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .vote-btn.selected.yea { 
    background: #dcfce7; 
    border-color: #166534;
    color: #166534;
  }

  .vote-btn.selected.nay { 
    background: #fee2e2; 
    border-color: #991b1b;
    color: #991b1b;
  }

  .vote-btn.selected.abs { 
    background: #fef3c7; 
    border-color: #92400e;
    color: #92400e;
  }

  .full { 
    width: 100%; 
    justify-content: center; 
  }

  @media (max-width: 768px) {
    .content-grid { 
      grid-template-columns: 1fr; 
    }

    .side-col { 
      order: -1; 
    }

    .meta { 
      flex-direction: column; 
      align-items: flex-start; 
    }

    .page-header h1 {
      font-size: 24px;
    }

    .tally-grid {
      grid-template-columns: 1fr !important;
    }
  }
</style>
