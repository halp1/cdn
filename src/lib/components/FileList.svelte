<script lang="ts">
  import {
    Folder,
    Upload,
    Trash2,
    Link2,
    Ellipsis,
    ArrowUpDown,
    Eye,
    Pencil,
    Download
  } from "@lucide/svelte";
  import FileIcon from "./FileIcon.svelte";
  import ContextMenu from "./ContextMenu.svelte";
  import type { MenuEntry } from "./ContextMenu.svelte";
  import type { Component } from "svelte";
  import { untrack } from "svelte";
  import { formatFileSize, collectDroppedFiles, type DroppedFile } from "$lib/utils";
  import type { R2Object } from "$lib/r2-server";
  import { SvelteMap } from "svelte/reactivity";
  import { tooltip } from "$lib/tooltip";

  interface Props {
    objects: R2Object[];
    allObjects?: R2Object[];
    prefix: string;
    selected: Set<string>;
    onSelect: (keys: string[], replace: boolean) => void;
    onNavigate: (prefix: string) => void;
    onDelete: (keys: string[]) => void;
    onRenameCommit: (oldKey: string, newKey: string) => void;
    onPreview: (obj: R2Object) => void;
    onNewFolder: () => void;
    onDropFiles: (files: DroppedFile[]) => void;
    onDropMove: (keys: string[]) => void;
    onDownload: (keys: string[]) => void;
    searchQuery: string;
    onSortedChange?: (items: R2Object[]) => void;
    scrollToKey?: string | null;
    previewKey?: string | null;
    uploadingFiles?: Map<string, number>;
    movingFiles?: Set<string>;
  }

  let {
    objects,
    allObjects = [],
    prefix,
    selected,
    onSelect,
    onNavigate,
    onDelete,
    onRenameCommit,
    onPreview,
    onDropFiles,
    onDropMove,
    onDownload,
    searchQuery,
    onSortedChange,
    scrollToKey = null,
    previewKey = null,
    uploadingFiles = undefined,
    movingFiles = undefined
  }: Props = $props();

  type SortKey = "name" | "size" | "modified";
  type SortDir = "asc" | "desc";
  let sortKey = $state<SortKey>("name");
  let sortDir = $state<SortDir>("asc");

  const folderStats = $derived.by(() => {
    const map = new SvelteMap<string, { size: number; lastModified: Date | undefined }>();
    for (const obj of allObjects) {
      if (obj.isFolder) continue;
      const key = obj.key;
      const parts = key.split("/");
      for (let depth = 1; depth < parts.length; depth++) {
        const folderKey = parts.slice(0, depth).join("/") + "/";
        const existing = map.get(folderKey);
        if (existing) {
          existing.size += obj.size ?? 0;
          if (
            obj.lastModified &&
            (!existing.lastModified || obj.lastModified > existing.lastModified)
          ) {
            existing.lastModified = obj.lastModified;
          }
        } else {
          map.set(folderKey, { size: obj.size ?? 0, lastModified: obj.lastModified });
        }
      }
    }
    return map;
  });

  const getFolderSize = (key: string) => folderStats.get(key)?.size;
  const getFolderModified = (key: string) => folderStats.get(key)?.lastModified;

  let renamingKey = $state<string | null>(null);
  let renameValue = $state("");
  let renameInputEl = $state<HTMLInputElement | null>(null);
  const pendingRenames = new SvelteMap<string, string>();

  $effect(() => {
    const keys = new Set(objects.map((o) => o.key));
    for (const k of pendingRenames.keys()) {
      if (!keys.has(k)) pendingRenames.delete(k);
    }
  });

  $effect(() => {
    if (!renameInputEl) return;
    renameInputEl.focus();
    const value = untrack(() => renameValue);
    const dotIdx = value.lastIndexOf(".");
    const stemEnd = dotIdx > 0 ? dotIdx : value.length;
    renameInputEl.setSelectionRange(0, stemEnd);
  });

  const renameConflict = $derived.by(() => {
    if (renamingKey === null || renameValue.trim() === "") return false;
    const isFolder = renamingKey.endsWith("/");
    const originalName = renamingKey.slice(prefix.length).replace(/\/$/, "");
    if (renameValue.trim() === originalName) return false;
    const newKey = isFolder ? prefix + renameValue.trim() + "/" : prefix + renameValue.trim();
    return objects.some((o) => o.key === newKey);
  });

  const commitRename = (oldKey: string) => {
    if (renamingKey !== oldKey) return;
    if (renameConflict) return;
    const newName = renameValue.trim();
    const isFolder = oldKey.endsWith("/");
    const originalName = oldKey.slice(prefix.length).replace(/\/$/, "");
    renamingKey = null;
    if (!newName || newName === originalName) return;
    pendingRenames.set(oldKey, newName);
    const newKey = isFolder ? prefix + newName + "/" : prefix + newName;
    onRenameCommit(oldKey, newKey);
  };

  const cancelRename = () => {
    renamingKey = null;
    renameValue = "";
  };
  let contextMenu = $state<{ x: number; y: number; key: string } | null>(null);
  let lastAnchorKey = $state<string | null>(null);

  $effect(() => {
    void prefix;
    lastAnchorKey = null;
  });

  const filtered = $derived(() => {
    if (!searchQuery) return objects;
    const q = searchQuery.toLowerCase();
    return objects.filter((o) => o.key.toLowerCase().includes(q));
  });

  const sorted = $derived(() => {
    const items = [...filtered()];
    if (uploadingFiles && uploadingFiles.size > 0) {
      const existingKeys = new Set(items.map((o) => o.key));
      for (const [key] of uploadingFiles) {
        if (!existingKeys.has(key)) {
          const lastSlash = key.lastIndexOf("/");
          const keyPrefix = lastSlash >= 0 ? key.slice(0, lastSlash + 1) : "";
          if (keyPrefix === prefix)
            items.push({ key, isFolder: false, size: 0, lastModified: new Date() });
        }
      }
    }
    items.sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      let cmp = 0;
      if (sortKey === "name") cmp = a.key.localeCompare(b.key);
      else if (sortKey === "size") {
        const sa = a.isFolder ? (getFolderSize(a.key) ?? 0) : (a.size ?? 0);
        const sb = b.isFolder ? (getFolderSize(b.key) ?? 0) : (b.size ?? 0);
        cmp = sa - sb;
      } else if (sortKey === "modified") {
        const ma = a.isFolder ? getFolderModified(a.key) : a.lastModified;
        const mb = b.isFolder ? getFolderModified(b.key) : b.lastModified;
        cmp = (ma?.getTime() ?? 0) - (mb?.getTime() ?? 0);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return items;
  });

  $effect(() => {
    onSortedChange?.(sorted());
  });

  $effect(() => {
    if (scrollToKey) {
      document
        .querySelector(`[data-key=${CSS.escape(scrollToKey)}]`)
        ?.scrollIntoView({ block: "nearest" });
    }
  });

  const getLabel = (obj: R2Object): string => {
    const rel = obj.key.slice(prefix.length);
    return obj.isFolder ? rel.replace(/\/$/, "") : rel;
  };

  const handleRowClick = (e: MouseEvent, key: string) => {
    if (e.shiftKey) {
      if (lastAnchorKey !== null) {
        const items = sorted();
        const anchorIdx = items.findIndex((o) => o.key === lastAnchorKey);
        const clickIdx = items.findIndex((o) => o.key === key);
        if (anchorIdx !== -1 && clickIdx !== -1) {
          const lo = Math.min(anchorIdx, clickIdx);
          const hi = Math.max(anchorIdx, clickIdx);
          const rangeKeys = items.slice(lo, hi + 1).map((o) => o.key);
          onSelect([...selected, ...rangeKeys], true);
          lastAnchorKey = key;
          return;
        }
      }
      lastAnchorKey = key;
      onSelect([key], true);
    } else if (e.ctrlKey || e.metaKey) {
      onSelect([key], false);
    } else {
      lastAnchorKey = key;
      onSelect([key], true);
    }
  };

  const handleRowDblClick = (obj: R2Object) => {
    if (obj.isFolder) onNavigate(obj.key);
    else {
      const pendingName = pendingRenames.get(obj.key);
      onPreview(pendingName ? { ...obj, key: prefix + pendingName } : obj);
    }
  };

  const handleContextMenu = (e: MouseEvent, key: string) => {
    e.preventDefault();
    if (!selected.has(key)) onSelect([key], true);
    contextMenu = { x: e.clientX, y: e.clientY, key };
  };

  const closeContext = () => {
    contextMenu = null;
  };

  const cycleSort = (key: SortKey) => {
    if (sortKey === key) sortDir = sortDir === "asc" ? "desc" : "asc";
    else {
      sortKey = key;
      sortDir = key === "size" || key === "modified" ? "desc" : "asc";
    }
  };

  let dragOver = $state(false);
  const dragOverClasses =
    "after:pointer-events-none after:absolute after:inset-0 after:z-[5] after:flex after:items-center after:justify-center after:border-2 after:border-dashed after:border-accent after:bg-accent/[0.06] after:text-base after:text-accent after:tracking-[0.1em] after:uppercase after:content-['Drop_to_upload']";

  const folderIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e8c87a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
  const fileIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#999999" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`;

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const buildDragGhost = (keys: string[]): HTMLDivElement => {
    const ghost = document.createElement("div");
    ghost.style.cssText =
      "position:fixed;top:-1000px;left:-1000px;pointer-events:none;background:#161616;border:1px solid #2a2a2a;color:#f0ede6;font-family:'DM Mono',monospace;font-size:12px;padding:5px 10px;display:flex;align-items:center;gap:6px;white-space:nowrap;z-index:9999";
    if (keys.length === 1) {
      const key = keys[0];
      const isFolder = key.endsWith("/");
      const name = isFolder
        ? (key.replace(/\/$/, "").split("/").pop() ?? key)
        : (key.split("/").pop() ?? key);
      ghost.innerHTML = `${isFolder ? folderIconSvg : fileIconSvg}<span>${esc(name)}</span>`;
    } else {
      ghost.innerHTML = `<span style="color:#c8f56a">${keys.length}</span><span style="margin-left:4px">items</span>`;
    }
    document.body.appendChild(ghost);
    return ghost;
  };

  const formatDate = (d: Date | undefined): string => {
    if (!d) return "—";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };
</script>

<svelte:window
  ondragend={() => {
    dragOver = false;
  }}
/>
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="file-list relative flex h-full flex-col {dragOver ? dragOverClasses : ''}"
  ondragover={(e) => {
    e.preventDefault();
    dragOver = true;
    e.dataTransfer!.dropEffect = e.dataTransfer!.types.includes("application/x-cdn-move")
      ? "move"
      : "copy";
  }}
  ondragleave={(e) => {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      dragOver = false;
    }
  }}
  ondrop={(e) => {
    e.preventDefault();
    dragOver = false;
    if (e.dataTransfer!.types.includes("application/x-cdn-move")) {
      const keys: string[] = JSON.parse(e.dataTransfer!.getData("application/x-cdn-move"));
      onDropMove(keys);
    } else {
      collectDroppedFiles(e.dataTransfer!).then((files) => {
        if (files.length > 0) onDropFiles(files);
      });
    }
  }}
