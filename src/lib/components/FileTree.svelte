<script lang="ts">
  import {
    ChevronRight,
    ChevronDown,
    Folder,
    FolderOpen,
    Pencil,
    Trash2,
    Link2,
    Eye,
    X
  } from "@lucide/svelte";
  import FileIcon from "./FileIcon.svelte";
  import ContextMenu from "./ContextMenu.svelte";
  import type { MenuEntry } from "./ContextMenu.svelte";
  import type { Component } from "svelte";
  import { SvelteSet } from "svelte/reactivity";
  import { untrack } from "svelte";
  import { collectDroppedFiles, type DroppedFile } from "$lib/utils";
  import { coarse } from "$lib/viewport.svelte";

  interface TreeNode {
    name: string;
    path: string;
    children: TreeNode[];
    isFolder: boolean;
  }

  interface Props {
    objects: { key: string; isFolder: boolean }[];
    currentPath: string;
    onNavigate: (path: string) => void;
    onPreview: (obj: { key: string; isFolder: boolean }) => void;
    onDropFiles: (folder: string, files: DroppedFile[]) => void;
    onDropMove: (folder: string, keys: string[]) => void;
    onDelete: (keys: string[]) => void;
    onRenameCommit: (oldKey: string, newKey: string) => void;
    width: number;
    onResize: (w: number) => void;
    uploadingFiles?: Map<string, number>;
    scrollToKey?: string | null;
    movingFiles?: Set<string>;
    movingTarget?: string | null;
    /** Drawer visibility. Ignored at `md` and up, where the tree is docked. */
    open?: boolean;
    onClose?: () => void;
  }

  let {
    objects,
    currentPath,
    onNavigate,
    onPreview,
    onDelete,
    onRenameCommit,
    onDropFiles,
    onDropMove,
    width,
    onResize,
    uploadingFiles = undefined,
    scrollToKey = null,
    movingFiles = undefined,
    movingTarget = null,
    open = false,
    onClose = undefined
  }: Props = $props();

  let expanded = $state<SvelteSet<string>>(new SvelteSet());

  const expandAncestors = (path: string) => {
    const parts = path.replace(/\/$/, "").split("/").filter(Boolean);
    let acc = "";
    for (const part of parts) {
      acc = acc ? acc + "/" + part : part;
      expanded.add(acc + "/");
    }
  };

  $effect(() => {
    expandAncestors(currentPath);
  });

  $effect(() => {
    if (!uploadingFiles) return;
    for (const [key] of uploadingFiles) {
      expandAncestors(key);
    }
  });

  $effect(() => {
    if (scrollToKey && scrollContainer) {
      scrollContainer
        .querySelector(`[data-key="${CSS.escape(scrollToKey)}"]`)
        ?.scrollIntoView({ block: "nearest" });
    }
  });

  const allPaths = $derived.by(() => {
    const set = new SvelteSet<string>();
    for (const obj of objects) {
      set.add(obj.key);
      if (!obj.isFolder) {
        const segments = obj.key.split("/");
        let acc = "";
        for (let i = 0; i < segments.length - 1; i++) {
          acc = acc ? acc + "/" + segments[i] : segments[i];
          set.add(acc + "/");
        }
      }
    }
    return Array.from(set).sort();
  });

  const buildTree = (paths: string[]): TreeNode[] => {
    const root: TreeNode[] = [];

    const getOrCreate = (
      nodes: TreeNode[],
      name: string,
      isFolder: boolean,
      path: string
    ): TreeNode => {
      const existing = nodes.find((n) => n.name === name);
      if (existing) {
        if (isFolder) existing.isFolder = true;
        return existing;
      }
      const node: TreeNode = { name, path, children: [], isFolder };
      nodes.push(node);
      return node;
    };

    for (const path of paths) {
      const isFolder = path.endsWith("/");
      const segments = path.replace(/\/$/, "").split("/").filter(Boolean);
      let nodes = root;
      let accumulated = "";
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        accumulated = accumulated ? accumulated + "/" + seg : seg;
        const isLast = i === segments.length - 1;
        const isThisFolder = isLast ? isFolder : true;
        const fullPath = isThisFolder ? accumulated + "/" : accumulated;
        const node = getOrCreate(nodes, seg, isThisFolder, fullPath);
        if (!isLast) nodes = node.children;
      }
    }

    const sort = (nodes: TreeNode[]): TreeNode[] => {
      nodes.sort((a, b) => {
        if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      for (const node of nodes) sort(node.children);
      return nodes;
    };

    return sort(root);
  };

  const tree = $derived(buildTree(allPaths));

  const toggle = (path: string) => {
    if (expanded.has(path)) expanded.delete(path);
    else expanded.add(path);
  };

  let contextMenu = $state<{ x: number; y: number; node: TreeNode } | null>(null);
  let renamingKey = $state<string | null>(null);
  let renameValue = $state("");
  let renameInputEl = $state<HTMLInputElement | null>(null);

  const renameConflict = $derived.by(() => {
    if (renamingKey === null || renameValue.trim() === "") return false;
    const isFolder = renamingKey.endsWith("/");
    const parentPrefix = isFolder
      ? renamingKey.slice(0, renamingKey.lastIndexOf("/", renamingKey.length - 2) + 1)
      : renamingKey.slice(0, renamingKey.lastIndexOf("/") + 1);
    const originalName = isFolder
      ? renamingKey.slice(parentPrefix.length, -1)
      : renamingKey.slice(parentPrefix.length);
    if (renameValue.trim() === originalName) return false;
    const newKey = isFolder
      ? parentPrefix + renameValue.trim() + "/"
      : parentPrefix + renameValue.trim();
    return objects.some((o) => o.key === newKey);
  });

  $effect(() => {
    if (!renameInputEl) return;
    renameInputEl.focus();
    const value = untrack(() => renameValue);
    const dotIdx = value.lastIndexOf(".");
    const stemEnd = dotIdx > 0 ? dotIdx : value.length;
    renameInputEl.setSelectionRange(0, stemEnd);
  });

  const commitRenameNode = (oldKey: string) => {
    if (renamingKey !== oldKey) return;
    if (renameConflict) return;
    const newName = renameValue.trim();
    const isFolder = oldKey.endsWith("/");
    const parentPrefix = isFolder
      ? oldKey.slice(0, oldKey.lastIndexOf("/", oldKey.length - 2) + 1)
      : oldKey.slice(0, oldKey.lastIndexOf("/") + 1);
    const originalName = isFolder
      ? oldKey.slice(parentPrefix.length, -1)
      : oldKey.slice(parentPrefix.length);
    renamingKey = null;
    if (!newName || newName === originalName) return;
    const newKey = isFolder ? parentPrefix + newName + "/" : parentPrefix + newName;
    onRenameCommit(oldKey, newKey);
  };

  const cancelRenameNode = () => {
    renamingKey = null;
    renameValue = "";
  };

  const handleContextMenuNode = (e: MouseEvent, node: TreeNode) => {
    e.preventDefault();
    e.stopPropagation();
    contextMenu = { x: e.clientX, y: e.clientY, node };
  };

  let dragOverPath = $state<string | null>(null);
  let hoverTimer: ReturnType<typeof setTimeout> | null = null;
  let scrollDir = 0;
  let scrollSpeed = 0;
  let edgeScrollRaf: number | null = null;
  let scrollContainer: HTMLDivElement | null = null;

  const resolveDropFolder = (node: TreeNode): string => {
    if (node.isFolder) return node.path;
    const lastSlash = node.path.lastIndexOf("/");
    return lastSlash > 0 ? node.path.slice(0, lastSlash + 1) : "";
  };

  const clearHoverTimer = () => {
    if (hoverTimer !== null) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
  };

  const startHoverTimer = (folderPath: string) => {
    clearHoverTimer();
    hoverTimer = setTimeout(() => {
      expanded.add(folderPath);
    }, 1000);
  };

  const stopEdgeScroll = () => {
    if (edgeScrollRaf !== null) {
      cancelAnimationFrame(edgeScrollRaf);
      edgeScrollRaf = null;
    }
    scrollDir = 0;
  };

  const updateEdgeScroll = (clientY: number) => {
    if (!scrollContainer) return;
    const rect = scrollContainer.getBoundingClientRect();
    const threshold = 60;
    const topDist = clientY - rect.top;
    const botDist = rect.bottom - clientY;
    if (topDist < threshold) {
      scrollDir = -1;
      scrollSpeed = (1 - topDist / threshold) * 8;
    } else if (botDist < threshold) {
      scrollDir = 1;
      scrollSpeed = (1 - botDist / threshold) * 8;
    } else {
      scrollDir = 0;
    }
    if (scrollDir !== 0 && edgeScrollRaf === null) {
      const doScroll = () => {
        if (scrollContainer && scrollDir !== 0) {
          scrollContainer.scrollTop += scrollDir * scrollSpeed;
          edgeScrollRaf = requestAnimationFrame(doScroll);
        } else {
          edgeScrollRaf = null;
        }
      };
      edgeScrollRaf = requestAnimationFrame(doScroll);
    } else if (scrollDir === 0 && edgeScrollRaf !== null) {
      stopEdgeScroll();
    }
  };

  const clearDragState = () => {
    dragOverPath = null;
    clearHoverTimer();
    stopEdgeScroll();
  };

  const folderIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e8c87a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
  const fileIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#999999" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const buildDragGhost = (name: string, isFolder: boolean): HTMLDivElement => {
    const ghost = document.createElement("div");
    ghost.style.cssText =
      "position:fixed;top:-1000px;left:-1000px;pointer-events:none;background:#161616;border:1px solid #2a2a2a;color:#f0ede6;font-family:'DM Mono',monospace;font-size:12px;padding:5px 10px;display:flex;align-items:center;gap:6px;white-space:nowrap;z-index:9999";
    ghost.innerHTML = `${isFolder ? folderIconSvg : fileIconSvg}<span>${esc(name)}</span>`;
    document.body.appendChild(ghost);
    return ghost;
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
</script>

<svelte:window
  onmousemove={(e) => {
    if (resizing) onResize(Math.max(140, Math.min(480, startW + e.clientX - startX)));
  }}
  onmouseup={() => {
    resizing = false;
  }}
  ondragend={() => {
    clearDragState();
  }}
/>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-40 animate-[backdropIn_0.2s_ease] bg-black/60 md:hidden"
    onclick={onClose}
  ></div>
{/if}

<aside
  class="app-chrome fixed inset-y-0 left-0 z-50 flex w-[82vw] max-w-80 shrink-0 flex-col overflow-hidden border-r border-border bg-surface pt-(--safe-top) pb-(--safe-bottom) transition-transform duration-200 ease-out [--row-h:40px] md:relative md:inset-auto md:z-auto md:w-(--tree-w) md:max-w-none md:translate-x-0 md:pt-0 md:pb-0 md:transition-none md:[--row-h:28px] {open
    ? 'translate-x-0'
    : '-translate-x-full'}"
  style="--tree-w: {width}px"
