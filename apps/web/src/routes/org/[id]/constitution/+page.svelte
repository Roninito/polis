<script lang="ts">
  import { page } from "$app/stores";
  import { api } from "$lib/api/client";
  import ErrorDisplay from "$lib/components/ErrorDisplay.svelte";
  import SkeletonLoader from "$lib/components/SkeletonLoader.svelte";
  import { onMount } from "svelte";

  let orgId = $derived($page.params.id);
  let constitution = $state<any>(null);
  let laws = $state<any[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let expandedArticles = $state<Set<number>>(new Set());

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    loading = true;
    error = null;
    try {
      [constitution, laws] = await Promise.all([
        api.getConstitution(orgId),
        api.getLaws(orgId),
      ]);
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load constitution";
    } finally {
      loading = false;
    }
  }

  function toggleArticle(number: number) {
    if (expandedArticles.has(number)) {
      expandedArticles.delete(number);
    } else {
      expandedArticles.add(number);
    }
    expandedArticles = expandedArticles;
  }
</script>

<div>
  <h1>Constitution</h1>

  {#if loading}
    <SkeletonLoader type="card" count={3} />
  {:else if error}
    <ErrorDisplay message={error} onRetry={loadData} />
  {:else}
    {#if constitution}
      <div class="card constitution-card">
        <div class="version-badge">
          <span class="badge badge-blue">Version {constitution.version}</span>
          {#if constitution.ratifiedAt}
            <span class="date">Ratified {new Date(constitution.ratifiedAt).toLocaleDateString()}</span>
          {/if}
        </div>

        {#if constitution.preamble}
          <blockquote class="preamble">{constitution.preamble}</blockquote>
        {/if}

        {#if constitution.articles?.length}
          <div class="articles">
            <h2>Articles</h2>
            {#each constitution.articles as article}
              <button 
                class="article-button"
                class:expanded={expandedArticles.has(article.number)}
                onclick={() => toggleArticle(article.number)}
              >
                <div class="article-header">
                  <h3>Article {article.number} — {article.title}</h3>
                  <span class="expand-icon">{expandedArticles.has(article.number) ? '▼' : '▶'}</span>
                </div>
                {#if expandedArticles.has(article.number)}
                  <p class="article-body">{article.body}</p>
                {/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {:else}
      <div class="card">
        <p class="empty">No constitution has been ratified yet.</p>
      </div>
    {/if}

    <h2 style="margin-top: 32px; margin-bottom: 16px;">Operating Laws</h2>
    {#if laws.length > 0}
      <div class="laws">
        {#each laws as law}
          <div class="card law-card">
            <div class="law-header">
              <h3>{law.title}</h3>
              <span class="badge {law.status === 'active' ? 'badge-green' : 'badge-red'}">{law.status}</span>
            </div>
            <p>{law.body}</p>
            {#if law.enactedAt}
              <span class="date">Enacted {new Date(law.enactedAt).toLocaleDateString()}</span>
            {/if}
          </div>
        {/each}
      </div>
    {:else}
      <div class="card"><p class="empty">No operating laws enacted.</p></div>
    {/if}
  {/if}
</div>

<style>
  h1 { margin-bottom: 24px; }
  .constitution-card { position: relative; }
  .version-badge { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  .date { font-size: 12px; color: var(--ink3); }
  .preamble {
    border-left: 3px solid var(--gold);
    padding: 16px 20px;
    margin: 16px 0;
    font-style: italic;
    color: var(--ink2);
    line-height: 1.7;
    background: var(--paper);
    border-radius: 0 8px 8px 0;
  }
  .articles { display: flex; flex-direction: column; gap: 0; margin-top: 20px; }
  .articles h2 { margin-bottom: 16px; }
  .article-button {
    background: none;
    border: none;
    padding: 0;
    text-align: left;
    cursor: pointer;
    margin-bottom: 1px;
  }
  .article-button:hover {
    background-color: var(--paper);
  }
  .article-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid var(--border);
  }
  .article-header h3 {
    color: var(--navy);
    margin: 0;
    flex: 1;
  }
  .expand-icon {
    color: var(--ink3);
    font-size: 12px;
    transition: transform 0.2s;
  }
  .article-button.expanded .expand-icon {
    transform: rotate(90deg);
  }
  .article-body {
    font-size: 14px;
    line-height: 1.7;
    color: var(--ink2);
    padding: 12px 0 12px 0;
    margin: 0;
  }

  .laws { display: flex; flex-direction: column; gap: 12px; }
  .law-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .law-card p { font-size: 13px; line-height: 1.6; color: var(--ink2); }
  .empty { text-align: center; color: var(--ink3); padding: 32px; }
</style>
