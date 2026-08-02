<script lang="ts" module>
  import type { Component } from "svelte";

  export interface MenuItem {
    icon: Component;
    label: string;
    color?: string;
    action: () => void;
  }

  export type MenuEntry = MenuItem | { separator: true };
</script>

<script lang="ts">
  import { mobile } from "$lib/viewport.svelte";

  interface Props {
    items: MenuEntry[];
    x: number;
    y: number;
    /** Shown as the sheet heading on touch layouts. */
    title?: string;
    onClose: () => void;
  }

  let { items, x, y, title = "", onClose }: Props = $props();

  let menuEl = $state<HTMLDivElement | null>(null);
  let left = $state(0);
  let top = $state(0);
  let visible = $state(false);

  $effect(() => {
    if (mobile.current || !menuEl) return;
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

  const run = (entry: MenuItem) => {
    entry.action();
    onClose();
  };

  // Click-outside only applies to the desktop popup; the sheet has a backdrop.
  const onWindowClick = () => {
    if (!mobile.current) onClose();
  };
</script>

<svelte:window onclick={onWindowClick} />

{#if mobile.current}
  <!-- Touch: a bottom action sheet, so every target clears 48px and nothing
       ends up pinned under a finger at the edge of the screen. -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-100 animate-[backdropIn_0.15s_ease] bg-black/60"
    onclick={onClose}
  ></div>
  <div
    class="app-chrome fixed inset-x-0 bottom-0 z-100 flex max-h-[80dvh] animate-[sheetUp_0.2s_cubic-bezier(0.32,0.72,0,1)] flex-col border-t border-(--border) bg-(--surface) pb-(--safe-bottom)"
    role="dialog"
    aria-modal="true"
  >
    {#if title}
      <div
        class="shrink-0 truncate border-b border-(--border) px-4 py-3 font-mono text-sm text-(--text)"
      >
        {title}
      </div>
    {/if}
    <div class="scroll-touch min-h-0 flex-1 overflow-y-auto py-1">
      {#each items as entry, i (i)}
        {#if "separator" in entry}
          <div class="mx-4 my-1 h-px bg-(--border)"></div>
        {:else}
          {@const Icon = entry.icon}
          <button
            class="flex w-full cursor-pointer items-center gap-3.5 border-0 bg-transparent px-4 py-3.5 text-left font-mono text-base transition-colors active:bg-white/6"
            style="color: {entry.color ?? 'var(--text)'}"
            onclick={() => run(entry)}
          >
            <Icon size={17} />
            {entry.label}
          </button>
        {/if}
      {/each}
    </div>
    <button
      class="m-3 shrink-0 cursor-pointer border border-(--border) bg-transparent py-3 font-mono text-xs tracking-[0.14em] text-(--muted) uppercase active:bg-white/4"
      onclick={onClose}
    >
      Cancel
    </button>
  </div>
{:else}
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
          onclick={() => run(entry)}
        >
          <Icon size={12} />
          {entry.label}
        </button>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .context-item:hover {
    color: var(--hover-color, var(--text));
  }
</style>
