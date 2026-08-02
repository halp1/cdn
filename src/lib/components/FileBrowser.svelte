<script lang="ts">
  /* eslint-disable svelte/no-navigation-without-resolve */
  import { goto, invalidateAll } from "$app/navigation";
  import {
    FolderPlus,
    Upload,
    Trash2,
    LayoutGrid,
    List,
    Plus,
    X,
    ChevronLeft,
    CheckCheck,
    Download,
    ListChecks
  } from "@lucide/svelte";
  import Header from "$lib/components/Header.svelte";
  import FileTree from "$lib/components/FileTree.svelte";
  import FileList from "$lib/components/FileList.svelte";
  import FileViewer from "$lib/components/FileViewer.svelte";
  import RightPanel from "$lib/components/RightPanel.svelte";
  import NewFolderModal from "$lib/components/NewFolderModal.svelte";
  import DeleteModal from "$lib/components/DeleteModal.svelte";
  import DeployPanel from "$lib/components/DeployPanel.svelte";
  import KeyboardManager, { type KeyBind } from "$lib/components/KeyboardManager.svelte";
  import FileSearchModal from "$lib/components/FileSearchModal.svelte";
  import {
    listObjectsQuery,
    listAllObjectsQuery,
    deleteObjectCommand,
    moveObjectCommand,
    moveFolderCommand,
    getUploadUrl,
    createFolderCommand,
    deleteFolderCommand,
    getDownloadUrl,
    togglePrivateCommand
  } from "$lib/api/r2.remote";
  import type { R2Object } from "$lib/r2-server";
  import { SvelteMap, SvelteSet } from "svelte/reactivity";
  import { sanitizeFilename } from "$lib/filename-utils";
  import { notifications } from "$lib/notifications.svelte";
  import { collectDroppedFiles, type DroppedFile } from "$lib/utils";
  import { tooltip } from "$lib/tooltip";

  interface Props {
    path: string;
    username: string;
  }
  let { path, username }: Props = $props();

  let selected = $state<Set<string>>(new Set());
  let previewObj = $state<R2Object | null>(null);
  let isSearchModalOpen = $state(false);
  let searchModalQuery = $state("");

  type RightPanelMode =
    | "upload-links"
    | "api-keys"
    | "stats"
    | "preview"
    | "deploy"
    | "backups"
    | null;
  let rightPanel = $state<RightPanelMode>(null);

  let viewMode = $state<"list" | "grid">("list");

  $effect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("cdn_view_mode");
      if (saved === "list" || saved === "grid") {
        viewMode = saved;
      }
    }
  });

  const toggleViewMode = () => {
    const next = viewMode === "list" ? "grid" : "list";
    viewMode = next;
    if (typeof window !== "undefined") {
      localStorage.setItem("cdn_view_mode", next);
    }
  };

  let treeWidth = $state(220);
  let windowWidth = $state(typeof window !== "undefined" ? window.innerWidth : 1280);
  let rightRatio = $state(0.5);
  const rightWidth = $derived(Math.max(220, Math.round((windowWidth - treeWidth) * rightRatio)));

  let filesData = $state<{ objects: R2Object[]; prefix: string } | null>(null);
  let allObjectsData = $state<{ objects: R2Object[] } | null>(null);
  let uploadingFiles = $state(new SvelteMap<string, number>());
  let movingFiles = $state(new SvelteSet<string>());
  let movingTarget = $state<string | null>(null);
  let treeScrollKey = $state<string | null>(null);

  const allObjectsWithUploading = $derived.by(() => {
    const base = allObjectsData?.objects ?? [];
    if (uploadingFiles.size === 0) return base;
    const existing = new Set(base.map((o) => o.key));
    const extras: R2Object[] = [];
    for (const [key] of uploadingFiles) {
      if (!existing.has(key))
        extras.push({ key, isFolder: false, size: 0, lastModified: new Date() });
    }
    return extras.length > 0 ? [...base, ...extras] : base;
  });

  const refreshFiles = async () => {
    filesData = await listObjectsQuery({ prefix: path });
  };

  const refreshAllObjects = async () => {
    allObjectsData = await listAllObjectsQuery();
  };

  $effect(() => {
    const p = path;
    filesData = null;
    selected = new Set();
    listObjectsQuery({ prefix: p }).then((result) => {
      filesData = result;
    });
  });

  let pendingSelect = $state<{ key: string; forPath: string } | null>(null);
  let scrollToKey = $state<string | null>(null);

  $effect(() => {
    if (pendingSelect !== null && filesData !== null && path === pendingSelect.forPath) {
      const key = pendingSelect.key;
      pendingSelect = null;
      scrollToKey = key;
      handleSelect([key], true);
    }
  });

  $effect(() => {
    void refreshAllObjects();
  });

  // Auto-expand FileTree ancestors when file is selected from search
  $effect(() => {
    if (selected.size > 0) {
      // This effect runs whenever selected changes
      // FileTree watches currentPath and will auto-expand accordingly
    }
  });

  let uploadInput = $state<HTMLInputElement | null>(null);

  // --- Touch shell state -------------------------------------------------
  // All three start closed/off, so the server and client agree on markup.
  let drawerOpen = $state(false);
  let selectMode = $state(false);
  let fabOpen = $state(false);

  const closeOverlays = () => {
    drawerOpen = false;
    fabOpen = false;
  };

  const exitSelectMode = () => {
    selectMode = false;
    selected = new Set();
  };

  // The breadcrumb scrolls horizontally on phones; keep the current folder
  // (the tail) in view rather than the "root /" prefix.
  let crumbEl = $state<HTMLElement | null>(null);
  $effect(() => {
    void path;
    if (crumbEl) crumbEl.scrollLeft = crumbEl.scrollWidth;
  });

  const parentPath = $derived.by(() => {
    if (!path) return null;
    const trimmed = path.replace(/\/$/, "");
    const idx = trimmed.lastIndexOf("/");
    return idx === -1 ? "" : trimmed.slice(0, idx + 1);
  });

  const navigate = (newPath: string) => {
    closeOverlays();
    if (selectMode) exitSelectMode();
    if (!newPath) {
      goto("/");
    } else {
      const normalized = newPath.endsWith("/") ? newPath : newPath + "/";
      goto("/files/" + normalized);
    }
  };

  const handleSelect = (keys: string[], replace: boolean) => {
    if (replace) {
      selected = new SvelteSet(keys);
    } else {
      const next = new SvelteSet(selected);
      for (const key of keys) {
        if (next.has(key)) next.delete(key);
        else next.add(key);
      }
      selected = next;
    }
  };

  const handlePreview = (obj: R2Object) => {
    closeOverlays();
    previewObj = obj;
    rightPanel = "preview";
  };

  const closePanel = () => {
    rightPanel = null;
    previewObj = null;
  };

  const handleTogglePanel = (panel: string) => {
    const p = panel as RightPanelMode;
    rightPanel = rightPanel === p ? null : p;
    if (p !== "preview") previewObj = null;
  };

  let deleteModalKeys = $state<string[] | null>(null);
  let sortedFileItems = $state<R2Object[]>([]);

  const handleDelete = (keys: string[]) => {
    deleteModalKeys = keys;
  };

  const handleDownload = async (keys: string[]) => {
    const fileKeys = keys.filter((k) => !k.endsWith("/"));
    const folderKeys = keys.filter((k) => k.endsWith("/"));
    const hasAnyDownloadable = fileKeys.length > 0 || folderKeys.length > 0;
    if (!hasAnyDownloadable) {
      notifications.error("No downloadable files selected");
      return;
    }
    const useZip = fileKeys.length + folderKeys.length > 5 || folderKeys.length > 0;
    if (useZip) {
      const dismiss = notifications.loading("Preparing zip\u2026");
      try {
        const res = await fetch("/api/internal/zip", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paths: keys })
        });
        if (!res.ok) throw new Error(await res.text());
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "download.zip";
        a.click();
        URL.revokeObjectURL(url);
        dismiss();
      } catch (e) {
        dismiss();
        notifications.error(e instanceof Error ? e.message : "Download failed");
      }
    } else {
      for (let i = 0; i < fileKeys.length; i++) {
        try {
          const { url } = await getDownloadUrl({ path: fileKeys[i] });
          await new Promise<void>((resolve) => {
            setTimeout(() => {
              const a = document.createElement("a");
              a.href = url;
              a.download = fileKeys[i].split("/").pop() ?? "file";
              a.click();
              resolve();
            }, i * 150);
          });
        } catch (e) {
          notifications.error(e instanceof Error ? e.message : "Download failed");
        }
      }
    }
  };

  const confirmDelete = async () => {
    const keys = deleteModalKeys;
    deleteModalKeys = null;
    if (!keys) return;
    try {
      for (const key of keys) {
        if (key.endsWith("/")) await deleteFolderCommand({ path: key });
        else await deleteObjectCommand({ path: key });
      }
    } catch (e) {
      notifications.error(e instanceof Error ? e.message : "Delete failed");
    }
    selected = new Set();
    await invalidateAll();
    await Promise.all([refreshFiles(), refreshAllObjects()]);
  };

  const handleRenameCommit = async (oldKey: string, newKey: string) => {
    try {
      if (oldKey.endsWith("/")) {
        await moveFolderCommand({ sourcePrefix: oldKey, destPrefix: newKey });
      } else {
        await moveObjectCommand({ sourcePath: oldKey, destPath: newKey });
      }
    } catch (e) {
      notifications.error(e instanceof Error ? e.message : "Rename failed");
      return;
    }
    await invalidateAll();
    await Promise.all([refreshFiles(), refreshAllObjects()]);
  };

  const handleTogglePrivate = async (key: string, isFolder: boolean, value: number | null) => {
    try {
      await togglePrivateCommand({ path: key, isFolder, isPrivate: value });
    } catch (e) {
      notifications.error(e instanceof Error ? e.message : "Failed to change visibility");
      return;
    }
    await invalidateAll();
    await Promise.all([refreshFiles(), refreshAllObjects()]);
  };

  const handleFileDrop = async (targetPrefix: string, files: DroppedFile[]) => {
    const uploads = files.map(async ({ file, relativePath }) => {
      const sanitizedPath = relativePath.split("/").map(sanitizeFilename).join("/");
      const filePath = targetPrefix + sanitizedPath;
      uploadingFiles.set(filePath, 0);
      treeScrollKey = filePath;
      try {
        const result = await getUploadUrl({
          path: filePath,
          contentType: file.type || "application/octet-stream",
          size: file.size
        });
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", result.url);
          xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) uploadingFiles.set(filePath, e.loaded / e.total);
          };
          xhr.onload = () =>
            xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`));
          xhr.onerror = () => reject(new Error("Network error"));
          xhr.send(file);
        });
      } catch (e) {
        notifications.error(e instanceof Error ? e.message : "Upload failed");
      } finally {
        uploadingFiles.delete(filePath);
      }
    });
    await Promise.all(uploads);
    await invalidateAll();
    await Promise.all([refreshFiles(), refreshAllObjects()]);
  };

  const handleMoveToFolder = async (targetPrefix: string, sourceKeys: string[]) => {
    const anyValid = sourceKeys.some((key) => {
      const isFolder = key.endsWith("/");
      const basename = isFolder
        ? (key.replace(/\/$/, "").split("/").pop() ?? "") + "/"
        : (key.split("/").pop() ?? "");
      if (!basename || basename === "/") return false;
      const destKey = targetPrefix + basename;
      if (key === destKey) return false;
      if (isFolder && (targetPrefix === key || targetPrefix.startsWith(key))) return false;
      return true;
    });
    if (anyValid) {
      if (targetPrefix !== "") movingFiles.add(targetPrefix);
      movingTarget = targetPrefix;
    }
    const moves = sourceKeys.map(async (key) => {
      const isFolder = key.endsWith("/");
      const basename = isFolder
        ? (key.replace(/\/$/, "").split("/").pop() ?? "") + "/"
        : (key.split("/").pop() ?? "");
      if (!basename || basename === "/") return;
      const destKey = targetPrefix + basename;
      if (key === destKey) return;
      if (isFolder && (targetPrefix === key || targetPrefix.startsWith(key))) return;
      movingFiles.add(key);
      try {
        if (isFolder) {
          await moveFolderCommand({ sourcePrefix: key, destPrefix: destKey });
        } else {
          await moveObjectCommand({ sourcePath: key, destPath: destKey });
        }
      } catch (e) {
        notifications.error(e instanceof Error ? e.message : "Move failed");
      } finally {
        movingFiles.delete(key);
      }
    });
    await Promise.all(moves);
    if (targetPrefix !== "") movingFiles.delete(targetPrefix);
    movingTarget = null;
    selected = new Set();
    await invalidateAll();
    await Promise.all([refreshFiles(), refreshAllObjects()]);
  };

  let showNewFolderModal = $state(false);

  const isAnyModalOpen = $derived(
    isSearchModalOpen || deleteModalKeys !== null || showNewFolderModal || drawerOpen || fabOpen
  );

  const arrowNavigate = (dir: 1 | -1) => {
    if (sortedFileItems.length === 0) return;
    let idx: number;
    if (selected.size === 0) {
      idx = dir === 1 ? 0 : sortedFileItems.length - 1;
    } else {
      let boundary = dir === 1 ? -1 : sortedFileItems.length;
      for (let i = 0; i < sortedFileItems.length; i++) {
        if (selected.has(sortedFileItems[i].key)) {
          if (dir === 1) boundary = Math.max(boundary, i);
          else boundary = Math.min(boundary, i);
        }
      }
      idx = Math.max(0, Math.min(sortedFileItems.length - 1, boundary + dir));
    }
    const item = sortedFileItems[idx];
    handleSelect([item.key], true);
    if (rightPanel === "preview" && !item.isFolder) handlePreview(item);
  };

  const keybinds = $derived<KeyBind[]>([
    {
      key: "k",
      ctrlOrMeta: true,
      allowInModal: true,
      action: () => {
        if (isSearchModalOpen) {
          isSearchModalOpen = false;
          searchModalQuery = "";
        } else if (!isAnyModalOpen) {
          isSearchModalOpen = true;
        }
      }
    },
    {
      key: "Delete",
      action: () => {
        if (selected.size > 0) handleDelete([...selected]);
      }
    },
    {
      key: "ArrowDown",
      action: () => arrowNavigate(1)
    },
    {
      key: "ArrowUp",
      action: () => arrowNavigate(-1)
    },
    {
      key: "Escape",
      action: () => {
        // Unwind the touch shell one layer at a time, innermost first.
        if (fabOpen) fabOpen = false;
        else if (drawerOpen) drawerOpen = false;
        else if (rightPanel !== null) closePanel();
        else if (selectMode) exitSelectMode();
      }
    }
  ]);

  const selectAllVisible = () => {
    const keys = sortedFileItems.map((o) => o.key);
    const allSelected = keys.length > 0 && keys.every((k) => selected.has(k));
    selected = allSelected ? new SvelteSet() : new SvelteSet(keys);
  };

  const handleNewFolder = () => {
    showNewFolderModal = true;
  };

  const confirmNewFolder = async (name: string) => {
    showNewFolderModal = false;
    const newPath = path + name.replace(/[/\\]/g, "") + "/";
    try {
      await createFolderCommand({ path: newPath });
    } catch (e) {
      notifications.error(e instanceof Error ? e.message : "Failed to create folder");
      return;
    }
    await invalidateAll();
    await Promise.all([refreshFiles(), refreshAllObjects()]);
  };

  const handleUpload = () => {
    uploadInput?.click();
  };

  const handleFileUpload = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;
    await handleFileDrop(
      path,
      [...files].map((file) => ({ file, relativePath: file.name }))
    );
    input.value = "";
  };

  const handleFileSelect = (file: { key: string; isFolder: boolean }) => {
    const lastSlashIndex = file.key.lastIndexOf("/");
    const parentPath = lastSlashIndex > 0 ? file.key.slice(0, lastSlashIndex) + "/" : "";

    navigate(parentPath);
    pendingSelect = { key: file.key, forPath: parentPath };

    if (!file.isFolder) {
      handlePreview({ key: file.key, isFolder: false });
    }
  };

  const selectedCount = $derived(selected.size);

  let dragOverCrumb = $state<string | null>(null);

  const breadcrumbs = $derived.by(() => {
    if (!path) return [];
    const parts = path.replace(/\/$/, "").split("/").filter(Boolean);
    return parts.map((part, i) => ({
      label: part,
      href: "/files/" + parts.slice(0, i + 1).join("/") + "/",
      targetPath: parts.slice(0, i + 1).join("/") + "/"
    }));
  });
</script>

<svelte:window bind:innerWidth={windowWidth} />

<KeyboardManager {keybinds} {isAnyModalOpen} />

<div class="h-app relative z-1 flex flex-col overflow-hidden bg-bg">
  <Header
    {username}
    onOpenSearchModal={() => {
      closeOverlays();
      isSearchModalOpen = true;
    }}
    onUpload={handleUpload}
    onToggleDrawer={() => {
      fabOpen = false;
      drawerOpen = !drawerOpen;
    }}
    rightPanel={rightPanel ?? ""}
    onTogglePanel={handleTogglePanel}
  />

  <div class="flex min-h-0 flex-1 overflow-hidden">
    {#if allObjectsData === null}
      <div class="hidden w-55 shrink-0 border-r border-border bg-surface md:block"></div>
    {:else}
      <FileTree
        objects={allObjectsWithUploading}
        currentPath={path}
        onNavigate={navigate}
        onPreview={(obj) => {
          handlePreview(obj as import("$lib/r2-server").R2Object);
          const lastSlash = obj.key.lastIndexOf("/");
          const forPath = lastSlash > 0 ? obj.key.slice(0, lastSlash + 1) : "";
          pendingSelect = { key: obj.key, forPath };
        }}
        onDropFiles={handleFileDrop}
        onDropMove={handleMoveToFolder}
        onDelete={handleDelete}
        onRenameCommit={handleRenameCommit}
        {uploadingFiles}
        {movingFiles}
        {movingTarget}
        scrollToKey={treeScrollKey}
        width={treeWidth}
        onResize={(w) => {
          treeWidth = w;
        }}
        open={drawerOpen}
        onClose={() => (drawerOpen = false)}
      />
    {/if}

    <main class="flex min-w-0 flex-1 flex-col overflow-hidden">
      {#if selectMode}
        <!-- Contextual bar: replaces the breadcrumb while picking files. -->
        <div
          class="app-chrome flex h-12 shrink-0 items-center gap-1 border-b border-border bg-surface px-1 md:hidden"
        >
          <button
            class="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent text-muted active:bg-white/6"
            onclick={exitSelectMode}
            aria-label="Exit selection"
          >
            <X size={19} />
          </button>
          <span class="flex-1 truncate font-mono text-sm text-text">{selected.size} selected</span>
          <button
            class="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent text-muted active:bg-white/6"
            onclick={selectAllVisible}
            aria-label="Select all"
          >
            <CheckCheck size={19} />
          </button>
          <button
            class="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent text-muted active:bg-white/6 disabled:opacity-30"
            onclick={() => handleDownload([...selected])}
            disabled={selected.size === 0}
            aria-label="Download selected"
          >
            <Download size={19} />
          </button>
          <button
            class="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent text-[#ff6b6b] active:bg-white/6 disabled:opacity-30"
            onclick={() => handleDelete([...selected])}
            disabled={selected.size === 0}
            aria-label="Delete selected"
          >
            <Trash2 size={19} />
          </button>
        </div>
      {/if}

      <div
        class="relative h-11 shrink-0 items-center justify-between gap-2 border-b border-border px-1 md:flex md:h-9 md:px-3 {selectMode
          ? 'hidden'
          : 'flex'}"
      >
        {#if parentPath !== null}
          <button
            class="flex h-10 w-9 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent text-muted active:bg-white/6 md:hidden"
            onclick={() => navigate(parentPath)}
            aria-label="Up one folder"
          >
            <ChevronLeft size={20} />
          </button>
        {/if}
        <nav
          bind:this={crumbEl}
          class="z-10 flex h-full min-w-0 flex-1 items-stretch overflow-x-auto bg-bg pl-1.5 text-sm [scrollbar-width:none] md:overflow-visible md:pl-0 [&::-webkit-scrollbar]:hidden"
          aria-label="Breadcrumb"
        >
          {#if breadcrumbs.length === 0}
            <span class="flex shrink-0 items-center px-0.5 text-text">root</span>
          {:else}
            <a
              href="/"
              class="flex shrink-0 items-center justify-center px-0.5 text-muted transition-colors hover:text-text {dragOverCrumb ===
              ''
                ? 'bg-accent/10 text-accent ring-1 ring-accent'
                : 'bg-bg'}"
              ondragover={(e) => {
                e.preventDefault();
                dragOverCrumb = "";
                e.dataTransfer!.dropEffect = e.dataTransfer!.types.includes(
                  "application/x-cdn-move"
                )
                  ? "move"
                  : "copy";
              }}
              ondragleave={(e) => {
                if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node))
                  dragOverCrumb = null;
              }}
              ondrop={(e) => {
                e.preventDefault();
                dragOverCrumb = null;
                if (e.dataTransfer!.types.includes("application/x-cdn-move")) {
                  handleMoveToFolder(
                    "",
                    JSON.parse(e.dataTransfer!.getData("application/x-cdn-move"))
                  );
                } else if (e.dataTransfer!.files.length > 0) {
                  collectDroppedFiles(e.dataTransfer!).then((files) => handleFileDrop("", files));
                }
              }}><span>root</span></a
            >
            {#each breadcrumbs as crumb, i (crumb.href)}
              <div
                class="flex shrink-0 items-center justify-center bg-bg px-1 text-border select-none"
              >
                <span>/</span>
              </div>
              {#if i === breadcrumbs.length - 1}
                <div
                  class="flex shrink-0 items-center justify-center bg-bg px-0.5 pr-3 whitespace-nowrap text-text"
                >
                  <span>{crumb.label}</span>
                </div>
              {:else}
                <a
                  href={crumb.href}
                  class="flex shrink-0 items-center justify-center px-0.5 whitespace-nowrap text-muted transition-colors hover:text-text {dragOverCrumb ===
                  crumb.targetPath
                    ? 'bg-accent/10 text-accent ring-1 ring-accent'
                    : 'bg-bg'}"
                  ondragover={(e) => {
                    e.preventDefault();
                    dragOverCrumb = crumb.targetPath;
                    e.dataTransfer!.dropEffect = e.dataTransfer!.types.includes(
                      "application/x-cdn-move"
                    )
                      ? "move"
                      : "copy";
                  }}
                  ondragleave={(e) => {
                    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node))
                      dragOverCrumb = null;
                  }}
                  ondrop={(e) => {
                    e.preventDefault();
                    const tp = crumb.targetPath;
                    dragOverCrumb = null;
                    if (e.dataTransfer!.types.includes("application/x-cdn-move")) {
                      handleMoveToFolder(
                        tp,
                        JSON.parse(e.dataTransfer!.getData("application/x-cdn-move"))
                      );
                    } else if (e.dataTransfer!.files.length > 0) {
                      collectDroppedFiles(e.dataTransfer!).then((files) =>
                        handleFileDrop(tp, files)
                      );
                    }
                  }}
                >
                  <span>{crumb.label}</span>
                </a>
              {/if}
            {/each}
          {/if}
        </nav>
        <div class="flex shrink-0 items-center md:hidden">
          <button
            class="flex h-10 w-10 cursor-pointer items-center justify-center border-none bg-transparent text-muted active:bg-white/6"
            onclick={toggleViewMode}
            aria-label={viewMode === "list" ? "Tiled view" : "List view"}
          >
            {#if viewMode === "list"}
              <LayoutGrid size={18} />
            {:else}
              <List size={18} />
            {/if}
          </button>
          <button
            class="flex h-10 w-10 cursor-pointer items-center justify-center border-none bg-transparent text-muted active:bg-white/6"
            onclick={() => {
              fabOpen = false;
              selectMode = true;
            }}
            aria-label="Select files"
          >
            <ListChecks size={18} />
          </button>
        </div>

        <div class="hidden shrink-0 items-center gap-1 md:flex">
          {#if selected.size > 0}
            <button
              class="flex cursor-pointer items-center gap-1.25 border border-[#ff6b6b]/40 bg-transparent px-2 py-1 font-mono text-xs tracking-[0.06em] text-[#ff6b6b] uppercase transition-[color,border-color,background] hover:border-[#ff6b6b]"
              onclick={() => handleDelete([...selected])}
              use:tooltip={"Delete selected"}
            >
              <Trash2 size={13} />
              <span>Delete {selected.size}</span>
            </button>
          {/if}
          <button
            class="flex cursor-pointer items-center gap-1.25 border border-border bg-transparent px-2 py-1 font-mono text-xs tracking-[0.06em] text-muted uppercase transition-[color,border-color,background] hover:border-muted hover:bg-white/3 hover:text-text"
            onclick={handleNewFolder}
            use:tooltip={"New folder"}
          >
            <FolderPlus size={13} />
            <span>New folder</span>
          </button>
          <button
            class="flex cursor-pointer items-center gap-1.25 border border-border bg-transparent px-2 py-1 font-mono text-xs tracking-[0.06em] text-muted uppercase transition-[color,border-color,background] hover:border-muted hover:bg-white/3 hover:text-text"
            onclick={handleUpload}
            use:tooltip={"Upload"}
          >
            <Upload size={13} />
            <span>Upload</span>
          </button>
          <button
            class="flex cursor-pointer items-center gap-1.25 border border-border bg-transparent px-2 py-1 font-mono text-xs tracking-[0.06em] text-muted uppercase transition-[color,border-color,background] hover:border-muted hover:bg-white/3 hover:text-text"
            onclick={toggleViewMode}
            use:tooltip={viewMode === "list" ? "Tiled view" : "List view"}
          >
            {#if viewMode === "list"}
              <LayoutGrid size={13} />
              <span>Tiled</span>
            {:else}
              <List size={13} />
              <span>List</span>
            {/if}
          </button>
        </div>
      </div>

      <div class="min-h-0 flex-1">
        {#if filesData === null}
          <div
            class="flex h-50 items-center justify-center text-sm tracking-widest text-muted uppercase"
          >
            Loading…
          </div>
        {:else}
          <FileList
            objects={filesData.objects}
            allObjects={allObjectsData?.objects ?? []}
            prefix={path}
            {selected}
            {scrollToKey}
            previewKey={previewObj?.key ?? null}
            onSelect={handleSelect}
            onNavigate={navigate}
            onDelete={handleDelete}
            onRenameCommit={handleRenameCommit}
            onPreview={handlePreview}
            onNewFolder={handleNewFolder}
            onDropFiles={(files) => handleFileDrop(path, files)}
            onDropMove={(keys) => handleMoveToFolder(path, keys)}
            onDownload={handleDownload}
            onTogglePrivate={handleTogglePrivate}
            {uploadingFiles}
            {movingFiles}
            searchQuery=""
            onSortedChange={(items) => {
              sortedFileItems = items;
            }}
            {viewMode}
            {selectMode}
          />
        {/if}
      </div>
    </main>

    {#if rightPanel}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="fixed inset-0 z-55 bg-black/60 md:hidden" onclick={closePanel}></div>
    {/if}

    {#if rightPanel && rightPanel !== "preview" && rightPanel !== "deploy"}
      <RightPanel
        panel={rightPanel}
        onClose={closePanel}
        width={rightWidth}
        onResize={(w) => {
          rightRatio = w / (windowWidth - treeWidth);
        }}
      />
    {:else if rightPanel === "deploy"}
      <DeployPanel
        onClose={closePanel}
        width={rightWidth}
        onResize={(w) => {
          rightRatio = w / (windowWidth - treeWidth);
        }}
      />
    {:else if rightPanel === "preview"}
      <aside
        class="fixed inset-x-0 bottom-0 z-60 flex h-[92dvh] shrink-0 animate-[sheetUp_0.22s_cubic-bezier(0.32,0.72,0,1)] flex-col overflow-hidden border-t border-border bg-surface pb-(--safe-bottom) md:relative md:inset-auto md:z-auto md:h-auto md:w-(--panel-w) md:animate-none md:border-t-0 md:border-l md:pb-0"
        style="--panel-w: {rightWidth}px"
      >
        <div class="flex shrink-0 justify-center pt-2.5 pb-1 md:hidden">
          <div class="h-1 w-10 rounded-full bg-border"></div>
        </div>

        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div
          class="absolute top-0 left-0 z-2 hidden h-full w-1 cursor-col-resize hover:bg-accent hover:opacity-50 md:block"
          onmousedown={(e) => {
            let sx = e.clientX,
              sw = rightWidth;
            const contentW = windowWidth - treeWidth;
            const mm = (ev: MouseEvent) => {
              const newW = Math.max(220, Math.min(contentW - 28, sw - (ev.clientX - sx)));
              rightRatio = newW / contentW;
            };
            const mu = () => {
              window.removeEventListener("mousemove", mm);
              window.removeEventListener("mouseup", mu);
            };
            window.addEventListener("mousemove", mm);
            window.addEventListener("mouseup", mu);
            e.preventDefault();
          }}
          role="separator"
          aria-orientation="vertical"
          tabindex="-1"
        ></div>
        <FileViewer obj={previewObj} onClose={closePanel} />
      </aside>
    {/if}
  </div>

  <div
    class="hidden h-6 shrink-0 items-center justify-end border-t border-border bg-surface px-3 md:flex"
  >
    <div class="text-xs tracking-[0.08em] text-muted">
      <span>{selectedCount} selected</span>
    </div>
  </div>
</div>

<!-- Floating action button. Touch-only; desktop keeps the toolbar buttons. -->
{#if !selectMode}
  {#if fabOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="fixed inset-0 z-40 animate-[backdropIn_0.15s_ease] bg-black/50 md:hidden"
      onclick={() => (fabOpen = false)}
    ></div>
  {/if}

  <div
    class="app-chrome pointer-events-none fixed right-4 bottom-4 z-45 flex flex-col items-end gap-2.5 md:hidden"
    style="margin-bottom: var(--safe-bottom)"
  >
    {#if fabOpen}
      <button
        class="pointer-events-auto flex animate-[fadeUp_0.12s_ease_both] cursor-pointer items-center gap-2.5 border border-border bg-surface px-4 py-3 font-mono text-sm tracking-[0.06em] text-text uppercase shadow-lg active:bg-white/6"
        onclick={() => {
          fabOpen = false;
          handleNewFolder();
        }}
      >
        <FolderPlus size={16} />
        New folder
      </button>
      <button
        class="pointer-events-auto flex animate-[fadeUp_0.12s_ease_both] cursor-pointer items-center gap-2.5 border border-border bg-surface px-4 py-3 font-mono text-sm tracking-[0.06em] text-text uppercase shadow-lg active:bg-white/6"
        style="animation-delay: 30ms"
        onclick={() => {
          fabOpen = false;
          handleUpload();
        }}
      >
        <Upload size={16} />
        Upload
      </button>
    {/if}
    <button
      class="pointer-events-auto flex h-14 w-14 cursor-pointer items-center justify-center border-none bg-accent text-bg shadow-[0_4px_16px_rgba(0,0,0,0.5)] active:opacity-85"
      onclick={() => (fabOpen = !fabOpen)}
      aria-label={fabOpen ? "Close actions" : "Add"}
      aria-expanded={fabOpen}
    >
      <Plus size={28} class="transition-transform duration-150 {fabOpen ? 'rotate-45' : ''}" />
    </button>
  </div>
{/if}

<input
  bind:this={uploadInput}
  type="file"
  multiple
  class="pointer-events-none fixed h-0 w-0 opacity-0"
  onchange={handleFileUpload}
/>

{#if showNewFolderModal}
  <NewFolderModal
    onConfirm={confirmNewFolder}
    onCancel={() => {
      showNewFolderModal = false;
    }}
  />
{/if}

{#if deleteModalKeys !== null}
  <DeleteModal
    count={deleteModalKeys.length}
    onConfirm={confirmDelete}
    onCancel={() => {
      deleteModalKeys = null;
    }}
  />
{/if}

{#if allObjectsData !== null}
  <FileSearchModal
    isOpen={isSearchModalOpen}
    allObjects={allObjectsData.objects}
    searchQuery={searchModalQuery}
    onQueryChange={(q) => (searchModalQuery = q)}
    onFileSelect={handleFileSelect}
    onClose={() => {
      isSearchModalOpen = false;
      searchModalQuery = "";
    }}
  />
{/if}
