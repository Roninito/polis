<script lang="ts">
</script>

<div class="spinner-container">
  <div class="spinner"></div>
</div>

<style>
  .spinner-container {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px;
  }

  .spinner {
    border: 4px solid var(--paper2);
    border-top: 4px solid var(--navy);
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style>