>
  <div
    class="list-header grid h-7 shrink-0 border-b border-border bg-surface"
    style="grid-template-columns: 28px 1fr 80px 110px 32px"
  >
    <div class="flex items-center px-1.5"></div>
    <button
      class="flex cursor-pointer items-center justify-start border-0 bg-transparent px-1.5 text-left font-mono text-xs tracking-[0.14em] text-muted uppercase transition-colors hover:text-text"
      onclick={() => cycleSort("name")}
    >
      Name
      {#if sortKey === "name"}<ArrowUpDown size={10} class="ml-1 opacity-60" />{/if}
    </button>
    <button
      class="flex cursor-pointer items-center justify-end border-0 bg-transparent px-1.5 font-mono text-xs tracking-[0.14em] text-muted uppercase transition-colors hover:text-text"
      onclick={() => cycleSort("size")}
    >
      Size
      {#if sortKey === "size"}<ArrowUpDown size={10} class="ml-1 opacity-60" />{/if}
    </button>
    <button
      class="flex cursor-pointer items-center justify-end border-0 bg-transparent px-1.5 font-mono text-xs tracking-[0.14em] text-muted uppercase transition-colors hover:text-text"
      onclick={() => cycleSort("modified")}
    >
      Modified
      {#if sortKey === "modified"}<ArrowUpDown size={10} class="ml-1 opacity-60" />{/if}
    </button>
    <div class="flex items-center px-1.5"></div>
  </div>

  <div
    class="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent"
  >
    {#if sorted().length === 0}
      <div
        class="flex h-50 flex-col items-center justify-center gap-3 text-sm tracking-widest text-border uppercase"
      >
        <Upload size={24} />
        <span>Drop files here or click Upload</span>
      </div>
    {:else}
      {#each sorted() as obj, i (obj.key)}
        {@const isSelected = selected.has(obj.key)}
        {@const isOpen = obj.key === previewKey}
        {@const uploadProgress = uploadingFiles?.get(obj.key) ?? null}
        {@const isUploading = uploadProgress !== null}
        {@const isMoving = movingFiles?.has(obj.key) ?? false}
        <div
          data-key={obj.key}
          class="group list-row relative grid h-7.5 cursor-pointer border-b border-border/50 ring-0 outline-0 transition-colors select-none {isUploading ||
          isMoving
            ? ''
            : 'animate-[fadeUp_0.25s_ease_both]'} {isSelected
            ? 'bg-accent/[0.07]'
            : isOpen
              ? 'bg-[#6ab4f5]/6'
              : 'hover:bg-white/3'}"
          style="grid-template-columns: 28px 1fr 80px 110px 32px; {!isUploading && !isMoving
            ? `animation-delay: ${Math.min(i, 30) * 15}ms`
            : ''}"
          onclick={(e) => (renamingKey === obj.key ? null : handleRowClick(e, obj.key))}
          ondblclick={() => (renamingKey === obj.key ? null : handleRowDblClick(obj))}
          oncontextmenu={(e) => handleContextMenu(e, obj.key)}
          draggable={renamingKey !== obj.key && !isUploading && !isMoving}
          ondragstart={(e) => {
            if (renamingKey === obj.key) {
              e.preventDefault();
              return;
            }
            const dragKeys = selected.has(obj.key) ? [...selected] : [obj.key];
            if (!selected.has(obj.key)) onSelect([obj.key], true);
            e.dataTransfer!.effectAllowed = "move";
            e.dataTransfer!.setData("application/x-cdn-move", JSON.stringify(dragKeys));
            const ghost = buildDragGhost(dragKeys);
            e.dataTransfer!.setDragImage(ghost, Math.min(16, ghost.offsetWidth / 2), 12);
            requestAnimationFrame(() => {
              if (document.body.contains(ghost)) document.body.removeChild(ghost);
            });
          }}
          role="row"
          tabindex="0"
          onkeydown={(e) => renamingKey !== obj.key && e.key === "Enter" && handleRowDblClick(obj)}
        >
          <div class="relative flex items-center pl-2">
            {#if isOpen}
              <span class="absolute inset-y-0 -left-2 w-0.5 bg-[#6ab4f5]"></span>
            {/if}
            {#if obj.isFolder}
              <Folder size={13} class="text-[#e8c87a]" />
            {:else}
              <FileIcon
                filename={renamingKey === obj.key
                  ? renameValue
                  : (pendingRenames.get(obj.key) ?? obj.key.split("/").pop() ?? obj.key)}
                size={13}
              />
            {/if}
          </div>
          <div class="flex min-w-0 items-center px-1.5">
            {#if renamingKey === obj.key}
              <input
                bind:this={renameInputEl}
                bind:value={renameValue}
                class="w-full border-0 border-b bg-transparent p-0 font-mono text-sm text-(--text) ring-0 outline-none {renameConflict
                  ? 'border-[#ff6b6b]'
                  : 'border-(--accent)'}"
                onclick={(e) => e.stopPropagation()}
                onkeydown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") commitRename(obj.key);
                  else if (e.key === "Escape") cancelRename();
                }}
                onblur={() => commitRename(obj.key)}
              />
            {:else}
              <span
                class="overflow-hidden text-sm text-ellipsis whitespace-nowrap {isSelected
                  ? 'text-accent'
                  : isOpen
                    ? 'text-[#6ab4f5]'
                    : 'text-text'}">{pendingRenames.get(obj.key) ?? getLabel(obj)}</span
              >
            {/if}
          </div>
          <div
            class="flex items-center justify-end px-1.5 font-mono text-sm whitespace-nowrap text-muted"
          >
            {obj.isFolder
              ? getFolderSize(obj.key) !== undefined
                ? formatFileSize(getFolderSize(obj.key)!)
                : "—"
              : formatFileSize(obj.size ?? 0)}
          </div>
          <div class="flex items-center justify-end px-1.5 font-mono text-sm text-muted">
            {obj.isFolder ? formatDate(getFolderModified(obj.key)) : formatDate(obj.lastModified)}
          </div>
          <div class="flex items-center justify-center">
            <button
              class="row-action flex items-center border-none bg-none p-1 text-transparent transition-colors group-hover:text-muted hover:text-text!"
              onclick={(e) => {
                e.stopPropagation();
                handleContextMenu(e, obj.key);
              }}
              use:tooltip={"More actions"}
            >
              <Ellipsis size={12} />
            </button>
          </div>
          {#if isUploading}
            <div
              class="pointer-events-none absolute bottom-0 left-0 h-px bg-accent transition-[width_0.15s_ease]"
              style="width: {(uploadProgress ?? 0) * 100}%"
            ></div>
          {:else if isMoving}
            <div
              class="pointer-events-none absolute bottom-0 left-0 h-px w-full animate-pulse bg-accent/60"
            ></div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
</div>

{#if contextMenu}
  {@const obj = objects.find((o) => o.key === contextMenu!.key)}
  {#if obj}
    {@const fileItems: MenuEntry[] = [
			...(!obj.isFolder
				? [
						{
							icon: Eye as Component,
							label: 'Preview',
							action: () => onPreview(obj)
						},
						{
							icon: Link2 as Component,
							label: 'Copy link',
							action: () =>
								navigator.clipboard.writeText(window.location.origin + '/obj/' + obj.key)
						},
					]
				: []),
			...(selected.size <= 1
				? [
						{
							icon: Pencil as Component,
							label: 'Rename',
							action: () => {
								renamingKey = obj.key;
								renameValue = obj.key.slice(prefix.length).replace(/\/$/, '');
							}
						}
					]
				: []),
			{
				icon: Download as Component,
				label: 'Download',
				action: () => onDownload([...selected])
			},
			{ separator: true as const },
			{
				icon: Trash2 as Component,
				label: 'Delete',
				color: '#ff6b6b',
				action: () => onDelete([...selected])
			}
		]}
    <ContextMenu x={contextMenu.x} y={contextMenu.y} items={fileItems} onClose={closeContext} />
  {/if}
{/if}
