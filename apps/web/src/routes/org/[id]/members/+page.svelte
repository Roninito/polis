<script lang="ts">
  import { page } from "$app/stores";
  import { api } from "$lib/api/client";
  import { onMount } from "svelte";
  import ErrorDisplay from "$lib/components/ErrorDisplay.svelte";
  import SkeletonLoader from "$lib/components/SkeletonLoader.svelte";

  let orgId = $derived($page.params.id);
  let members = $state<any[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let showInvite = $state(false);
  let inviteError = $state<string | null>(null);
  let newName = $state("");
  let newEmail = $state("");
  let newRole = $state("member");

  onMount(async () => {
    await loadMembers();
  });

  async function loadMembers() {
    loading = true;
    error = null;
    try {
      members = await api.listMembers(orgId);
    } catch (e: any) {
      error = e instanceof Error ? e.message : "Failed to load members";
    } finally {
      loading = false;
    }
  }

  async function invite() {
    if (!newName) return;
    inviteError = null;
    try {
      const member = await api.addMember(orgId, { name: newName, email: newEmail || undefined, role: newRole });
      members = [...members, member];
      showInvite = false;
      newName = ""; newEmail = ""; newRole = "member";
    } catch (e: any) {
      inviteError = e instanceof Error ? e.message : "Failed to invite member";
    }
  }

  const roleColors: Record<string, string> = {
    founder: "badge-yellow", admin: "badge-blue", council: "badge-green", member: "badge-green", observer: "badge-yellow",
  };
</script>

<div>
  <header class="page-header">
    <h1>Members</h1>
    <button class="btn btn-primary" onclick={() => showInvite = !showInvite}>+ Invite Member</button>
  </header>

  {#if showInvite}
    <div class="card invite-form">
      <h3>Invite New Member</h3>
      {#if inviteError}
        <div class="error-message">{inviteError}</div>
      {/if}
      <div class="form-row">
        <input placeholder="Full name" bind:value={newName} />
        <input placeholder="Email (optional)" bind:value={newEmail} type="email" />
        <select bind:value={newRole}>
          <option value="member">Member</option>
          <option value="council">Council</option>
          <option value="admin">Admin</option>
          <option value="observer">Observer</option>
        </select>
        <button class="btn btn-gold" onclick={invite}>Add</button>
      </div>
    </div>
  {/if}

  {#if loading}
    <SkeletonLoader type="table" count={5} />
  {:else if error}
    <ErrorDisplay message={error} onRetry={loadMembers} />
  {:else}
    <div class="card">
      <table class="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          {#each members as m}
            <tr>
              <td><a href="/org/{orgId}/members/{m.id}">{m.name}</a></td>
              <td class="mono">{m.email ?? "—"}</td>
              <td><span class="badge {roleColors[m.role] ?? ''}">{m.role}</span></td>
              <td><span class="badge {m.status === 'active' ? 'badge-green' : 'badge-red'}">{m.status}</span></td>
              <td>{new Date(m.joinedAt).toLocaleDateString()}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      {#if members.length === 0}
        <p class="empty">No members yet. Invite someone to get started.</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
  .invite-form { margin-bottom: 16px; }
  .invite-form h3 { margin-bottom: 12px; }
  .error-message { color: var(--red); background: #fee2e2; padding: 12px; border-radius: 8px; margin-bottom: 12px; font-size: 14px; }
  .form-row { display: flex; gap: 10px; }
  .form-row input, .form-row select { flex: 1; }

  .table { width: 100%; border-collapse: collapse; font-size: 14px; }
  .table th {
    text-align: left; padding: 10px 12px; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.08em;
    color: var(--ink3); border-bottom: 1px solid var(--border);
  }
  .table td { padding: 12px; border-bottom: 1px solid var(--paper2); }
  .table tr:hover td { background: var(--paper); }
  .empty { text-align: center; color: var(--ink3); padding: 32px; }
</style>
