<script lang="ts">
  import Sidebar from "$lib/components/Sidebar.svelte";
  import { page } from "$app/stores";
  let { children } = $props();

  let orgId = $derived($page.params.id ?? "default");
</script>

<Sidebar {orgId}>
  {@render children()}
</Sidebar>
