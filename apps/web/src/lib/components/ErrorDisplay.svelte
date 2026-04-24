<script lang="ts">
  export let message: string = "An error occurred";
  export let onRetry: (() => void) | undefined = undefined;
</script>

<div class="error-display">
  <div class="error-icon">⚠</div>
  <h3>Something went wrong</h3>
  <p class="error-message">{message}</p>
  {#if onRetry}
    <button class="btn btn-primary" onclick={onRetry}>Try Again</button>
  {/if}
</div>

<style>
  .error-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 32px;
    text-align: center;
    background: #fef2f2;
    border: 1px solid #fca5a5;
    border-radius: var(--radius-lg);
    color: var(--ink);
  }

  .error-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  h3 {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--red);
  }

  .error-message {
    font-size: 14px;
    color: var(--ink2);
    margin-bottom: 24px;
    max-width: 500px;
    line-height: 1.5;
  }
</style>
