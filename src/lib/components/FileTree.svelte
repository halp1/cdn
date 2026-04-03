<script lang="ts">
	import { ChevronRight, ChevronDown, Folder, FolderOpen } from '@lucide/svelte';
	import FileIcon from './FileIcon.svelte';
	import { SvelteSet } from 'svelte/reactivity';

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
		width: number;
		onResize: (w: number) => void;
	}

	let { objects, currentPath, onNavigate, onPreview, width, onResize }: Props = $props();

	let expanded = $state<SvelteSet<string>>(new SvelteSet());

	const expandAncestors = (path: string) => {
		const parts = path.replace(/\/$/, '').split('/').filter(Boolean);
		let acc = '';
		for (const part of parts) {
			acc = acc ? acc + '/' + part : part;
			expanded.add(acc + '/');
		}
	};

	$effect(() => {
		expandAncestors(currentPath);
	});

	const allPaths = $derived.by(() => {
		const set = new SvelteSet<string>();
		for (const obj of objects) {
			set.add(obj.key);
			if (!obj.isFolder) {
				const segments = obj.key.split('/');
				let acc = '';
				for (let i = 0; i < segments.length - 1; i++) {
					acc = acc ? acc + '/' + segments[i] : segments[i];
					set.add(acc + '/');
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
			const isFolder = path.endsWith('/');
			const segments = path.replace(/\/$/, '').split('/').filter(Boolean);
			let nodes = root;
			let accumulated = '';
			for (let i = 0; i < segments.length; i++) {
				const seg = segments[i];
				accumulated = accumulated ? accumulated + '/' + seg : seg;
				const isLast = i === segments.length - 1;
				const isThisFolder = isLast ? isFolder : true;
				const fullPath = isThisFolder ? accumulated + '/' : accumulated;
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
/>

<aside
	class="relative flex shrink-0 flex-col overflow-hidden border-r border-border bg-surface"
	style="width: {width}px"
>
	<div class="flex h-9 shrink-0 items-center border-b border-border px-3">
		<span class="text-xs tracking-[0.16em] text-muted uppercase">Files</span>
	</div>

	<div
		class="flex-1 overflow-x-hidden overflow-y-auto py-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent"
	>
		<button
			class="flex w-full cursor-pointer items-center gap-1.5 overflow-hidden border-none bg-none py-1 pr-2 pl-3 text-left font-mono text-sm text-ellipsis whitespace-nowrap transition-colors {currentPath ===
			''
				? 'bg-accent/6 text-accent'
				: 'text-muted hover:bg-white/3 hover:text-text'}"
			onclick={() => onNavigate('')}
		>
			<FolderOpen size={12} />
			<span>root</span>
		</button>

		{#snippet renderNodes(nodes: TreeNode[], depth: number)}
			{#each nodes as node (node.path)}
				{@const isOpen = expanded.has(node.path)}
				{@const isActive = node.isFolder && currentPath === node.path}
				<div class="flex flex-col" style="padding-left: {depth * 12 + 8}px">
					{#if node.isFolder}
						<button
							class="flex w-full cursor-pointer items-center gap-1.5 overflow-hidden border-none bg-none py-1 pr-2 text-left font-mono text-sm text-ellipsis whitespace-nowrap transition-colors {isActive
								? 'bg-accent/6 text-accent'
								: 'text-muted hover:bg-white/3 hover:text-text'}"
							onclick={() => {
								expanded.add(node.path);
								onNavigate(node.path);
							}}
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
									if (e.key === 'Enter' || e.key === ' ') {
										e.stopPropagation();
										toggle(node.path);
									}
								}}
							>
								{#if isOpen}<ChevronDown size={10} />{:else}<ChevronRight size={10} />{/if}
							</span>
							{#if isOpen}<FolderOpen size={12} />{:else}<Folder size={12} />{/if}
							<span class="min-w-0 overflow-hidden text-ellipsis">{node.name}</span>
						</button>
					{:else}
						<button
							class="flex w-full cursor-pointer items-center gap-1.5 overflow-hidden border-none bg-none py-1 pr-2 text-left font-mono text-sm text-ellipsis whitespace-nowrap text-muted/70 transition-colors hover:bg-white/3 hover:text-text"
							onclick={() => {
								const parentPath = node.path.includes('/')
									? node.path.slice(0, node.path.lastIndexOf('/') + 1)
									: '';
								onNavigate(parentPath);
								onPreview(
									objects.find((o) => o.key === node.path) ?? { key: node.path, isFolder: false }
								);
							}}
						>
							<span class="w-2.5 shrink-0"></span>
							<FileIcon filename={node.name} size={12} />
							<span class="min-w-0 overflow-hidden text-ellipsis">{node.name}</span>
						</button>
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
		class="absolute top-0 right-0 h-full w-1 cursor-col-resize border-none bg-transparent transition-colors hover:bg-accent/50"
		onmousedown={onMouseDown}
		role="separator"
		aria-orientation="vertical"
		aria-label="Resize file tree"
		tabindex="-1"
	/>
</aside>
