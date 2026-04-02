<script lang="ts">
	import type { R2Object } from '$lib/r2';
	import Fa from 'svelte-fa';
	import { faTimes, faTrash } from '@fortawesome/free-solid-svg-icons';
	import StorageStats from '../StorageStats.svelte';

	interface Props {
		currentPrefix: string;
		dragTarget: string | null;
		draggedObject: R2Object | null;
		selectedObjects?: Set<string>;
		onBreadcrumbClick: (prefix: string) => void;
		onBreadcrumbDrop: (event: DragEvent, prefix: string) => void;
		onDragTargetChange: (target: string | null) => void;
		onDeselectAll?: () => void;
		onBatchDelete?: () => void;
	}

	const props: Props = $props();

	function calculateBreadcrumbs(prefix: string) {
		const newBreadcrumbs = [{ name: 'Root', prefix: '' }];
		if (prefix) {
			const parts = prefix.split('/').filter(Boolean);
			let currentPath = '';
			for (const part of parts) {
				currentPath += `${part}/`;
				newBreadcrumbs.push({
					name: part,
					prefix: currentPath
				});
			}
		}
		return newBreadcrumbs;
	}

	const breadcrumbs = $derived(calculateBreadcrumbs(props.currentPrefix));

	function handleBreadcrumbDragOver(event: DragEvent, prefix: string) {
		event.preventDefault();
		event.stopPropagation();

		if (props.draggedObject) {
			event.dataTransfer!.dropEffect = 'move';
		} else {
			event.dataTransfer!.dropEffect = 'copy';
		}

		props.onDragTargetChange(prefix);
	}

	function handleBreadcrumbDragLeave(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		props.onDragTargetChange(null);
	}
</script>

<div class="glass-panel mx-4 flex h-14 items-center px-4">
	<div class="flex flex-grow items-center space-x-2">
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		{#each breadcrumbs as crumb, i}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<span
				class="cursor-pointer rounded-md border px-3 py-1 transition-colors duration-200 {props.dragTarget ===
				crumb.prefix
					? 'border-blue-600 bg-zinc-800'
					: 'border-zinc-800 bg-zinc-900 hover:bg-zinc-800'}"
				onclick={() => props.onBreadcrumbClick(crumb.prefix)}
				ondragover={(e) => handleBreadcrumbDragOver(e, crumb.prefix)}
				ondragleave={handleBreadcrumbDragLeave}
				ondrop={(e) => props.onBreadcrumbDrop(e, crumb.prefix)}
			>
				{crumb.name}
			</span>
			{#if i < breadcrumbs.length - 1}
				<span class="text-zinc-500">/</span>
			{/if}
		{/each}
	</div>

	<div class="ml-auto flex items-center gap-4">
		<!-- Storage Statistics -->
		<StorageStats />

		<!-- Selected Items Actions -->
		{#if props.selectedObjects && props.selectedObjects.size > 0}
			<div class="btn flex items-center gap-3">
				<span class="text-sm font-medium"
					>{props.selectedObjects.size} item{props.selectedObjects.size !== 1 ? 's' : ''} selected</span
				>
				{#if props.onBatchDelete}
					<button class="btn-circle !h-8 !w-8" onclick={() => props.onBatchDelete?.()}>
						<Fa icon={faTrash} class="text-red-400" />
					</button>
				{/if}
				{#if props.onDeselectAll}
					<button class="btn-circle !h-8 !w-8" onclick={() => props.onDeselectAll?.()}>
						<Fa icon={faTimes} />
					</button>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	span[ondragover]:hover {
		transform: translateY(-1px);
	}
</style>
