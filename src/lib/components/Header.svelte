<script lang="ts">
  import { ChartNoAxesColumn, Cloud, Menu, MoreVertical } from "@lucide/svelte";
  import { Search, Upload, Key, Link, Rocket, LogOut } from "@lucide/svelte";
  import { getStorageStatsQuery } from "$lib/api/r2.remote";
  import { formatFileSize } from "$lib/utils";
  import { tooltip } from "$lib/tooltip";
  import { getCurrentCommitQuery } from "$lib/api/deploy.remote";
  import { onMount } from "svelte";
  import Sheet from "./Sheet.svelte";

  interface Props {
    username: string;
    onOpenSearchModal: () => void;
    onUpload: () => void;
    onToggleDrawer: () => void;
    rightPanel: string;
    onTogglePanel: (panel: string) => void;
  }

  let { username, onOpenSearchModal, onUpload, onToggleDrawer, rightPanel, onTogglePanel }: Props =
    $props();

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

  /** Touch layouts fold every panel toggle into one overflow sheet. */
  let toolsOpen = $state(false);

  const tools = [
    { panel: "upload-links", icon: Link, label: "Upload links" },
    { panel: "api-keys", icon: Key, label: "API keys" },
    { panel: "stats", icon: ChartNoAxesColumn, label: "Storage stats" },
    { panel: "backups", icon: Cloud, label: "Google Drive backup" },
    { panel: "deploy", icon: Rocket, label: "Deploy" }
  ];

  const openTool = (panel: string) => {
    toolsOpen = false;
    onTogglePanel(panel);
  };
</script>

<header class="app-chrome relative z-10 shrink-0 border-b border-border bg-surface pt-(--safe-top)">
  <div class="flex h-13 items-center gap-0 px-2 md:h-10 md:px-3">
    <button
      class="mr-1 -ml-1 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent text-muted transition-colors active:bg-white/6 md:hidden"
      onclick={onToggleDrawer}
      aria-label="Open folder tree"
    >
      <Menu size={20} />
    </button>

    <div class="flex min-w-0 flex-1 items-center gap-3">
      <span class="shrink-0 [font-family:var(--font-heading)] text-lg tracking-[0.08em] text-accent"
        >HALP/CDN</span
      >
      {#await statsPromise then stats}
        <span class="hidden font-mono text-xs text-muted md:inline"
          >{formatFileSize(stats.totalSize)}</span
        >
        <span class="-mx-1 hidden font-mono text-xs text-muted md:inline">/</span>
        <span class="hidden font-mono text-xs text-muted md:inline"
          >{stats.objectCount.toLocaleString()} objects</span
        >
      {:catch}
        <span class="hidden font-mono text-xs text-muted md:inline">—</span>
      {/await}

      {#if lastBackupStatus}
        <span class="mx-1 hidden font-mono text-xs text-muted md:inline">|</span>
        <div
          class="flex items-center gap-1.5 font-mono text-xs text-muted"
          use:tooltip={`Last Backup: ${new Date(lastBackupStatus.timestamp * 1000).toLocaleString()}`}
        >
          <div
            class="h-2 w-2 rounded-full {lastBackupStatus.status === 'success'
              ? 'bg-emerald-500'
              : 'animate-pulse bg-red-500'}"
          ></div>
          <span class="hidden md:inline"
            >Backup: {new Date(lastBackupStatus.timestamp * 1000).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit"
            })}</span
          >
        </div>
      {/if}
    </div>

    <div class="search-wrap relative hidden shrink-0 md:block">
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

    <button
      class="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent text-muted transition-colors active:bg-white/6 md:hidden"
      onclick={onOpenSearchModal}
      aria-label="Search files"
    >
      <Search size={19} />
    </button>
    <button
      class="-mr-1 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent text-muted transition-colors active:bg-white/6 md:hidden"
      onclick={() => (toolsOpen = true)}
      aria-label="More"
    >
      <MoreVertical size={19} />
    </button>

    <div class="ml-3 hidden shrink-0 items-center gap-0.5 md:flex">
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
  </div>
</header>

{#if toolsOpen}
  <Sheet title={username} onClose={() => (toolsOpen = false)}>
    {#await statsPromise then stats}
      <div class="border-b border-border px-4 py-3 font-mono text-xs text-muted">
        {formatFileSize(stats.totalSize)} · {stats.objectCount.toLocaleString()} objects
      </div>
    {/await}

    {#each tools as tool (tool.panel)}
      {@const Icon = tool.icon}
      <button
        class="flex w-full cursor-pointer items-center gap-3.5 border-0 bg-transparent px-4 py-3.5 text-left font-mono text-base transition-colors active:bg-white/6 {rightPanel ===
        tool.panel
          ? 'text-accent'
          : 'text-text'}"
        onclick={() => openTool(tool.panel)}
      >
        <Icon size={17} />
        {tool.label}
      </button>
    {/each}

    <div class="mx-4 my-1 h-px bg-border"></div>

    <form method="POST" action="/logout">
      <button
        type="submit"
        class="flex w-full cursor-pointer items-center gap-3.5 border-0 bg-transparent px-4 py-3.5 text-left font-mono text-base text-muted transition-colors active:bg-white/6"
      >
        <LogOut size={17} />
        Sign out
      </button>
    </form>
  </Sheet>
{/if}
