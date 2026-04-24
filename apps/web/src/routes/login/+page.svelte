<script lang="ts">
  let email = $state("");
  let password = $state("");
  let error = $state("");
  let loading = $state(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = "";
    loading = true;
    try {
      const { login } = await import("$lib/stores/auth.svelte.ts");
      await login(email, password);
      // Redirect to home which will resolve the user's org
      window.location.href = "/";
    } catch (err: any) {
      error = err.message ?? "Login failed";
    } finally {
      loading = false;
    }
  }
</script>

<div class="page">
  <div class="card login-card">
    <div class="logo">Π</div>
    <h1>POLIS</h1>
    <p class="subtitle">Sign in to your governance account</p>

    {#if error}
      <div class="error">{error}</div>
    {/if}

    <form onsubmit={handleSubmit}>
      <label>
        <span>Email</span>
        <input type="email" bind:value={email} required placeholder="you@example.com" />
      </label>
      <label>
        <span>Password</span>
        <input type="password" bind:value={password} required placeholder="••••••••" />
      </label>
      <button class="btn btn-primary full" type="submit" disabled={loading}>
        {loading ? "Signing in..." : "Sign In"}
      </button>
    </form>

    <p class="footer">
      Don't have an account? <a href="/register">Register</a>
    </p>
  </div>
</div>

<style>
  .page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--paper);
  }
  .login-card {
    width: 400px;
    text-align: center;
  }
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
  h1 {
    font-family: "DM Serif Display", serif;
    letter-spacing: 0.15em;
    margin-bottom: 4px;
  }
  .subtitle { color: var(--ink3); font-size: 14px; margin-bottom: 24px; }
  .error {
    background: #fee2e2;
    color: #991b1b;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 13px;
    margin-bottom: 16px;
  }
  form { display: flex; flex-direction: column; gap: 16px; }
  label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    text-align: left;
    font-size: 13px;
    font-weight: 500;
    color: var(--ink2);
  }
  .full { width: 100%; justify-content: center; }
  .footer { margin-top: 20px; font-size: 13px; color: var(--ink3); }
</style>
