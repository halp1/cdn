<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { goto } from '$app/navigation';
	import { FolderPlus, Upload, Trash2 } from 'lucide-svelte';
	import Header from '$lib/components/Header.svelte';
	import FileTree from '$lib/components/FileTree.svelte';
	import FileList from '$lib/components/FileList.svelte';
	import FileViewer from '$lib/components/FileViewer.svelte';
	import RightPanel from '$lib/components/RightPanel.svelte';
	import NewFolderModal from '$lib/components/NewFolderModal.svelte';
	import DeleteModal from '$lib/components/DeleteModal.svelte';
	import {
		listObjectsQuery,
		listAllObjectsQuery,
		deleteObjectCommand,
		moveObjectCommand,
		getUploadUrl,
		createFolderCommand,
		deleteFolderCommand
	} from '$lib/api/r2.remote';
	import type { R2Object } from '$lib/r2-server';
	import { SvelteSet } from 'svelte/reactivity';

	interface Props {
		path: string;
		username: string;
		r2Url: string;
	}
	let { path, username, r2Url }: Props = $props();

	let searchQuery = $state('');
	let selected = $state<Set<string>>(new Set());
	let previewObj = $state<R2Object | null>(null);

	type RightPanelMode = 'upload-links' | 'api-keys' | 'stats' | 'preview' | null;
	let rightPanel = $state<RightPanelMode>(null);

	let treeWidth = $state(220);
	let windowWidth = $state(typeof window !== 'undefined' ? window.innerWidth : 1280);
	let rightRatio = $state(0.5);
	const rightWidth = $derived(Math.max(220, Math.round((windowWidth - treeWidth) * rightRatio)));

	let filesData = $state<{ objects: R2Object[]; prefix: string } | null>(null);
	let allObjectsData = $state<{ objects: { key: string; isFolder: boolean }[] } | null>(null);

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

	$effect(() => {
		void refreshAllObjects();
	});

	let uploadInput = $state<HTMLInputElement | null>(null);

	const navigate = (newPath: string) => {
		if (!newPath) {
			goto('/');
		} else {
			const normalized = newPath.endsWith('/') ? newPath : newPath + '/';
			goto('/files/' + normalized);
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
		rightPanel = 'preview';
	};

	const handleTogglePanel = (panel: string) => {
		const p = panel as RightPanelMode;
		rightPanel = rightPanel === p ? null : p;
		if (p !== 'preview') previewObj = null;
	};

	let deleteModalKeys = $state<string[] | null>(null);

	const handleDelete = (keys: string[]) => {
		deleteModalKeys = keys;
	};

	const confirmDelete = async () => {
		const keys = deleteModalKeys;
		deleteModalKeys = null;
		if (!keys) return;
		for (const key of keys) {
			if (key.endsWith('/')) await deleteFolderCommand({ path: key });
			else await deleteObjectCommand({ key });
		}
		selected = new Set();
		await Promise.all([refreshFiles(), refreshAllObjects()]);
	};

	const handleMove = async (key: string) => {
		const dest = prompt(`Move "${key}" to:`, path);
		if (!dest) return;
		const destKey = dest.endsWith('/') ? dest + key.split('/').pop() : dest;
		await moveObjectCommand({ sourceKey: key, destinationKey: destKey });
		await Promise.all([refreshFiles(), refreshAllObjects()]);
	};

	let showNewFolderModal = $state(false);

	const handleNewFolder = () => {
		showNewFolderModal = true;
	};

	const confirmNewFolder = async (name: string) => {
		showNewFolderModal = false;
		const newPath = path + name.replace(/[/\\]/g, '') + '/';
		await createFolderCommand({ path: newPath });
		await Promise.all([refreshFiles(), refreshAllObjects()]);
	};

	const handleUpload = () => {
		uploadInput?.click();
	};

	const handleFileUpload = async (e: Event) => {
		const input = e.target as HTMLInputElement;
		const files = input.files;
		if (!files) return;
		for (const file of Array.from(files)) {
			const key = path + file.name;
			const result = await getUploadUrl({ key, type: file.type || 'application/octet-stream' });
			await new Promise<void>((resolve, reject) => {
				const xhr = new XMLHttpRequest();
				xhr.open('PUT', result.url);
				xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
				xhr.onload = () =>
					xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`));
				xhr.onerror = () => reject(new Error('Network error'));
				xhr.send(file);
			});
		}
		input.value = '';
		await Promise.all([refreshFiles(), refreshAllObjects()]);
	};

	const handleSearch = (q: string) => {
		searchQuery = q;
	};

	const selectedCount = $derived(selected.size);

	const breadcrumbs = $derived.by(() => {
		if (!path) return [];
		const parts = path.replace(/\/$/, '').split('/').filter(Boolean);
		return parts.map((part, i) => ({
			label: part,
			href: '/files/' + parts.slice(0, i + 1).join('/') + '/'
		}));
	});
</script>

<svelte:window bind:innerWidth={windowWidth} />

<div class="relative z-1 flex h-screen flex-col overflow-hidden bg-(--bg)">
	<Header
		{username}
		onSearch={handleSearch}
		onUpload={handleUpload}
		rightPanel={rightPanel ?? ''}
		onTogglePanel={handleTogglePanel}
	/>

	<div class="flex min-h-0 flex-1 overflow-hidden">
		{#if allObjectsData === null}
			<div class="w-55 shrink-0 border-r border-border bg-(--surface)"></div>
		{:else}
			<FileTree
				objects={allObjectsData.objects}
				currentPath={path}
				onNavigate={navigate}
				onPreview={(obj) => handlePreview(obj as import('$lib/r2-server').R2Object)}
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
				<nav class="flex h-full min-w-0 flex-1 items-center bg-bg text-sm" aria-label="Breadcrumb">
					{#if breadcrumbs.length === 0}
						<span class="text-text">root</span>
					{:else}
						<a href="/" class="px-0.5 text-muted transition-colors hover:text-text">root</a>
						{#each breadcrumbs as crumb, i (crumb.href)}
							<span class="px-1 text-border select-none">/</span>
							{#if i === breadcrumbs.length - 1}
								<span class="px-0.5 whitespace-nowrap text-text">{crumb.label}</span>
							{:else}
								<a
									href={crumb.href}
									class="px-0.5 whitespace-nowrap text-muted transition-colors hover:text-text"
									>{crumb.label}</a
								>
							{/if}
						{/each}
					{/if}
				</nav>
				<div class="flex shrink-0 items-center gap-1">
					{#if selected.size > 0}
						<button
							class="flex cursor-pointer items-center gap-1.25 border border-[#ff6b6b]/40 bg-transparent px-2 py-1 font-mono text-xs tracking-[0.06em] text-[#ff6b6b] uppercase transition-[color,border-color,background] hover:border-[#ff6b6b]"
							onclick={() => handleDelete([...selected])}
							title="Delete selected"
						>
							<Trash2 size={13} />
							<span>Delete {selected.size}</span>
						</button>
					{/if}
					<button
						class="flex cursor-pointer items-center gap-1.25 border border-border bg-transparent px-2 py-1 font-mono text-xs tracking-[0.06em] text-(--muted) uppercase transition-[color,border-color,background] hover:border-(--muted) hover:bg-white/3 hover:text-(--text)"
						onclick={handleNewFolder}
						title="New folder"
					>
						<FolderPlus size={13} />
						<span>New folder</span>
					</button>
					<button
						class="flex cursor-pointer items-center gap-1.25 border border-border bg-transparent px-2 py-1 font-mono text-xs tracking-[0.06em] text-(--muted) uppercase transition-[color,border-color,background] hover:border-(--muted) hover:bg-white/3 hover:text-(--text)"
						onclick={handleUpload}
						title="Upload"
					>
						<Upload size={13} />
						<span>Upload</span>
					</button>
				</div>
			</div>

			{#if filesData === null}
				<div
					class="flex h-50 items-center justify-center text-sm tracking-widest text-(--muted) uppercase"
				>
					Loading…
				</div>
			{:else}
				<FileList
					objects={filesData.objects}
					prefix={path}
					{selected}
					onSelect={handleSelect}
					onNavigate={navigate}
					onDelete={handleDelete}
					onMove={handleMove}
					onPreview={handlePreview}
					onNewFolder={handleNewFolder}
					onUpload={handleUpload}
					{searchQuery}
				/>
			{/if}
		</main>

		{#if rightPanel && rightPanel !== 'preview'}
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
		{:else if rightPanel === 'preview'}
			<aside
				class="relative flex shrink-0 flex-col overflow-hidden border-l border-border bg-(--surface)"
				style="width: {rightWidth}px"
			>
				<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
				<div
					class="absolute top-0 left-0 z-2 h-full w-1 cursor-col-resize hover:bg-(--accent) hover:opacity-50"
					onmousedown={(e) => {
						let sx = e.clientX,
							sw = rightWidth;
						const contentW = windowWidth - treeWidth;
						const mm = (ev: MouseEvent) => {
							const newW = Math.max(220, Math.min(contentW - 28, sw - (ev.clientX - sx)));
							rightRatio = newW / contentW;
						};
						const mu = () => {
							window.removeEventListener('mousemove', mm);
							window.removeEventListener('mouseup', mu);
						};
						window.addEventListener('mousemove', mm);
						window.addEventListener('mouseup', mu);
						e.preventDefault();
					}}
					role="separator"
					aria-orientation="vertical"
					tabindex="-1"
				></div>
				<FileViewer
					obj={previewObj}
					{r2Url}
					onClose={() => {
						rightPanel = null;
						previewObj = null;
					}}
				/>
			</aside>
		{/if}
	</div>

	<div
		class="flex h-6 shrink-0 items-center justify-end border-t border-border bg-(--surface) px-3"
	>
		<div class="text-xs tracking-[0.08em] text-(--muted)">
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
