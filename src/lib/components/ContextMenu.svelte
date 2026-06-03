<script lang="ts">
  import type { Component } from "svelte";

  export interface MenuItem {
    icon: Component;
    label: string;
    color?: string;
    action: () => void;
  }

  export type MenuEntry = MenuItem | { separator: true };

  interface Props {
    items: MenuEntry[];
    x: number;
    y: number;
    onClose: () => void;
  }

  let { items, x, y, onClose }: Props = $props();

  let menuEl = $state<HTMLDivElement | null>(null);
  let left = $state(0);
  let top = $state(0);
  let visible = $state(false);

  $effect(() => {
    if (!menuEl) return;
    const rect = menuEl.getBoundingClientRect();
    const pad = 8;
    let nx = x;
    let ny = y;
    if (nx + rect.width > window.innerWidth - pad) nx = window.innerWidth - rect.width - pad;
    if (ny + rect.height > window.innerHeight - pad) ny = window.innerHeight - rect.height - pad;
    if (nx < pad) nx = pad;
    if (ny < pad) ny = pad;
    left = nx;
    top = ny;
    visible = true;
  });
</script>

<svelte:window onclick={onClose} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  bind:this={menuEl}
  class="fixed z-100 min-w-40 animate-[fadeUp_0.12s_ease_both] border border-(--border) bg-(--surface) py-1 transition-opacity duration-75"
  class:opacity-0={!visible}
  class:opacity-100={visible}
  style="left: {left}px; top: {top}px"
  onclick={(e) => e.stopPropagation()}
>
  {#each items as entry, i (i)}
    {#if "separator" in entry}
      <div class="mx-0 my-1 h-px bg-(--border)"></div>
    {:else}
      {@const Icon = entry.icon}
      <button
        class="context-item flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-3.5 py-1.75 text-left font-mono text-sm text-(--muted) transition-[color,background] hover:bg-white/4"
        style="--hover-color: {entry.color ?? 'var(--text)'}"
        onclick={() => {
          entry.action();
          onClose();
        }}
      >
        <Icon size={12} />
        {entry.label}
      </button>
    {/if}
  {/each}
</div>

<style>
  .context-item:hover {
    color: var(--hover-color, var(--text));
  }
</style>
