<script lang="ts">
  export let type: "card" | "table" | "text" = "card";
  export let count: number = 3;
</script>

{#if type === "card"}
  <div class="skeleton-grid">
    {#each { length: count } as _}
      <div class="skeleton-card">
        <div class="skeleton-line skeleton-title"></div>
        <div class="skeleton-line skeleton-subtitle"></div>
        <div class="skeleton-line"></div>
      </div>
    {/each}
  </div>
{:else if type === "table"}
  <div class="skeleton-table">
    <div class="skeleton-row header">
      <div class="skeleton-cell skeleton-title"></div>
      <div class="skeleton-cell skeleton-title"></div>
      <div class="skeleton-cell skeleton-title"></div>
    </div>
    {#each { length: count } as _}
      <div class="skeleton-row">
        <div class="skeleton-cell"></div>
        <div class="skeleton-cell"></div>
        <div class="skeleton-cell"></div>
      </div>
    {/each}
  </div>
{:else}
  <div class="skeleton-text">
    {#each { length: count } as _}
      <div class="skeleton-line"></div>
    {/each}
  </div>
{/if}

<style>
  @keyframes shimmer {
    0% {
      background-position: -1000px 0;
    }
    100% {
      background-position: 1000px 0;
    }
  }

  .skeleton-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 24px;
    animation: shimmer 2s infinite;
  }

  .skeleton-card {
    background: white;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 24px;
    box-shadow: var(--shadow);
  }

  .skeleton-table {
    background: white;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: var(--shadow);
  }

  .skeleton-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    padding: 16px 24px;
    border-bottom: 1px solid var(--border);
  }

  .skeleton-row.header {
    background: var(--paper2);
  }

  .skeleton-row:last-child {
    border-bottom: none;
  }

  .skeleton-cell {
    height: 16px;
  }

  .skeleton-line {
    height: 16px;
    background: linear-gradient(
      90deg,
      var(--paper2) 25%,
      var(--paper3) 50%,
      var(--paper2) 75%
    );
    background-size: 1000px 100%;
    border-radius: 4px;
    margin-bottom: 12px;
  }

  .skeleton-line:last-child {
    margin-bottom: 0;
  }

  .skeleton-line.skeleton-title {
    height: 20px;
    margin-bottom: 16px;
  }

  .skeleton-line.skeleton-subtitle {
    height: 14px;
    width: 80%;
    margin-bottom: 12px;
  }

  .skeleton-text {
    background: white;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 24px;
    box-shadow: var(--shadow);
  }

  .skeleton-text .skeleton-line {
    width: 100%;
  }

  .skeleton-text .skeleton-line:nth-child(3),
  .skeleton-text .skeleton-line:nth-child(4) {
    width: 90%;
  }
</style>
