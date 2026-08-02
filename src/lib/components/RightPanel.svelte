<script lang="ts">
  import { Plus, Trash2, Copy, Check, RefreshCw, X } from "@lucide/svelte";
  import { getUploadLinks, createUploadLink, deleteUploadLink } from "$lib/api/upload-links.remote";
  import { getApiKeys, createApiKeyCommand, deleteApiKeyCommand } from "$lib/api/api-keys.remote";
  import { getStorageStatsQuery } from "$lib/api/r2.remote";
  import { formatFileSize } from "$lib/utils";
  import type { ApiKeyPermission, BackupRow } from "$lib/db/types";
  import { tooltip } from "$lib/tooltip";

  type Panel = "upload-links" | "api-keys" | "stats" | "backups";

  interface Props {
    panel: Panel;
    onClose: () => void;
    width: number;
    onResize: (w: number) => void;
  }

  let { panel, onClose, width, onResize }: Props = $props();

  const uploadLinksResult = getUploadLinks();
  const apiKeysResult = getApiKeys();
  const statsResult = getStorageStatsQuery();

  let copiedToken = $state("");
  const copyLink = async (token: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/upload/${token}`);
    copiedToken = token;
    setTimeout(() => {
      copiedToken = "";
    }, 2000);
  };

  let newLinkPath = $state("");
  let newLinkHours = $state(24);
  let newLinkMax = $state(1);
  let showNewLink = $state(false);
  let creatingLink = $state(false);

  const submitLink = async () => {
    if (!newLinkPath) return;
    creatingLink = true;
    await createUploadLink({
      upload_path: newLinkPath,
      expires_in_hours: newLinkHours,
      max_uploads: newLinkMax
    });
    newLinkPath = "";
    newLinkHours = 24;
    newLinkMax = 1;
    showNewLink = false;
    creatingLink = false;
  };

  const formatExpiry = (expires_at: number): string => {
    const diff = expires_at - Math.floor(Date.now() / 1000);
    if (diff <= 0) return "expired";
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  let newKeyName = $state("");
  let newKeyPerms = $state<ApiKeyPermission[]>(["read", "list"]);
  let newKeyPaths = $state<string[]>(["/"]);
  let showNewKey = $state(false);
  let creatingKey = $state(false);
  let newKeyValue = $state("");

  const togglePerm = (perm: ApiKeyPermission) => {
    if (newKeyPerms.includes(perm)) newKeyPerms = newKeyPerms.filter((p) => p !== perm);
    else newKeyPerms = [...newKeyPerms, perm];
  };

  const submitKey = async () => {
    if (!newKeyName) return;
    creatingKey = true;
    const result = await createApiKeyCommand({
      name: newKeyName,
      permissions: newKeyPerms,
      scopedPaths: newKeyPaths
    });
    newKeyValue = result.key;
    newKeyName = "";
    newKeyPerms = ["read", "list"];
    newKeyPaths = ["/"];
    showNewKey = false;
    creatingKey = false;
  };

  let resizing = false;
  let startX = 0;
  let startW = 0;

  const onMouseDown = (e: MouseEvent) => {
    resizing = true;
    startX = e.clientX;
    startW = width;
    e.preventDefault();
  };

  const titles: Record<Panel, string> = {
    "upload-links": "Upload Links",
    "api-keys": "API Keys",
    stats: "Storage Stats",
    backups: "Google Drive Backup"
  };

  let backupData = $state<{
    configured: boolean;
    connected: boolean;
    client_id: string;
    redirect_uri: string;
    folder_id: string;
    lastBackup: BackupRow | null;
    backups: BackupRow[];
  } | null>(null);

  let loadingBackups = $state(false);
  let triggeringBackup = $state(false);
  let savingConfig = $state(false);

  // Configuration form fields
  let clientIdInput = $state("");
  let clientSecretInput = $state("");
  let redirectUriInput = $state("");
  let folderIdInput = $state("");

  async function loadBackupData() {
    loadingBackups = true;
    try {
      const res = await fetch("/api/backups");
      if (res.ok) {
        backupData = await res.json();
        if (backupData) {
          clientIdInput = backupData.client_id;
          redirectUriInput =
            backupData.redirect_uri || window.location.origin + "/api/auth/google/callback";
          folderIdInput = backupData.folder_id;
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      loadingBackups = false;
    }
  }

  $effect(() => {
    if (panel === "backups") {
      loadBackupData();
    }
  });

  async function handleSaveConfig() {
    savingConfig = true;
    try {
      const res = await fetch("/api/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_config",
          client_id: clientIdInput,
          client_secret: clientSecretInput,
          redirect_uri: redirectUriInput,
          folder_id: folderIdInput
        })
      });
      if (res.ok) {
        const authRes = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: clientIdInput,
            client_secret: clientSecretInput,
            redirect_uri: redirectUriInput,
            folder_id: folderIdInput
          })
        });
        const authData = await authRes.json();
        if (authData.url) {
          window.location.href = authData.url;
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      savingConfig = false;
    }
  }

  function handleReconnect() {
    // GET redirects straight to Google using the credentials already in the DB.
    window.location.href = "/api/auth/google";
  }

  async function handleTriggerBackup() {
    triggeringBackup = true;
    try {
      const res = await fetch("/api/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "trigger_backup" })
      });
      if (res.ok) {
        await loadBackupData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      triggeringBackup = false;
    }
  }

  async function handleDisconnect() {
    if (!confirm("Are you sure you want to disconnect Google Drive?")) return;
    try {
      const res = await fetch("/api/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" })
      });
      if (res.ok) {
        await loadBackupData();
        clientSecretInput = "";
      }
    } catch (e) {
      console.error(e);
    }
  }
</script>

<svelte:window
  onmousemove={(e) => {
    if (resizing) onResize(Math.max(220, Math.min(600, startW - (e.clientX - startX))));
  }}
  onmouseup={() => {
    resizing = false;
  }}
/>

<aside
  class="fixed inset-x-0 bottom-0 z-60 flex h-[88dvh] shrink-0 animate-[sheetUp_0.22s_cubic-bezier(0.32,0.72,0,1)] flex-col overflow-hidden border-t border-border bg-surface pb-(--safe-bottom) md:relative md:inset-auto md:z-auto md:h-auto md:w-(--panel-w) md:animate-none md:border-t-0 md:border-l md:pb-0"
  style="--panel-w: {width}px"
>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <!-- svelte-ignore a11y_no_redundant_roles -->
  <hr
    class="absolute top-0 left-0 z-2 hidden h-full w-1 cursor-col-resize border-none bg-transparent transition-colors hover:bg-accent/50 md:block"
    onmousedown={onMouseDown}
    role="separator"
    aria-orientation="vertical"
    aria-label="Resize panel"
    tabindex="-1"
  />

  <div class="flex shrink-0 justify-center pt-2.5 pb-1 md:hidden">
    <div class="h-1 w-10 rounded-full bg-border"></div>
  </div>

  <div class="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3 md:h-9">
    <span class="flex-1 text-xs tracking-[0.16em] text-muted uppercase">{titles[panel]}</span>
    <button
      class="-mr-2 flex h-9 w-9 cursor-pointer items-center justify-center border-0 bg-transparent text-muted transition-colors hover:text-text md:mr-0 md:h-auto md:w-auto md:p-1.25"
      onclick={onClose}
      aria-label="Close"
      ><X size={18} class="md:hidden" /><X size={13} class="hidden md:block" /></button
    >
  </div>

  <div
    class="scroll-touch flex-1 overflow-y-auto p-3 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent"
  >
    {#if panel === "upload-links"}
      <div class="flex flex-col gap-2">
        <button
          class="mb-1 flex w-full cursor-pointer items-center justify-center gap-1.5 border border-border bg-transparent px-2.5 py-1.5 font-mono text-xs tracking-[0.08em] text-muted uppercase transition-all hover:border-accent hover:text-accent"
          onclick={() => {
            showNewLink = !showNewLink;
          }}
        >
          <Plus size={12} />
          New link
        </button>

        {#if showNewLink}
          <div
            class="flex animate-[fadeUp_0.15s_ease_both] flex-col gap-2.5 border border-border bg-bg p-3"
          >
            <div class="flex flex-col gap-1.5">
              <label class="text-xs tracking-[0.14em] text-muted uppercase" for="link-path"
                >Upload path</label
              >
              <input
                class="w-full rounded-none border border-border bg-input-bg px-2.25 py-2.5 font-mono text-base text-text transition-[border-color] outline-none placeholder:text-[#333] focus:border-accent md:py-1.75 md:text-sm"
                id="link-path"
                bind:value={newLinkPath}
                placeholder="path/to/folder/"
              />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div class="flex flex-col gap-1.5">
                <label class="text-xs tracking-[0.14em] text-muted uppercase" for="link-hours"
                  >Expires (hours)</label
                >
                <input
                  class="w-full rounded-none border border-border bg-input-bg px-2.25 py-2.5 font-mono text-base text-text transition-[border-color] outline-none placeholder:text-[#333] focus:border-accent md:py-1.75 md:text-sm"
                  id="link-hours"
                  type="number"
                  bind:value={newLinkHours}
                  min="1"
                  max="8760"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-xs tracking-[0.14em] text-muted uppercase" for="link-max"
                  >Max uploads</label
                >
                <input
                  class="w-full rounded-none border border-border bg-input-bg px-2.25 py-2.5 font-mono text-base text-text transition-[border-color] outline-none placeholder:text-[#333] focus:border-accent md:py-1.75 md:text-sm"
                  id="link-max"
                  type="number"
                  bind:value={newLinkMax}
                  min="1"
                  max="100"
                />
              </div>
            </div>
            <div class="flex justify-end gap-1.5">
              <button
                class="cursor-pointer border border-border bg-transparent px-3 py-1.5 font-mono text-xs tracking-widest text-muted uppercase transition-all hover:border-muted hover:text-text"
                onclick={() => {
                  showNewLink = false;
                }}>Cancel</button
              >
              <button
                class="cursor-pointer border-0 bg-accent px-3 py-1.5 font-mono text-xs font-medium tracking-widest text-bg uppercase transition-opacity hover:opacity-[0.88] disabled:cursor-not-allowed disabled:opacity-40"
                onclick={submitLink}
                disabled={creatingLink || !newLinkPath}
              >
                {creatingLink ? "…" : "Create"}
              </button>
            </div>
          </div>
        {/if}

        {#await uploadLinksResult}
          <div class="flex justify-center p-4 text-muted"><RefreshCw size={12} class="spin" /></div>
        {:then data}
          {#each data.links as link (link.token)}
            <div
              class="flex animate-[fadeUp_0.2s_ease_both] flex-col gap-1.5 border border-border bg-bg px-3 py-2.5"
            >
              <div class="overflow-hidden text-sm text-ellipsis whitespace-nowrap text-text">
                {link.upload_path}
              </div>
              <div class="flex items-center gap-1">
                <span
                  class="border border-border px-1.25 py-px text-xs tracking-widest text-muted uppercase"
                  >{link.used_count}/{link.max_uploads} used</span
                >
                <span
                  class="border border-accent/30 px-1.25 py-px text-xs tracking-widest text-accent uppercase"
                  >{formatExpiry(link.expires_at)}</span
                >
              </div>
              <div class="flex justify-end gap-0.5">
                <button
                  class="flex cursor-pointer items-center border-0 bg-transparent p-1.25 text-muted transition-colors hover:text-text"
                  onclick={() => copyLink(link.token)}
                  use:tooltip={"Copy link"}
                >
                  {#if copiedToken === link.token}<Check size={12} />{:else}<Copy size={12} />{/if}
                </button>
                <button
                  class="flex cursor-pointer items-center border-0 bg-transparent p-1.25 text-muted transition-colors hover:text-[#ff6b6b]"
                  onclick={() => deleteUploadLink({ token: link.token })}
                  use:tooltip={"Delete"}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          {:else}
            <p class="py-4 text-center text-sm text-border">No active upload links</p>
          {/each}
        {/await}
      </div>
    {:else if panel === "api-keys"}
      <div class="flex flex-col gap-2">
        <button
          class="mb-1 flex w-full cursor-pointer items-center justify-center gap-1.5 border border-border bg-transparent px-2.5 py-1.5 font-mono text-xs tracking-[0.08em] text-muted uppercase transition-all hover:border-accent hover:text-accent"
          onclick={() => {
            showNewKey = !showNewKey;
            newKeyValue = "";
          }}
        >
          <Plus size={12} />
          New key
        </button>

        {#if newKeyValue}
          <div
            class="animate-[fadeUp_0.15s_ease_both] border border-accent/20 bg-accent/6 px-3 py-2.5"
          >
            <p class="mb-2 text-xs tracking-[0.06em] text-accent">
              Copy this key now — it won't be shown again.
            </p>
            <div class="flex items-center gap-1.5">
              <code
                class="flex-1 overflow-hidden font-mono text-xs text-ellipsis whitespace-nowrap text-accent"
                >{newKeyValue}</code
              >
              <button
                class="flex cursor-pointer items-center border-0 bg-transparent p-1.25 text-muted transition-colors hover:text-text"
                onclick={() => navigator.clipboard.writeText(newKeyValue)}
              >
                <Copy size={12} />
              </button>
            </div>
          </div>
        {/if}

        {#if showNewKey}
          <div
            class="flex animate-[fadeUp_0.15s_ease_both] flex-col gap-2.5 border border-border bg-bg p-3"
          >
            <div class="flex flex-col gap-1.5">
              <label class="text-xs tracking-[0.14em] text-muted uppercase" for="key-name"
                >Key name</label
              >
              <input
                class="w-full rounded-none border border-border bg-input-bg px-2.25 py-2.5 font-mono text-base text-text transition-[border-color] outline-none placeholder:text-[#333] focus:border-accent md:py-1.75 md:text-sm"
                id="key-name"
                bind:value={newKeyName}
                placeholder="my-integration"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <p class="text-xs tracking-[0.14em] text-muted uppercase">Permissions</p>
              <div class="grid grid-cols-2 gap-1">
                {#each ["read", "write", "delete", "list"] as perm (perm)}
                  <label
                    class="flex cursor-pointer items-center gap-1.5 font-mono text-sm text-muted"
                  >
                    <input
                      type="checkbox"
                      class="w-auto p-0"
                      checked={newKeyPerms.includes(perm as ApiKeyPermission)}
                      onchange={() => togglePerm(perm as ApiKeyPermission)}
                    />
                    {perm}
                  </label>
                {/each}
              </div>
            </div>
            <div class="flex flex-col gap-1.5">
              <p class="text-xs tracking-[0.14em] text-muted uppercase">Scoped paths</p>
              <!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
              {#each newKeyPaths as _, i (i)}
                <div class="mb-1 flex items-center gap-1">
                  <input
                    class="w-full rounded-none border border-border bg-input-bg px-2.25 py-2.5 font-mono text-base text-text transition-[border-color] outline-none placeholder:text-[#333] focus:border-accent md:py-1.75 md:text-sm"
                    bind:value={newKeyPaths[i]}
                    placeholder="/folder"
                  />
                  {#if newKeyPaths.length > 1}
                    <button
                      class="flex shrink-0 cursor-pointer items-center border-0 bg-transparent p-1.25 text-muted transition-colors hover:text-text"
                      onclick={() => {
                        newKeyPaths = newKeyPaths.filter((_, j) => j !== i);
                      }}
                    >
                      <X size={11} />
                    </button>
                  {/if}
                </div>
              {/each}
              <button
                class="flex cursor-pointer items-center gap-1.25 border-0 bg-transparent px-0 py-1 font-mono text-xs text-muted transition-colors hover:text-text"
                onclick={() => {
                  newKeyPaths = [...newKeyPaths, ""];
                }}>+ Add path</button
              >
            </div>
            <div class="flex justify-end gap-1.5">
              <button
                class="cursor-pointer border border-border bg-transparent px-3 py-1.5 font-mono text-xs tracking-widest text-muted uppercase transition-all hover:border-muted hover:text-text"
                onclick={() => {
                  showNewKey = false;
                }}>Cancel</button
              >
              <button
                class="cursor-pointer border-0 bg-accent px-3 py-1.5 font-mono text-xs font-medium tracking-widest text-bg uppercase transition-opacity hover:opacity-[0.88] disabled:cursor-not-allowed disabled:opacity-40"
                onclick={submitKey}
                disabled={creatingKey || !newKeyName}
              >
                {creatingKey ? "…" : "Create"}
              </button>
            </div>
          </div>
        {/if}

        {#await apiKeysResult}
          <div class="flex justify-center p-4 text-muted"><RefreshCw size={12} class="spin" /></div>
        {:then data}
          {#each data.apiKeys as key (key.id)}
            <div
              class="flex animate-[fadeUp_0.2s_ease_both] flex-col gap-1.5 border border-border bg-bg px-3 py-2.5"
            >
              <div class="text-sm text-text">{key.name}</div>
              <code class="font-mono text-xs text-muted">{key.key_preview}</code>
              <div class="flex flex-wrap items-center gap-1">
                {#each key.permissions as perm (perm)}
                  <span
                    class="border border-border px-1.25 py-px text-xs tracking-widest text-muted uppercase"
                    >{perm}</span
                  >
                {/each}
              </div>
              <div class="flex justify-end">
                <button
                  class="flex cursor-pointer items-center border-0 bg-transparent p-1.25 text-muted transition-colors hover:text-[#ff6b6b]"
                  onclick={() => deleteApiKeyCommand({ id: key.id, permanent: true })}
                  use:tooltip={"Delete permanently"}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          {:else}
            <p class="py-4 text-center text-sm text-border">No API keys</p>
          {/each}
        {/await}
      </div>
    {:else if panel === "stats"}
      <div class="flex flex-col gap-2">
        {#await statsResult}
          <div class="flex justify-center p-4 text-muted"><RefreshCw size={12} class="spin" /></div>
        {:then stats}
          <div class="grid grid-cols-2 gap-2">
            <div class="flex flex-col gap-1.5 border border-border bg-bg px-3 py-3.5">
              <span class="text-xs tracking-[0.14em] text-muted uppercase">Total size</span>
              <span class="font-heading text-2xl leading-none text-accent"
                >{formatFileSize(stats.totalSize)}</span
              >
            </div>
            <div class="flex flex-col gap-1.5 border border-border bg-bg px-3 py-3.5">
              <span class="text-xs tracking-[0.14em] text-muted uppercase">Objects</span>
              <span class="font-heading text-2xl leading-none text-accent"
                >{stats.objectCount.toLocaleString()}</span
              >
            </div>
          </div>
          <button
            class="mt-2 flex cursor-pointer items-center gap-1.25 border-0 bg-transparent px-0 py-1 font-mono text-xs text-muted transition-colors hover:text-text"
            onclick={() => getStorageStatsQuery().refresh()}
          >
            <RefreshCw size={11} /> Refresh
          </button>
        {/await}
      </div>
    {:else if panel === "backups"}
      <div class="flex flex-col gap-3">
        {#if loadingBackups && !backupData}
          <div class="flex justify-center p-4 text-muted"><RefreshCw size={12} class="spin" /></div>
        {:else if backupData}
          {#if !backupData.connected}
            {#if backupData.configured}
              <div class="flex flex-col gap-2.5 border border-amber-500/20 bg-amber-500/5 p-3">
                <p class="text-xs font-bold tracking-[0.14em] text-amber-400 uppercase">
                  Authorization Expired
                </p>
                {#if backupData.lastBackup?.status === "failed" && backupData.lastBackup.error_message}
                  <p class="font-mono text-[11px] leading-relaxed break-words text-red-400">
                    {backupData.lastBackup.error_message}
                  </p>
                {:else}
                  <p class="text-xs leading-relaxed text-muted">
                    Google is no longer accepting the saved credentials. Re-authorize to resume
                    automated backups.
                  </p>
                {/if}
                <button
                  class="mt-1 w-full cursor-pointer border-0 bg-accent py-2 font-mono text-xs font-medium tracking-[0.12em] text-bg uppercase transition-opacity hover:opacity-[0.88]"
                  onclick={handleReconnect}
                >
                  Reconnect Google Drive
                </button>
              </div>
            {/if}

            <div class="flex flex-col gap-2.5 border border-border bg-bg p-3">
              <p class="text-xs font-bold tracking-[0.14em] text-muted uppercase">
                {backupData.configured ? "Update Credentials" : "Connect Google Drive"}
              </p>
              <p class="text-xs leading-relaxed text-muted">
                Configure your Google OAuth credentials to set up automated SQLite backups to Google
                Drive.
              </p>

              <div class="mt-1 flex flex-col gap-1.5">
                <label class="text-xs tracking-[0.14em] text-muted uppercase" for="client-id"
                  >Client ID</label
                >
                <input
                  class="w-full rounded-none border border-border bg-input-bg px-2.25 py-2.5 font-mono text-base text-text transition-[border-color] outline-none placeholder:text-[#333] focus:border-accent md:py-1.75 md:text-sm"
                  id="client-id"
                  bind:value={clientIdInput}
                  placeholder="Google OAuth Client ID"
                />
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="text-xs tracking-[0.14em] text-muted uppercase" for="client-secret"
                  >Client Secret</label
                >
                <input
                  type="password"
                  class="w-full rounded-none border border-border bg-input-bg px-2.25 py-2.5 font-mono text-base text-text transition-[border-color] outline-none placeholder:text-[#333] focus:border-accent md:py-1.75 md:text-sm"
                  id="client-secret"
                  bind:value={clientSecretInput}
                  placeholder="••••••••••••"
                />
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="text-xs tracking-[0.14em] text-muted uppercase" for="redirect-uri"
                  >Redirect URI</label
                >
                <input
                  class="w-full rounded-none border border-border bg-input-bg px-2.25 py-2.5 font-mono text-base text-text transition-[border-color] outline-none placeholder:text-[#333] focus:border-accent md:py-1.75 md:text-sm"
                  id="redirect-uri"
                  bind:value={redirectUriInput}
                />
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="text-xs tracking-[0.14em] text-muted uppercase" for="folder-id"
                  >Google Drive Folder ID (Optional)</label
                >
                <input
                  class="w-full rounded-none border border-border bg-input-bg px-2.25 py-2.5 font-mono text-base text-text transition-[border-color] outline-none placeholder:text-[#333] focus:border-accent md:py-1.75 md:text-sm"
                  id="folder-id"
                  bind:value={folderIdInput}
                  placeholder="Root if empty"
                />
              </div>

              <button
                class="mt-1 w-full cursor-pointer border-0 bg-accent py-2 font-mono text-xs font-medium tracking-[0.12em] text-bg uppercase transition-opacity hover:opacity-[0.88] disabled:cursor-not-allowed disabled:opacity-40"
                onclick={handleSaveConfig}
                disabled={savingConfig || !clientIdInput || !clientSecretInput || !redirectUriInput}
              >
                {savingConfig ? "Configuring..." : "Connect Google Drive"}
              </button>
            </div>
          {:else}
            <div class="flex flex-col gap-3">
              <div
                class="flex items-center justify-between border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5"
              >
                <div class="flex items-center gap-2">
                  <div class="h-2 w-2 animate-pulse rounded-full bg-emerald-500"></div>
                  <span class="font-mono text-xs text-emerald-400">Connected</span>
                </div>
                <button
                  class="cursor-pointer border border-red-500/30 bg-transparent px-2 py-0.5 font-mono text-[10px] tracking-wider text-red-400 uppercase transition-colors hover:bg-red-500/10"
                  onclick={handleDisconnect}
                >
                  Disconnect
                </button>
              </div>

              {#if backupData.folder_id}
                <div
                  class="border border-border bg-bg/50 px-3 py-2 font-mono text-[11px] text-muted"
                >
                  <span class="uppercase">Folder ID:</span>
                  <span class="text-text select-all">{backupData.folder_id}</span>
                </div>
              {/if}

              <button
                class="w-full cursor-pointer border border-border bg-transparent py-2 font-mono text-xs tracking-widest text-muted uppercase transition-all hover:border-accent hover:text-accent disabled:opacity-40"
                onclick={handleTriggerBackup}
                disabled={triggeringBackup}
              >
                {triggeringBackup ? "Backing up..." : "Backup Database Now"}
              </button>

              <div class="mt-2">
                <p class="mb-2 text-[10px] font-bold tracking-widest text-muted uppercase">
                  Backup History
                </p>
                <div class="flex max-h-60 flex-col gap-1.5 overflow-y-auto pr-1">
                  {#each backupData.backups as backup (backup.id)}
                    <div
                      class="flex flex-col border border-border bg-bg/30 px-2.5 py-2 font-mono text-xs"
                    >
                      <div class="flex items-center justify-between">
                        <span class="text-text"
                          >{new Date(backup.timestamp * 1000).toLocaleString()}</span
                        >
                        <span
                          class="px-1 py-0.25 text-[10px] font-bold uppercase {backup.status ===
                          'success'
                            ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                            : 'border border-red-500/20 bg-red-500/10 text-red-400'}"
                        >
                          {backup.status}
                        </span>
                      </div>
                      {#if backup.error_message}
                        <p
                          class="mt-1 border-t border-red-500/10 pt-1 text-[11px] leading-tight text-red-400"
                        >
                          {backup.error_message}
                        </p>
                      {/if}
                      {#if backup.drive_file_id}
                        <span
                          class="mt-1 overflow-hidden text-[10px] text-ellipsis whitespace-nowrap text-muted"
                        >
                          ID: {backup.drive_file_id}
                        </span>
                      {/if}
                    </div>
                  {:else}
                    <p class="text-center py-4 text-xs text-border">No backups recorded yet</p>
                  {/each}
                </div>
              </div>
            </div>
          {/if}
        {/if}
      </div>
    {/if}
  </div>
</aside>
