<script lang="ts">
  import { X } from "@lucide/svelte";
  import FileIcon from "./FileIcon.svelte";

  interface Props {
    isOpen: boolean;
    allObjects: { key: string; isFolder: boolean }[];
    searchQuery: string;
    onQueryChange: (query: string) => void;
    onFileSelect: (file: { key: string; isFolder: boolean }) => void;
    onClose: () => void;
  }

  let { isOpen, allObjects, searchQuery, onQueryChange, onFileSelect, onClose }: Props = $props();

  let searchInput = $state<HTMLInputElement | null>(null);
  let highlightedIndex = $state(0);
  let results = $state<{ key: string; isFolder: boolean }[]>([]);
  let pendingQuery = "";
  let worker = $state<Worker | null>(null);

  $effect(() => {
    const w = new Worker(new URL("../workers/fileSearch.worker.ts", import.meta.url), {
      type: "module"
    });
    w.onmessage = (
      e: MessageEvent<{ query: string; results: { key: string; isFolder: boolean }[] }>
    ) => {
      if (e.data.query === pendingQuery) {
        results = e.data.results;
        highlightedIndex = 0;
      }
    };
    worker = w;
    return () => w.terminate();
  });

  $effect(() => {
    worker?.postMessage({
      type: "init",
      payload: allObjects.map(({ key, isFolder }) => ({ key, isFolder }))
    });
  });

  $effect(() => {
    const q = searchQuery;
    pendingQuery = q;
    if (!q) {
      results = [];
      highlightedIndex = 0;
      return;
    }
    worker?.postMessage({ type: "search", payload: q });
  });

  // Auto-focus input when modal opens
  $effect(() => {
    if (isOpen) {
      setTimeout(() => searchInput?.focus(), 0);
    }
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isOpen) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlightedIndex = Math.min(highlightedIndex + 1, results.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlightedIndex = Math.max(highlightedIndex - 1, 0);
    } else if (e.key === "Enter" && results.length > 0) {
      e.preventDefault();
      onFileSelect(results[highlightedIndex]);
      onClose();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  const handleFileClick = (file: { key: string; isFolder: boolean }) => {
    onFileSelect(file);
    onClose();
  };

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if isOpen}
  <!-- Full-screen on phones: search is the main way to cross the tree there. -->
  <div
    class="fixed inset-0 z-80 flex items-stretch justify-center bg-black/60 md:items-center"
    role="presentation"
    onmousedown={handleBackdropClick}
  >
    <div
      class="relative flex h-full w-full flex-col rounded-none bg-surface pt-(--safe-top) pb-(--safe-bottom) md:h-auto md:max-w-2xl md:pt-0 md:pb-0"
    >
      <!-- Accent corner -->
      <div class="absolute top-0 right-0 h-8 w-8 border-t-2 border-r-2 border-accent"></div>

      <!-- Search input -->
      <div
        class="flex shrink-0 items-center gap-3 border-b border-border px-3 py-3 md:px-5 md:py-4"
      >
        <input
          bind:this={searchInput}
          type="text"
          placeholder="Search files..."
          value={searchQuery}
          enterkeyhint="search"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          onchange={(e) => onQueryChange(e.currentTarget.value)}
          oninput={(e) => onQueryChange(e.currentTarget.value)}
          class="min-w-0 flex-1 border border-border bg-input-bg px-3 py-2.5 font-mono text-base text-text placeholder-muted transition-colors outline-none focus:border-accent md:py-2 md:text-sm"
        />
        <button
          onclick={onClose}
          class="inline-flex h-10 w-10 shrink-0 items-center justify-center text-muted transition-colors hover:text-text md:h-8 md:w-8"
          aria-label="Close search"
        >
          <X size={18} />
        </button>
      </div>

      <!-- File list -->
      <div class="scroll-touch min-h-0 flex-1 overflow-y-auto md:max-h-96 md:flex-none">
        {#if results.length === 0}
          <div class="px-5 py-8 text-center text-sm text-muted">
            {searchQuery ? "No files found" : "Start typing to search..."}
          </div>
        {:else}
          <div>
            {#each results as file, index (file.key)}
              <button
                class="w-full border-b border-border px-3 py-3.5 text-left transition-colors hover:bg-[rgba(200,245,106,0.05)] md:px-5 md:py-3 {index ===
                highlightedIndex
                  ? 'border-l-2 border-l-accent bg-[rgba(200,245,106,0.1)]'
                  : ''}"
                onclick={() => handleFileClick(file)}
                onmouseenter={() => (highlightedIndex = index)}
              >
                <div class="flex min-w-0 items-center gap-3">
                  <FileIcon
                    filename={file.isFolder ? "folder" : (file.key.split("/").pop() ?? file.key)}
                    size={14}
                  />
                  <div class="min-w-0 flex-1">
                    <!-- Phones get name-over-path; the full key alone truncates
                         to uselessness at that width. -->
                    <div class="truncate font-mono text-sm text-text md:hidden">
                      {file.key.split("/").filter(Boolean).pop() || file.key}
                    </div>
                    <div class="truncate font-mono text-[11px] text-muted md:hidden">
                      {file.key}
                    </div>
                    <span class="hidden truncate font-mono text-sm text-text md:block"
                      >{file.key}</span
                    >
                  </div>
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
