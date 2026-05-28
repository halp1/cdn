<script lang="ts">
  import { X } from "@lucide/svelte";
  import { notifications } from "$lib/notifications.svelte";
</script>

<div class="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-2">
  {#each notifications.toasts as toast (toast.id)}
    <div
      class="toast flex max-w-sm min-w-72 items-start gap-3 border border-border bg-surface px-3.5 py-3 shadow-lg"
      class:toast--error={toast.type === "error"}
      class:toast--success={toast.type === "success"}
      class:toast--loading={toast.type === "loading"}
    >
      {#if toast.type === "loading"}
        <span class="toast-spinner mt-0.5 shrink-0"></span>
      {/if}
      <span class="min-w-0 flex-1 font-mono text-xs leading-relaxed break-words text-text">
        {toast.message}
      </span>
      <button
        class="mt-0.5 shrink-0 cursor-pointer border-none bg-transparent p-0 text-muted transition-colors hover:text-text"
        onclick={() => notifications.dismiss(toast.id)}
        aria-label="Dismiss"
      >
        <X size={13} />
      </button>
    </div>
  {/each}
</div>

<style>
  .toast {
    animation: slide-in 0.15s ease-out;
    border-left: 3px solid var(--border);
  }

  .toast--error {
    border-left-color: #ff8080;
  }

  .toast--success {
    border-left-color: var(--accent);
  }

  .toast--loading {
    border-left-color: #6ab4f5;
  }

  .toast-spinner {
    width: 12px;
    height: 12px;
    border: 1.5px solid #6ab4f5;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    display: block;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes slide-in {
    from {
      opacity: 0;
      transform: translateX(1rem);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
</style>
