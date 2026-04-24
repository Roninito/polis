<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { api } from "$lib/api/client";

  let loading = $state(true);
  let error = $state("");

  onMount(async () => {
    // Restore auth token
    try {
      const stored = localStorage.getItem("polis_auth");
      if (!stored) {
        goto("/login");
        return;
      }
      const parsed = JSON.parse(stored);
      if (!parsed.accessToken) {
        goto("/login");
        return;
      }
      api.setToken(parsed.accessToken);

      const orgs = await api.listMyOrgs();
      if (orgs.length > 0) {
        goto(`/org/${orgs[0].id}`);
      } else {
        error = "You don't belong to any organizations yet.";
        loading = false;
      }
    } catch (e: any) {
      // Token expired or invalid
      localStorage.removeItem("polis_auth");
      goto("/login");
    }
  });
</script>

<div class="page">
  {#if loading && !error}
    <div class="loader">
      <div class="logo">Π</div>
      <p>Loading...</p>
    </div>
  {:else if error}
    <div class="loader">
      <div class="logo">Π</div>
      <h1>POLIS</h1>
      <p class="error">{error}</p>
      <a href="/login" class="btn btn-primary">Sign In</a>
    </div>
  {/if}
</div>

<style>
  .page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--paper);
  }
  .loader { text-align: center; }
  .logo {
    width: 56px;
    height: 56px;
    background: var(--navy);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: "DM Serif Display", serif;
    font-size: 32px;
    border-radius: 12px;
    margin: 0 auto 16px;
  }
  h1 { font-family: "DM Serif Display", serif; letter-spacing: 0.15em; }
  .error { color: var(--ink3); margin: 12px 0 20px; }
</style>
