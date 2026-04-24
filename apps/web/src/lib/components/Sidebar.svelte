<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props { orgId: string; orgName?: string; children: Snippet; }
  let { orgId, orgName = "POLIS", children }: Props = $props();

  const navItems = [
    { icon: "◎", label: "Dashboard", href: `/org/${orgId}` },
    { icon: "👥", label: "Members", href: `/org/${orgId}/members` },
    { icon: "📋", label: "Proposals", href: `/org/${orgId}/proposals` },
    { icon: "📜", label: "Constitution", href: `/org/${orgId}/constitution` },
    { icon: "💰", label: "Treasury", href: `/org/${orgId}/treasury` },
    { icon: "🤖", label: "SAR Log", href: `/org/${orgId}/sar` },
  ];

  let currentPath = $state("");
  if (typeof window !== "undefined") {
    currentPath = window.location.pathname;
  }
</script>

<div class="app">
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-mark">Π</div>
      <div>
        <div class="brand-name">{orgName}</div>
        <div class="brand-sub">Governance Engine</div>
      </div>
    </div>

    <nav class="nav">
      {#each navItems as item}
        <a
          class="nav-item"
          class:active={currentPath === item.href || (item.href !== `/org/${orgId}` && currentPath.startsWith(item.href))}
          href={item.href}
        >
          <span class="nav-icon">{item.icon}</span>
          {item.label}
        </a>
      {/each}
    </nav>

    <div class="me-card">
      <div class="avatar" style="width:32px;height:32px;font-size:13px;">U</div>
      <div>
        <div class="me-name">User</div>
        <div class="me-role">member</div>
      </div>
    </div>
  </aside>

  <main class="main">
    {@render children()}
  </main>
</div>

<style>
  .app { display: flex; height: 100vh; overflow: hidden; }

  .sidebar {
    width: 220px;
    min-width: 220px;
    background: #1a1a1a;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 24px 20px 20px;
    border-bottom: 1px solid #2e2e2e;
  }

  .brand-mark {
    width: 36px;
    height: 36px;
    background: #e8e4d9;
    color: #1a1a1a;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: "DM Serif Display", serif;
    font-size: 22px;
    border-radius: 6px;
  }

  .brand-name {
    font-family: "DM Serif Display", serif;
    font-size: 18px;
    color: #e8e4d9;
    letter-spacing: 0.08em;
  }

  .brand-sub {
    font-size: 10px;
    color: #555;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-top: 1px;
  }

  .nav { flex: 1; padding: 12px 0; overflow-y: auto; }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 20px;
    color: #888;
    font-size: 13px;
    text-decoration: none;
    transition: all 0.15s;
    position: relative;
  }
  .nav-item:hover { color: #ccc; background: #232323; text-decoration: none; }
  .nav-item.active { color: #e8e4d9; background: #252525; }
  .nav-item.active::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 2px;
    background: #e8e4d9;
  }

  .nav-icon { font-size: 14px; width: 16px; text-align: center; }

  .me-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    border-top: 1px solid #2e2e2e;
    background: #161616;
  }

  .me-name { font-size: 13px; color: #ccc; font-weight: 500; }
  .me-role { font-size: 10px; color: #555; margin-top: 1px; }

  .avatar {
    border-radius: 50%;
    background: #e8e4d9;
    color: #1a1a1a;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: "DM Mono", monospace;
    font-weight: 500;
  }

  .main {
    flex: 1;
    overflow-y: auto;
    padding: 32px 40px;
    background: var(--paper);
  }
</style>
