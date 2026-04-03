<script lang="ts">
	import {
		Folder,
		Upload,
		Trash2,
		MoveRight,
		Link2,
		Ellipsis,
		ArrowUpDown,
		Eye
	} from 'lucide-svelte';
	import FileIcon from './FileIcon.svelte';
	import { formatFileSize } from '$lib/utils';
	import type { R2Object } from '$lib/r2-server';

	interface Props {
		objects: R2Object[];
		prefix: string;
		selected: Set<string>;
		onSelect: (keys: string[], replace: boolean) => void;
		onNavigate: (prefix: string) => void;
		onDelete: (keys: string[]) => void;
		onMove: (key: string) => void;
		onPreview: (obj: R2Object) => void;
		onNewFolder: () => void;
		onUpload: () => void;
		searchQuery: string;
	}

	let {
		objects,
		prefix,
		selected,
		onSelect,
		onNavigate,
		onDelete,
		onMove,
		onPreview,
		onUpload,
		searchQuery
	}: Props = $props();

	type SortKey = 'name' | 'size' | 'modified';
	type SortDir = 'asc' | 'desc';
	let sortKey = $state<SortKey>('name');
	let sortDir = $state<SortDir>('asc');

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
		items.sort((a, b) => {
			if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
			let cmp = 0;
			if (sortKey === 'name') cmp = a.key.localeCompare(b.key);
			else if (sortKey === 'size') cmp = (a.size ?? 0) - (b.size ?? 0);
			else if (sortKey === 'modified')
				cmp = (a.lastModified?.getTime() ?? 0) - (b.lastModified?.getTime() ?? 0);
			return sortDir === 'asc' ? cmp : -cmp;
		});
		return items;
	});

	const getLabel = (obj: R2Object): string => {
		const rel = obj.key.slice(prefix.length);
		return obj.isFolder ? rel.replace(/\/$/, '') : rel;
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
		else onPreview(obj);
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
		if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		else {
			sortKey = key;
			sortDir = 'asc';
		}
	};

	let dragOver = $state(false);
	const dragOverClasses =
		"after:pointer-events-none after:absolute after:inset-0 after:z-[5] after:flex after:items-center after:justify-center after:border-2 after:border-dashed after:border-accent after:bg-accent/[0.06] after:text-base after:text-accent after:tracking-[0.1em] after:uppercase after:content-['Drop_to_upload']";

	const formatDate = (d: Date | undefined): string => {
		if (!d) return '—';
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	};
</script>

<svelte:window onclick={() => closeContext()} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="file-list relative flex h-full flex-col {dragOver ? dragOverClasses : ''}"
	ondragover={(e) => {
		e.preventDefault();
		dragOver = true;
	}}
	ondragleave={() => {
		dragOver = false;
	}}
	ondrop={(e) => {
		e.preventDefault();
		dragOver = false;
		onUpload();
	}}
