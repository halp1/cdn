<script lang="ts">
  import { X } from "@lucide/svelte";
  import type { Snippet } from "svelte";

  interface Props {
    title?: string;
    onClose: () => void;
    children: Snippet;
  }

  let { title = "", onClose, children }: Props = $props();

  const DISMISS_PX = 110;

  let dragY = $state(0);
  let dragging = $state(false);
  let startY = 0;

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragging = true;
    startY = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!dragging) return;
    dragY = Math.max(0, e.clientY - startY);
  };

  const onPointerUp = () => {
    if (!dragging) return;
    dragging = false;
    if (dragY > DISMISS_PX) onClose();
    else dragY = 0;
  };
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape") onClose();
  }}
/>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-60 animate-[backdropIn_0.15s_ease] bg-black/60" onclick={onClose}></div>

<div
  class="app-chrome fixed inset-x-0 bottom-0 z-60 flex max-h-[88dvh] animate-[sheetUp_0.22s_cubic-bezier(0.32,0.72,0,1)] flex-col border-t border-border bg-surface shadow-[0_-8px_32px_rgba(0,0,0,0.5)]"
  style="transform: translateY({dragY}px); transition: {dragging
    ? 'none'
    : 'transform 0.2s cubic-bezier(0.32,0.72,0,1)'}"
  role="dialog"
  aria-modal="true"
  aria-label={title || "Panel"}
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="flex shrink-0 cursor-grab touch-none justify-center pt-2.5 pb-1.5 active:cursor-grabbing"
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
  >
    <div class="h-1 w-10 rounded-full bg-border"></div>
  </div>

  <div class="flex h-11 shrink-0 items-center gap-2 border-b border-border px-4">
    <span class="flex-1 truncate text-xs tracking-[0.16em] text-muted uppercase">{title}</span>
    <button
      class="-mr-2 flex h-9 w-9 cursor-pointer items-center justify-center border-0 bg-transparent text-muted"
      onclick={onClose}
      aria-label="Close"
    >
      <X size={18} />
    </button>
  </div>

  <div class="scroll-touch min-h-0 flex-1 overflow-y-auto pb-(--safe-bottom)">
    {@render children()}
  </div>
</div>
