<script lang="ts">
  import type { PageData } from "./$types";
  import FileBrowser from "$lib/components/FileBrowser.svelte";

  interface Props {
    data: PageData;
  }
  let { data }: Props = $props();
</script>

<svelte:head>
  <title>HCDN | /</title>
</svelte:head>

<FileBrowser path="" username={data.user?.username ?? ""} />
