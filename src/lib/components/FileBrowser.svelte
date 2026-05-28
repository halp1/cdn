<script lang="ts">
  /* eslint-disable svelte/no-navigation-without-resolve */
  import { goto, invalidateAll } from "$app/navigation";
  import { FolderPlus, Upload, Trash2 } from "@lucide/svelte";
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
    getDownloadUrl
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

  type RightPanelMode = "upload-links" | "api-keys" | "stats" | "preview" | "deploy" | null;
  let rightPanel = $state<RightPanelMode>(null);

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

  const navigate = (newPath: string) => {
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
    previewObj = obj;
    rightPanel = "preview";
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
    isSearchModalOpen || deleteModalKeys !== null || showNewFolderModal
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
        if (rightPanel !== null) {
          rightPanel = null;
          previewObj = null;
        }
      }
    }
  ]);

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
    // Extract parent folder path
    const lastSlashIndex = file.key.lastIndexOf("/");
    const parentPath = lastSlashIndex > 0 ? file.key.slice(0, lastSlashIndex) + "/" : "";

    // Navigate to parent folder
    navigate(parentPath);

    // Select the file - use setTimeout to ensure navigation completes first
    setTimeout(() => {
      handleSelect([file.key], true);

      // Open preview if it's not a folder
      if (!file.isFolder && filesData?.objects) {
        const obj = filesData.objects.find((o) => o.key === file.key);
        if (obj) handlePreview(obj as R2Object);
      }
    }, 0);
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

<div class="relative z-1 flex h-screen flex-col overflow-hidden bg-bg">
  <Header
    {username}
    onOpenSearchModal={() => {
      isSearchModalOpen = true;
    }}
    onUpload={handleUpload}
    rightPanel={rightPanel ?? ""}
    onTogglePanel={handleTogglePanel}
  />

  <div class="flex min-h-0 flex-1 overflow-hidden">
    {#if allObjectsData === null}
      <div class="w-55 shrink-0 border-r border-border bg-surface"></div>
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
      />
    {/if}

    <main class="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div
        class="relative flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border px-3"
      >
        <nav
          class="z-10 flex h-full min-w-0 flex-1 items-stretch bg-bg text-sm"
          aria-label="Breadcrumb"
        >
          {#if breadcrumbs.length === 0}
            <span class="flex items-center px-0.5 text-text">root</span>
          {:else}
            <a
              href="/"
              class="flex items-center justify-center px-0.5 text-muted transition-colors hover:text-text {dragOverCrumb ===
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
              <div class="flex items-center justify-center bg-bg px-1 text-border select-none">
                <span>/</span>
              </div>
              {#if i === breadcrumbs.length - 1}
                <div
                  class="flex items-center justify-center bg-bg px-0.5 pr-3 whitespace-nowrap text-text"
                >
                  <span>{crumb.label}</span>
                </div>
              {:else}
                <a
                  href={crumb.href}
                  class="flex items-center justify-center px-0.5 whitespace-nowrap text-muted transition-colors hover:text-text {dragOverCrumb ===
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
        <div class="flex shrink-0 items-center gap-1">
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
            {uploadingFiles}
            {movingFiles}
            searchQuery=""
            onSortedChange={(items) => {
              sortedFileItems = items;
            }}
          />
        {/if}
      </div>
    </main>

    {#if rightPanel && rightPanel !== "preview" && rightPanel !== "deploy"}
      <RightPanel
        panel={rightPanel}
        onClose={() => {
          rightPanel = null;
        }}
        width={rightWidth}
        onResize={(w) => {
          rightRatio = w / (windowWidth - treeWidth);
        }}
      />
    {:else if rightPanel === "deploy"}
      <DeployPanel
        onClose={() => {
          rightPanel = null;
        }}
        width={rightWidth}
        onResize={(w) => {
          rightRatio = w / (windowWidth - treeWidth);
        }}
      />
    {:else if rightPanel === "preview"}
      <aside
        class="relative flex shrink-0 flex-col overflow-hidden border-l border-border bg-surface"
        style="width: {rightWidth}px"
      >
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div
          class="absolute top-0 left-0 z-2 h-full w-1 cursor-col-resize hover:bg-accent hover:opacity-50"
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
        <FileViewer
          obj={previewObj}
          onClose={() => {
            rightPanel = null;
            previewObj = null;
          }}
        />
      </aside>
    {/if}
  </div>

  <div class="flex h-6 shrink-0 items-center justify-end border-t border-border bg-surface px-3">
    <div class="text-xs tracking-[0.08em] text-muted">
      <span>{selectedCount} selected</span>
    </div>
  </div>
</div>

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