>
	<div
		class="list-header grid h-7 shrink-0 border-b border-border bg-surface"
		style="grid-template-columns: 28px 1fr 80px 110px 32px"
	>
		<div class="flex items-center px-1.5"></div>
		<button
			class="flex cursor-pointer items-center justify-start border-0 bg-transparent px-1.5 text-left font-mono text-xs tracking-[0.14em] text-muted uppercase transition-colors hover:text-text"
			onclick={() => cycleSort('name')}
		>
			Name
			{#if sortKey === 'name'}<ArrowUpDown size={10} class="ml-1 opacity-60" />{/if}
		</button>
		<button
			class="flex cursor-pointer items-center justify-end border-0 bg-transparent px-1.5 font-mono text-xs tracking-[0.14em] text-muted uppercase transition-colors hover:text-text"
			onclick={() => cycleSort('size')}
		>
			Size
			{#if sortKey === 'size'}<ArrowUpDown size={10} class="ml-1 opacity-60" />{/if}
		</button>
		<button
			class="flex cursor-pointer items-center justify-end border-0 bg-transparent px-1.5 font-mono text-xs tracking-[0.14em] text-muted uppercase transition-colors hover:text-text"
			onclick={() => cycleSort('modified')}
		>
			Modified
			{#if sortKey === 'modified'}<ArrowUpDown size={10} class="ml-1 opacity-60" />{/if}
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
				<div
					class="group list-row grid h-7.5 animate-[fadeUp_0.25s_ease_both] cursor-pointer border-b border-border/50 ring-0 outline-0 transition-colors select-none {isSelected
						? 'bg-accent/[0.07]'
						: 'hover:bg-white/3'}"
					style="grid-template-columns: 28px 1fr 80px 110px 32px; animation-delay: {Math.min(
						i,
						30
					) * 15}ms"
					onclick={(e) => handleRowClick(e, obj.key)}
					ondblclick={() => handleRowDblClick(obj)}
					oncontextmenu={(e) => handleContextMenu(e, obj.key)}
					draggable={true}
					role="row"
					tabindex="0"
					onkeydown={(e) => e.key === 'Enter' && handleRowDblClick(obj)}
				>
					<div class="flex items-center pl-2">
						{#if obj.isFolder}
							<Folder size={13} class="text-[#e8c87a]" />
						{:else}
							<FileIcon filename={obj.key.split('/').pop() ?? obj.key} size={13} />
						{/if}
					</div>
					<div class="flex min-w-0 items-center px-1.5">
						<span
							class="overflow-hidden text-sm text-ellipsis whitespace-nowrap {isSelected
								? 'text-accent'
								: 'text-text'}">{getLabel(obj)}</span
						>
					</div>
					<div class="flex items-center justify-end px-1.5 font-mono text-sm text-muted">
						{obj.isFolder ? '—' : formatFileSize(obj.size ?? 0)}
					</div>
					<div class="flex items-center justify-end px-1.5 font-mono text-sm text-muted">
						{obj.isFolder ? '—' : formatDate(obj.lastModified)}
					</div>
					<div class="flex items-center justify-center">
						<button
							class="row-action flex items-center border-none bg-none p-1 text-transparent transition-colors group-hover:text-muted hover:text-text!"
							onclick={(e) => {
								e.stopPropagation();
								handleContextMenu(e, obj.key);
							}}
							title="More actions"
						>
							<Ellipsis size={12} />
						</button>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

{#if contextMenu}
	{@const obj = objects.find((o) => o.key === contextMenu!.key)}
	<div
		class="fixed z-100 min-w-40 animate-[fadeUp_0.12s_ease_both] border border-border bg-surface py-1"
		style="left: {contextMenu.x}px; top: {contextMenu.y}px"
	>
		{#if obj}
			{#if !obj.isFolder}
				<button
					class="flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-3.5 py-1.75 text-left font-mono text-sm text-muted transition-[color,background] hover:bg-white/4 hover:text-text"
					onclick={() => {
						onPreview(obj);
						closeContext();
					}}
				>
					<Eye size={12} /> Preview
				</button>
				<button
					class="flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-3.5 py-1.75 text-left font-mono text-sm text-muted transition-[color,background] hover:bg-white/4 hover:text-text"
					onclick={() => {
						navigator.clipboard.writeText(window.location.origin + '/obj/' + obj.key);
						closeContext();
					}}
				>
					<Link2 size={12} /> Copy link
				</button>
			{/if}
			<button
				class="flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-3.5 py-1.75 text-left font-mono text-sm text-muted transition-[color,background] hover:bg-white/4 hover:text-text"
				onclick={() => {
					onMove(obj.key);
					closeContext();
				}}
			>
				<MoveRight size={12} /> Move
			</button>
			<div class="mx-0 my-1 h-px bg-border"></div>
			<button
				class="flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-3.5 py-1.75 text-left font-mono text-sm text-muted transition-[color,background] hover:bg-white/4 hover:text-[#ff6b6b]"
				onclick={() => {
					onDelete([obj.key]);
					closeContext();
				}}
			>
				<Trash2 size={12} /> Delete
			</button>
		{/if}
	</div>
{/if}
