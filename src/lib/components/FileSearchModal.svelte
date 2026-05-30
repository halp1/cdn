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

  const filtered = $derived.by(() => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    return allObjects.filter((obj) => obj.key.toLowerCase().includes(q)).slice(0, 100);
  });

  // Reset highlight when query changes
  $effect(() => {
    void searchQuery;
    highlightedIndex = 0;
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
      highlightedIndex = Math.min(highlightedIndex + 1, filtered.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlightedIndex = Math.max(highlightedIndex - 1, 0);
    } else if (e.key === "Enter" && filtered.length > 0) {
      e.preventDefault();
      onFileSelect(filtered[highlightedIndex]);
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
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
    role="presentation"
    onmousedown={handleBackdropClick}
  >
    <div class="relative w-full max-w-2xl rounded-none bg-surface">
      <!-- Accent corner -->
      <div class="absolute top-0 right-0 h-8 w-8 border-t-2 border-r-2 border-accent"></div>

      <!-- Search input -->
      <div class="flex items-center gap-3 border-b border-border px-5 py-4">
        <input
          bind:this={searchInput}
          type="text"
          placeholder="Search files..."
          value={searchQuery}
          onchange={(e) => onQueryChange(e.currentTarget.value)}
          oninput={(e) => onQueryChange(e.currentTarget.value)}
          class="flex-1 border border-border bg-input-bg px-3 py-2 font-mono text-sm text-text placeholder-muted transition-colors outline-none focus:border-accent"
        />
        <button
          onclick={onClose}
          class="inline-flex h-8 w-8 items-center justify-center text-muted transition-colors hover:text-text"
          aria-label="Close search"
        >
          <X size={18} />
        </button>
      </div>

      <!-- File list -->
      <div class="max-h-96 overflow-y-auto">
        {#if filtered.length === 0}
          <div class="px-5 py-8 text-center text-sm text-muted">
            {searchQuery ? "No files found" : "Start typing to search..."}
          </div>
        {:else}
          <div>
            {#each filtered as file, index (file.key)}
              <button
                class="w-full border-b border-border px-5 py-3 text-left transition-colors hover:bg-[rgba(200,245,106,0.05)] {index ===
                highlightedIndex
                  ? 'border-l-2 border-l-accent bg-[rgba(200,245,106,0.1)]'
                  : ''}"
                onclick={() => handleFileClick(file)}
                onmouseenter={() => (highlightedIndex = index)}
              >
                <div class="flex min-w-0 items-center gap-3">
                  <FileIcon filename={file.isFolder ? "folder" : (file.key.split("/").pop() ?? file.key)} size={14} />
                  <div class="min-w-0 flex-1 truncate">
                    <span class="font-mono text-sm text-text">{file.key}</span>
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
