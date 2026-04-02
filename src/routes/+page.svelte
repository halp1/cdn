<script lang="ts">
	import type { PageData } from './$types';
	import Header from '$lib/components/Header.svelte';
	import FileTree from '$lib/components/FileTree.svelte';
	import FileList from '$lib/components/FileList.svelte';
	import FileViewer from '$lib/components/FileViewer.svelte';
	import RightPanel from '$lib/components/RightPanel.svelte';
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
		data: PageData;
	}
	let { data }: Props = $props();

	let currentPath = $state('');
	let searchQuery = $state('');
	let selected = $state<Set<string>>(new Set());
	let previewObj = $state<R2Object | null>(null);

	type RightPanelMode = 'upload-links' | 'api-keys' | 'stats' | 'preview' | null;
	let rightPanel = $state<RightPanelMode>(null);

	let treeWidth = $state(220);
	let rightWidth = $state(
		typeof window !== 'undefined' ? Math.round(window.innerWidth * 0.5) : 280
	);

	const filesResult = $derived(listObjectsQuery({ prefix: currentPath }));
	const allObjectsResult = listAllObjectsQuery();

	let uploadInput = $state<HTMLInputElement | null>(null);

	const navigate = (path: string) => {
		currentPath = path;
		selected = new Set();
		previewObj = null;
		if (rightPanel === 'preview') rightPanel = null;
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

	const handleDelete = async (keys: string[]) => {
		if (!confirm(`Delete ${keys.length} item${keys.length > 1 ? 's' : ''}?`)) return;
		for (const key of keys) {
			if (key.endsWith('/')) await deleteFolderCommand({ path: key });
			else await deleteObjectCommand({ key });
		}
		selected = new Set();
		await listObjectsQuery({ prefix: currentPath }).refresh();
		await allObjectsResult.refresh();
	};

	const handleMove = async (key: string) => {
		const dest = prompt(`Move "${key}" to:`, currentPath);
		if (!dest) return;
		const destKey = dest.endsWith('/') ? dest + key.split('/').pop() : dest;
		await moveObjectCommand({ sourceKey: key, destinationKey: destKey });
		await listObjectsQuery({ prefix: currentPath }).refresh();
		await allObjectsResult.refresh();
	};

	const handleNewFolder = async () => {
		const name = prompt('New folder name:');
		if (!name) return;
		const path = currentPath + name.replace(/[/\\]/g, '') + '/';
		await createFolderCommand({ path });
		await allObjectsResult.refresh();
		await listObjectsQuery({ prefix: currentPath }).refresh();
	};

	const handleUpload = () => {
		uploadInput?.click();
	};

	const handleFileUpload = async (e: Event) => {
		const input = e.target as HTMLInputElement;
		const files = input.files;
		if (!files) return;
		for (const file of Array.from(files)) {
			const key = currentPath + file.name;
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
		await listObjectsQuery({ prefix: currentPath }).refresh();
		await allObjectsResult.refresh();
	};

	const handleSearch = (q: string) => {
		searchQuery = q;
	};

	const selectedCount = $derived(selected.size);
</script>

<div class="relative z-1 flex h-screen flex-col overflow-hidden bg-(--bg)">
	<Header
		{currentPath}
		username={data.user?.username ?? ''}
		onSearch={handleSearch}
		onUpload={handleUpload}
		rightPanel={rightPanel ?? ''}
		onTogglePanel={handleTogglePanel}
		onNavigate={navigate}
	/>

	<div class="flex min-h-0 flex-1 overflow-hidden">
		{#await allObjectsResult}
			<div class="w-55 shrink-0 border-r border-border bg-surface"></div>
		{:then treeData}
			<FileTree
				objects={treeData.objects}
				{currentPath}
				onNavigate={navigate}
				width={treeWidth}
				onResize={(w) => {
					treeWidth = w;
				}}
			/>
		{/await}

		<main class="flex min-w-0 flex-1 flex-col overflow-hidden">
			{#await filesResult}
				<div
					class="flex h-50 items-center justify-center text-[11px] tracking-widest text-muted uppercase"
				>
					Loading…
				</div>
			{:then fileData}
				<FileList
					objects={fileData.objects}
					prefix={currentPath}
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
			{/await}
		</main>

		{#if rightPanel && rightPanel !== 'preview'}
			<RightPanel
				panel={rightPanel}
				onClose={() => {
					rightPanel = null;
				}}
				width={rightWidth}
				onResize={(w) => {
					rightWidth = w;
				}}
			/>
		{:else if rightPanel === 'preview'}
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
						const mm = (ev: MouseEvent) => {
							rightWidth = Math.max(220, Math.min(700, sw - (ev.clientX - sx)));
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
					r2Url={data.env?.r2_url ?? ''}
					onClose={() => {
						rightPanel = null;
						previewObj = null;
					}}
				/>
			</aside>
		{/if}
	</div>

	<div class="flex h-6 shrink-0 items-center justify-end border-t border-border bg-surface px-3">
		<div class="text-[10px] tracking-[0.08em] text-muted">
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