>
  <div class="flex h-11 shrink-0 items-center border-b border-border px-3 md:h-9">
    <span class="flex-1 text-xs tracking-[0.16em] text-muted uppercase">Files</span>
    <button
      class="-mr-2 flex h-9 w-9 cursor-pointer items-center justify-center border-0 bg-transparent text-muted md:hidden"
      onclick={onClose}
      aria-label="Close folder tree"
    >
      <X size={18} />
    </button>
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={scrollContainer}
    class="scroll-touch flex-1 overflow-x-hidden overflow-y-auto pb-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent"
    ondragover={(e) => {
      e.preventDefault();
      updateEdgeScroll(e.clientY);
      e.dataTransfer!.dropEffect = e.dataTransfer!.types.includes("application/x-cdn-move")
        ? "move"
        : "copy";
    }}
    ondragleave={(e) => {
      if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
        clearDragState();
      }
    }}
    ondrop={(e) => {
      e.preventDefault();
      const target = dragOverPath;
      clearDragState();
      if (target === null) return;
      if (e.dataTransfer!.types.includes("application/x-cdn-move")) {
        const keys: string[] = JSON.parse(e.dataTransfer!.getData("application/x-cdn-move"));
        onDropMove(target, keys);
      } else {
        collectDroppedFiles(e.dataTransfer!).then((files) => {
          if (files.length > 0) onDropFiles(target, files);
        });
      }
    }}
  >
    <button
      class="sticky top-0 z-20 flex w-full cursor-pointer items-center gap-1.5 overflow-hidden border-none py-2.5 pr-2 pl-3 text-left font-mono text-sm text-ellipsis whitespace-nowrap transition-colors md:py-1 {dragOverPath ===
      ''
        ? 'bg-accent text-accent ring-1 ring-accent'
        : currentPath === ''
          ? 'bg-surface text-accent'
          : 'bg-surface text-muted hover:bg-white/3 hover:text-text'}"
      data-key=""
      onclick={() => onNavigate("")}
      ondragenter={(e) => {
        e.stopPropagation();
        dragOverPath = "";
        clearHoverTimer();
      }}
    >
      <FolderOpen size={12} />
      <span>root</span>
    </button>
    {#if movingTarget === ""}
      <div class="h-px w-full animate-pulse bg-accent/60"></div>
    {/if}

    {#snippet renderNodes(nodes: TreeNode[], depth: number)}
      {#each nodes as node (node.path)}
        {@const isOpen = expanded.has(node.path)}
        {@const isActive = node.isFolder && currentPath === node.path}
        {@const isDragTarget = node.isFolder && dragOverPath === node.path}
        <div
          class="relative flex flex-col {isDragTarget
            ? 'after:absolute after:z-9999 after:h-full after:w-full after:border after:border-accent after:content-[""]'
            : ''}"
        >
          {#if node.isFolder}
            <button
              class="sticky flex w-full cursor-pointer items-center gap-1.5 overflow-hidden border-none py-2.5 pr-2 text-left font-mono text-sm text-ellipsis whitespace-nowrap transition-colors md:py-1 {isDragTarget
                ? 'bg-accent/8 text-accent'
                : isActive
                  ? 'bg-surface text-accent'
                  : 'bg-surface text-muted hover:bg-white/3 hover:text-text'}"
              style="padding-left: {depth * 12 + 8}px; z-index: {19 - depth}; top: calc({depth +
                1} * var(--row-h))"
              data-key={node.path}
              draggable={renamingKey !== node.path && !coarse.current}
              ondragstart={(e) => {
                e.stopPropagation();
                e.dataTransfer!.effectAllowed = "move";
                e.dataTransfer!.setData("application/x-cdn-move", JSON.stringify([node.path]));
                const ghost = buildDragGhost(node.name, true);
                e.dataTransfer!.setDragImage(ghost, Math.min(16, ghost.offsetWidth / 2), 12);
                requestAnimationFrame(() => {
                  if (document.body.contains(ghost)) document.body.removeChild(ghost);
                });
              }}
              ondragenter={(e) => {
                e.stopPropagation();
                dragOverPath = node.path;
                startHoverTimer(node.path);
              }}
              onclick={() => {
                if (renamingKey === node.path) return;
                expanded.add(node.path);
                onNavigate(node.path);
              }}
              oncontextmenu={(e) => handleContextMenuNode(e, node)}
            >
              <span
                class="flex w-2.5 shrink-0 items-center {node.children.length === 0
                  ? 'invisible'
                  : isOpen
                    ? 'text-muted'
                    : 'text-border'}"
                role="button"
                tabindex="-1"
                onclick={(e) => {
                  e.stopPropagation();
                  toggle(node.path);
                }}
                onkeydown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    toggle(node.path);
                  }
                }}
              >
                {#if isOpen}<ChevronDown size={10} />{:else}<ChevronRight
                    class="text-muted"
                    size={10}
                  />{/if}
              </span>
              {#if isOpen}<FolderOpen size={12} />{:else}<Folder size={12} />{/if}
              {#if renamingKey === node.path}
                <input
                  bind:this={renameInputEl}
                  bind:value={renameValue}
                  class="min-w-0 flex-1 border-0 border-b bg-transparent p-0 font-mono text-sm text-(--text) ring-0 outline-none {renameConflict
                    ? 'border-[#ff6b6b]'
                    : 'border-(--accent)'}"
                  onclick={(e) => e.stopPropagation()}
                  onkeydown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") commitRenameNode(node.path);
                    else if (e.key === "Escape") cancelRenameNode();
                  }}
                  onblur={() => commitRenameNode(node.path)}
                />
              {:else}
                <span class="min-w-0 overflow-hidden text-ellipsis">{node.name}</span>
              {/if}
            </button>
            {#if movingFiles?.has(node.path) || movingTarget === node.path}
              <div
                style="height:2px;margin-left:{depth * 12 + 8}px"
                class="w-full animate-pulse bg-accent/60"
              ></div>
            {/if}
          {:else}
            {@const fileDropTarget = resolveDropFolder(node)}
            <button
              class="flex w-full cursor-pointer items-center gap-1.5 overflow-hidden border-none bg-none py-2.5 pr-2 text-left font-mono text-sm text-ellipsis whitespace-nowrap text-muted/70 transition-colors hover:bg-white/3 hover:text-text md:py-1"
              style="padding-left: {depth * 12 + 8}px"
              data-key={node.path}
              draggable={renamingKey !== node.path && !coarse.current}
              ondragstart={(e) => {
                e.stopPropagation();
                e.dataTransfer!.effectAllowed = "move";
                e.dataTransfer!.setData("application/x-cdn-move", JSON.stringify([node.path]));
                const ghost = buildDragGhost(node.name, false);
                e.dataTransfer!.setDragImage(ghost, Math.min(16, ghost.offsetWidth / 2), 12);
                requestAnimationFrame(() => {
                  if (document.body.contains(ghost)) document.body.removeChild(ghost);
                });
              }}
              ondragenter={(e) => {
                e.stopPropagation();
                dragOverPath = fileDropTarget;
                clearHoverTimer();
              }}
              onclick={() => {
                if (renamingKey === node.path) return;
                const parentPath = node.path.includes("/")
                  ? node.path.slice(0, node.path.lastIndexOf("/") + 1)
                  : "";
                onNavigate(parentPath);
                onPreview(
                  objects.find((o) => o.key === node.path) ?? { key: node.path, isFolder: false }
                );
              }}
              oncontextmenu={(e) => handleContextMenuNode(e, node)}
            >
              <span class="w-2.5 shrink-0"></span>
              <FileIcon filename={node.name} size={12} />
              {#if renamingKey === node.path}
                <input
                  bind:this={renameInputEl}
                  bind:value={renameValue}
                  class="min-w-0 flex-1 border-0 border-b bg-transparent p-0 font-mono text-sm text-(--text) ring-0 outline-none {renameConflict
                    ? 'border-[#ff6b6b]'
                    : 'border-(--accent)'}"
                  onclick={(e) => e.stopPropagation()}
                  onkeydown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") commitRenameNode(node.path);
                    else if (e.key === "Escape") cancelRenameNode();
                  }}
                  onblur={() => commitRenameNode(node.path)}
                />
              {:else}
                <span class="min-w-0 overflow-hidden text-ellipsis">{node.name}</span>
              {/if}
            </button>
            {#if uploadingFiles?.has(node.path)}
              {@const progress = uploadingFiles.get(node.path) ?? 0}
              <div
                style="height:2px;background:var(--accent);width:{progress *
                  100}%;transition:width 0.15s ease;margin-left:{depth * 12 + 8}px"
              ></div>
            {:else if movingFiles?.has(node.path)}
              <div
                style="height:2px;margin-left:{depth * 12 + 8}px"
                class="w-full animate-pulse bg-accent/60"
              ></div>
            {/if}
          {/if}
          {#if isOpen && node.children.length > 0}
            {@render renderNodes(node.children, depth + 1)}
          {/if}
        </div>
      {/each}
    {/snippet}

    {@render renderNodes(tree, 0)}
  </div>

  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <!-- svelte-ignore a11y_no_redundant_roles -->
  <hr
    class="absolute top-0 right-0 hidden h-full w-1 cursor-col-resize border-none bg-transparent transition-colors hover:bg-accent/50 md:block"
    onmousedown={onMouseDown}
    role="separator"
    aria-orientation="vertical"
    aria-label="Resize file tree"
    tabindex="-1"
  />
</aside>

{#if contextMenu}
  {@const node = contextMenu.node}
  {@const treeItems: MenuEntry[] = [
		...(!node.isFolder
			? [
					{
						icon: Eye as Component,
						label: 'Preview',
						action: () => {
							const parentPath = node.path.includes('/')
								? node.path.slice(0, node.path.lastIndexOf('/') + 1)
								: '';
							onNavigate(parentPath);
							onPreview(
								objects.find((o) => o.key === node.path) ?? { key: node.path, isFolder: false }
							);
						}
					},
					{
						icon: Link2 as Component,
						label: 'Copy link',
						action: () =>
							navigator.clipboard.writeText(window.location.origin + '/obj/' + encodeURIComponent(node.path))
					},
				]
			: []),
		{
			icon: Pencil as Component,
			label: 'Rename',
			action: () => {
				renamingKey = node.path;
				renameValue = node.name;
			}
		},
		{ separator: true as const },
		{
			icon: Trash2 as Component,
			label: 'Delete',
			color: '#ff6b6b',
			action: () => onDelete([node.path])
		}
	]}
  <ContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    title={node.name}
    items={treeItems}
    onClose={() => (contextMenu = null)}
  />
{/if}

<style>
  @reference "../../routes/layout.css";

  aside * {
    @apply bg-surface;
  }
</style>
