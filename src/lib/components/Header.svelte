<script lang="ts">
  import { ChartNoAxesColumn, Cloud } from "@lucide/svelte";
  import { Search, Upload, Key, Link, Rocket, LogOut } from "@lucide/svelte";
  import { getStorageStatsQuery } from "$lib/api/r2.remote";
  import { formatFileSize } from "$lib/utils";
  import { tooltip } from "$lib/tooltip";
  import { getCurrentCommitQuery } from "$lib/api/deploy.remote";
  import { onMount } from "svelte";

  interface Props {
    username: string;
    onOpenSearchModal: () => void;
    onUpload: () => void;
    rightPanel: string;
    onTogglePanel: (panel: string) => void;
  }

  let { username, onOpenSearchModal, onUpload, rightPanel, onTogglePanel }: Props = $props();

  const statsPromise = getStorageStatsQuery();

  let deployTooltip = $state("Deploy");
  getCurrentCommitQuery().then(({ hash, message }) => {
    if (hash) deployTooltip = `Deploy — ${hash}${message ? ` ${message}` : ""}`;
  });

  let lastBackupStatus = $state<{ status: "success" | "failed"; timestamp: number } | null>(null);

  async function fetchLastBackup() {
    try {
      const res = await fetch("/api/backups");
      if (res.ok) {
        const data = await res.json();
        if (data.lastBackup) {
          lastBackupStatus = {
            status: data.lastBackup.status,
            timestamp: data.lastBackup.timestamp
          };
        } else {
          lastBackupStatus = null;
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  onMount(() => {
    fetchLastBackup();
    const interval = setInterval(fetchLastBackup, 30000);
    return () => clearInterval(interval);
  });
</script>

<header
  class="relative z-10 flex h-10 shrink-0 items-center gap-0 border-b border-border bg-surface px-3"
>
  <div class="flex min-w-0 flex-1 items-center gap-3">
    <span class="shrink-0 [font-family:var(--font-heading)] text-lg tracking-[0.08em] text-accent"
      >HALP/CDN</span
    >
    {#await statsPromise then stats}
      <span class="font-mono text-xs text-muted">{formatFileSize(stats.totalSize)}</span>
      <span class="-mx-1 font-mono text-xs text-muted">/</span>
      <span class="font-mono text-xs text-muted">{stats.objectCount.toLocaleString()} objects</span>
    {:catch}
      <span class="font-mono text-xs text-muted">—</span>
    {/await}

    {#if lastBackupStatus}
      <span class="mx-1 font-mono text-xs text-muted">|</span>
      <div
        class="flex items-center gap-1.5 font-mono text-xs text-muted"
        use:tooltip={`Last Backup: ${new Date(lastBackupStatus.timestamp * 1000).toLocaleString()}`}
      >
        <div class="h-2 w-2 rounded-full {lastBackupStatus.status === 'success' ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}"></div>
        <span>Backup: {new Date(lastBackupStatus.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    {/if}
  </div>

  <div class="search-wrap relative shrink-0">
    <Search
      size={13}
      class="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted"
    />
    <input
      type="text"
      readonly
      class="search-input w-70 cursor-pointer rounded-none border border-border bg-bg py-1.25 pr-2.5 pl-7.5 font-mono text-sm text-text ring-0 transition-[border-color,width] duration-200 outline-none placeholder:text-[#333] focus:border-accent"
      placeholder="Search files... (Ctrl+K)"
      onclick={onOpenSearchModal}
    />
  </div>

  <div class="ml-3 flex shrink-0 items-center gap-0.5">
    <button
      class="flex cursor-pointer items-center justify-center border-none bg-transparent p-1.5 text-muted transition-colors hover:bg-white/4 hover:text-text"
      use:tooltip={"Upload"}
      onclick={onUpload}
    >
      <Upload size={14} />
    </button>
    <div class="mx-1 h-5 w-px bg-border"></div>
    <button
      class="flex cursor-pointer items-center justify-center border-none bg-transparent p-1.5 transition-colors hover:bg-white/4 hover:text-text {rightPanel ===
      'upload-links'
        ? 'text-accent'
        : 'text-muted'}"
      use:tooltip={"Upload Links"}
      onclick={() => onTogglePanel("upload-links")}
    >
      <Link size={14} />
    </button>
    <button
      class="flex cursor-pointer items-center justify-center border-none bg-transparent p-1.5 transition-colors hover:bg-white/4 hover:text-text {rightPanel ===
      'api-keys'
        ? 'text-accent'
        : 'text-muted'}"
      use:tooltip={"API Keys"}
      onclick={() => onTogglePanel("api-keys")}
    >
      <Key size={14} />
    </button>
    <button
      class="flex cursor-pointer items-center justify-center border-none bg-transparent p-1.5 transition-colors hover:bg-white/4 hover:text-text {rightPanel ===
      'stats'
        ? 'text-accent'
        : 'text-muted'}"
      use:tooltip={"Storage Stats"}
      onclick={() => onTogglePanel("stats")}
    >
      <ChartNoAxesColumn size={14} />
    </button>
    <button
      class="flex cursor-pointer items-center justify-center border-none bg-transparent p-1.5 transition-colors hover:bg-white/4 hover:text-text {rightPanel ===
      'backups'
        ? 'text-accent'
        : 'text-muted'}"
      use:tooltip={"Google Drive Backup"}
      onclick={() => onTogglePanel("backups")}
    >
      <Cloud size={14} />
    </button>
    <div class="mx-1 h-5 w-px bg-border"></div>
    <button
      class="flex cursor-pointer items-center justify-center border-none bg-transparent p-1.5 transition-colors hover:bg-white/4 hover:text-[#f0a830] {rightPanel ===
      'deploy'
        ? 'text-[#f0a830]'
        : 'text-muted'}"
      use:tooltip={deployTooltip}
      onclick={() => onTogglePanel("deploy")}
    >
      <Rocket size={14} />
    </button>
    <form method="POST" action="/logout">
      <button
        type="submit"
        class="flex cursor-pointer items-center justify-center border-none bg-transparent p-1.5 text-muted transition-colors hover:bg-white/4 hover:text-text"
        use:tooltip={`Sign out — ${username}`}
      >
        <LogOut size={14} />
      </button>
    </form>
  </div>
</header>

<style>
</style>
