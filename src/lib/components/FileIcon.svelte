<script lang="ts">
  /* eslint-disable svelte/no-at-html-tags */
  import { getIcon } from "material-file-icons";

  interface Props {
    filename: string;
    size?: number;
  }

  let { filename, size = 14 }: Props = $props();

  const icon = $derived(getIcon(filename));
</script>

<span
  class="inline-flex shrink-0 items-center justify-center"
  style="width: {size}px; height: {size}px;"
>
  {@html icon.svg}
</span>

<style>
  span :global(svg) {
    width: 100%;
    height: 100%;
  }
</style>
