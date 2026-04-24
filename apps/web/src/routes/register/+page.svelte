<script lang="ts">
  let name = $state("");
  let email = $state("");
  let password = $state("");
  let confirmPassword = $state("");
  let error = $state("");
  let loading = $state(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = "";
    if (password !== confirmPassword) {
      error = "Passwords do not match";
      return;
    }
    loading = true;
    try {
      const { register } = await import("$lib/stores/auth.svelte.ts");
      await register(email, password, name);
      window.location.href = "/";
    } catch (err: any) {
      error = err.message ?? "Registration failed";
    } finally {
      loading = false;
    }
  }
</script>

<div class="page">
  <div class="card register-card">
    <div class="logo">Π</div>
    <h1>Create Account</h1>
    <p class="subtitle">Join POLIS governance</p>

    {#if error}
      <div class="error">{error}</div>
    {/if}

    <form onsubmit={handleSubmit}>
      <label>
        <span>Full Name</span>
        <input type="text" bind:value={name} required placeholder="Your name" />
      </label>
      <label>
        <span>Email</span>
        <input type="email" bind:value={email} required placeholder="you@example.com" />
      </label>
      <label>
        <span>Password</span>
        <input type="password" bind:value={password} required minlength="8" placeholder="••••••••" />
      </label>
      <label>
        <span>Confirm Password</span>
        <input type="password" bind:value={confirmPassword} required placeholder="••••••••" />
      </label>
      <button class="btn btn-primary full" type="submit" disabled={loading}>
        {loading ? "Creating..." : "Create Account"}
      </button>
    </form>

    <p class="footer">
      Already have an account? <a href="/login">Sign in</a>
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
  .register-card { width: 400px; text-align: center; }
  .logo {
    width: 56px; height: 56px;
    background: var(--navy); color: white;
    display: flex; align-items: center; justify-content: center;
    font-family: "DM Serif Display", serif; font-size: 32px;
    border-radius: 12px; margin: 0 auto 16px;
  }
  h1 { font-family: "DM Serif Display", serif; letter-spacing: 0.15em; margin-bottom: 4px; }
  .subtitle { color: var(--ink3); font-size: 14px; margin-bottom: 24px; }
  .error { background: #fee2e2; color: #991b1b; padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 16px; }
  form { display: flex; flex-direction: column; gap: 16px; }
  label { display: flex; flex-direction: column; gap: 6px; text-align: left; font-size: 13px; font-weight: 500; color: var(--ink2); }
  .full { width: 100%; justify-content: center; }
  .footer { margin-top: 20px; font-size: 13px; color: var(--ink3); }
</style>
