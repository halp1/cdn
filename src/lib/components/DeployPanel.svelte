<script lang="ts">
  import { X, CheckCircle, XCircle, Loader } from "@lucide/svelte";
  import { onMount, tick } from "svelte";

  interface Props {
    onClose: () => void;
    width: number;
    onResize: (w: number) => void;
  }

  let { onClose, width, onResize }: Props = $props();

  let lines = $state<string[]>([]);
  let currentCommit = $state("");
  let targetCommit = $state("");
  let status = $state<"connecting" | "running" | "done" | "failed">("connecting");
  let exitCode = $state<number | null>(null);
  let logEl = $state<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    if (logEl) logEl.scrollTop = logEl.scrollHeight;
  };

  onMount(() => {
    const es = new EventSource("/api/internal/deploy");

    es.addEventListener("meta", (e) => {
      const data = JSON.parse(e.data) as { currentCommit: string; targetCommit: string };
      currentCommit = data.currentCommit;
      targetCommit = data.targetCommit;
      status = "running";
    });

    es.addEventListener("output", async (e) => {
      lines = [...lines, JSON.parse(e.data) as string];
      await tick();
      scrollToBottom();
    });

    es.addEventListener("done", (e) => {
      const data = JSON.parse(e.data) as { exitCode: number };
      exitCode = data.exitCode;
      status = exitCode === 0 ? "done" : "failed";
      es.close();
      setTimeout(() => window.location.reload(), 1500);
    });

    es.onerror = () => {
      if (status === "running") {
        status = "done";
        exitCode = 0;
        es.close();
        setTimeout(() => window.location.reload(), 1500);
      } else if (status === "connecting") {
        status = "failed";
        es.close();
      }
    };

    return () => {
      es.close();
    };
  });

  let resizing = false;
  let startX = 0;
  let startW = 0;

  const onMouseDown = (e: MouseEvent) => {
    resizing = true;
    startX = e.clientX;
    startW = width;
    e.preventDefault();
  };
</script>

<svelte:window
  onmousemove={(e) => {
    if (resizing) onResize(Math.max(260, Math.min(700, startW - (e.clientX - startX))));
  }}
  onmouseup={() => {
    resizing = false;
  }}
/>

<aside
  class="relative flex shrink-0 flex-col overflow-hidden border-l border-border bg-surface"
  style="width: {width}px"
>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <!-- svelte-ignore a11y_no_redundant_roles -->
  <hr
    class="absolute top-0 left-0 z-2 h-full w-1 cursor-col-resize border-none bg-transparent transition-colors hover:bg-accent/50"
    onmousedown={onMouseDown}
    role="separator"
    aria-orientation="vertical"
    aria-label="Resize panel"
    tabindex="-1"
  />

  <div class="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
    <span class="flex-1 text-xs tracking-[0.16em] text-muted uppercase">Deploy</span>
    {#if status === "connecting" || status === "running"}
      <Loader size={11} class="spin text-accent" />
    {:else if status === "done"}
      <CheckCircle size={11} class="text-accent" />
    {:else if status === "failed"}
      <XCircle size={11} class="text-[#ff6b6b]" />
    {/if}
    <button
      class="flex cursor-pointer items-center border-0 bg-transparent p-1.25 text-muted transition-colors hover:text-text"
      onclick={onClose}
    >
      <X size={13} />
    </button>
  </div>

  {#if currentCommit || targetCommit}
    <div class="flex items-center gap-1.5 border-b border-border px-3 py-2">
      <span class="font-mono text-xs text-muted">{currentCommit}</span>
      <span class="text-xs text-border">→</span>
      <span class="font-mono text-xs text-accent">{targetCommit}</span>
    </div>
  {/if}

  <div
    bind:this={logEl}
    class="min-h-0 flex-1 overflow-y-auto bg-[#080808] px-3 py-2.5 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent"
  >
    {#if status === "connecting"}
      <span class="animate-pulse font-mono text-xs text-muted">Connecting…</span>
    {:else}
      {#each lines as line (line + lines.indexOf(line))}
        <div class="font-mono text-xs leading-relaxed break-all whitespace-pre-wrap text-text/80">
          {line}
        </div>
      {/each}
      {#if status === "running"}
        <span class="mt-1 inline-block h-3 w-1.5 animate-pulse bg-accent" aria-hidden="true"></span>
      {:else if status === "done"}
        <div class="mt-3 font-mono text-xs text-accent">✓ complete — reloading…</div>
      {:else if status === "failed"}
        <div class="mt-3 font-mono text-xs text-[#ff6b6b]">
          ✗ failed (exit {exitCode ?? "?"})
        </div>
      {/if}
    {/if}
  </div>
</aside>
