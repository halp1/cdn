<script lang="ts">
	import Fa from 'svelte-fa';
	import {
		faUpload,
		faDownload,
		faTrash,
		faFolder,
		faLink,
		faCalculator
	} from '@fortawesome/free-solid-svg-icons';
	import type { R2Object } from '$lib/r2';
	import { calculateFolderSize, formatFileSize } from '$lib/file-operations';
	import { getFileIcon } from '$lib/file-icons';

	interface Props {
		objects: R2Object[];
		isLoading: boolean;
		currentPrefix: string;
		dragTarget: string | null;
		draggedObject: R2Object | null;
		fileListRef: HTMLDivElement | null;
		selectedObjects?: Set<string>;
		onObjectClick: (object: R2Object) => void;
		onFolderDrop: (event: DragEvent, key: string) => void;
		onFolderUpload: (key: string) => void;
		onDownloadObject: (object: R2Object) => void;
		onCopyLink: (object: R2Object) => void;
		onDeleteObject: (object: R2Object) => void;
		onDragTargetChange: (target: string | null) => void;
		onDraggedObjectChange: (object: R2Object | null) => void;
		onMultipleObjectsDelete?: (objects: R2Object[]) => void;
		onMultipleObjectsDrag?: (objects: R2Object[]) => void;
	}

	let {
		objects,
		isLoading,
		dragTarget,
		draggedObject,
		fileListRef = $bindable(),
		onObjectClick,
		onFolderDrop,
		onFolderUpload,
		onDownloadObject,
		onCopyLink,
		onDeleteObject,
		onDragTargetChange,
		onDraggedObjectChange,
		onMultipleObjectsDelete,
		onMultipleObjectsDrag,
		selectedObjects = $bindable(new Set<string>())
	}: Props = $props();

	let isSelectingMultiple = $state(false);
	let lastClickedIndex = $state(-1);

	// Sort objects with folders first, then alphabetically by name
	let sortedObjects = $derived(() => {
		return [...objects].sort((a, b) => {
			// Sort folders first
			if (a.isFolder && !b.isFolder) return -1;
			if (!a.isFolder && b.isFolder) return 1;

			// Then sort alphabetically by name
			const nameA = getObjectName(a.key!).toLowerCase();
			const nameB = getObjectName(b.key!).toLowerCase();
			return nameA.localeCompare(nameB);
		});
	});

	// Store for folder sizes, to avoid recalculating
	let folderSizes = $state(new Map<string, number>());
	let isFolderSizeLoading = $state(new Set<string>());

	async function getFolderSize(folder: R2Object) {
		if (!folder.isFolder || !folder.key) return;

		// If already calculating, don't start another calculation
		if (isFolderSizeLoading.has(folder.key)) return;

		// If we already have the size, don't recalculate
		if (folderSizes.has(folder.key)) return;

		try {
			// Mark as loading
			const newLoadingSet = new Set(isFolderSizeLoading);
			newLoadingSet.add(folder.key);
			isFolderSizeLoading = newLoadingSet;

			// Calculate folder size
			const size = await calculateFolderSize(folder.key);

			// Store the result
			const newSizes = new Map(folderSizes);
			newSizes.set(folder.key, size);
			folderSizes = newSizes;
			folder.folderSize = size;
		} catch (error) {
			console.error('Error calculating folder size:', error);
		} finally {
			// Mark as not loading
			const newSet = new Set(isFolderSizeLoading);
			newSet.delete(folder.key);
			isFolderSizeLoading = newSet;
		}
	}

	function getObjectName(key: string): string {
		if (!key) return '';

		if (key.endsWith('/')) {
			key = key.slice(0, -1);
		}

		const parts = key.split('/');
		return parts[parts.length - 1];
	}

	function formatSize(bytes?: number): string {
		if (bytes === undefined) return '';

		const units = ['B', 'KB', 'MB', 'GB', 'TB'];
		let size = bytes;
		let unitIndex = 0;

		while (size >= 1024 && unitIndex < units.length - 1) {
			size /= 1024;
			unitIndex++;
		}

		return `${size.toFixed(1)} ${units[unitIndex]}`;
	}

	function formatDate(date?: Date): string {
		if (!date) return '';
		return new Date(date).toLocaleString();
	}

	function handleObjectDragStart(event: DragEvent, object: R2Object) {
		if (!event.dataTransfer) return;
		if (selectedObjects.size > 1 && selectedObjects.has(object.key!)) {
			const selectedItems = sortedObjects().filter((obj) => selectedObjects.has(obj.key!));

			event.dataTransfer.setData(
				'application/json',
				JSON.stringify({
					keys: Array.from(selectedObjects),
					isMultiple: true
				})
			);

			if (onMultipleObjectsDrag) {
				onMultipleObjectsDrag(selectedItems);
			}
		} else {
			event.dataTransfer.setData(
				'application/json',
				JSON.stringify({
					key: object.key,
					isFolder: object.isFolder
				})
			);

			// If dragging an unselected item, deselect others
			if (!selectedObjects.has(object.key!)) {
				selectedObjects = new Set();
			}
		}

		event.dataTransfer.effectAllowed = 'move';

		const targetEl = event.currentTarget as HTMLElement;
		targetEl.classList.add('drag-highlight');

		onDraggedObjectChange(object);
	}

	function handleObjectDragEnd(event: DragEvent) {
		const targetEl = event.currentTarget as HTMLElement;
		targetEl.classList.remove('drag-highlight');

		onDraggedObjectChange(null);
		onDragTargetChange(null);
	}

	function handleFolderDragOver(event: DragEvent, folderKey: string) {
		event.preventDefault();
		event.stopPropagation();

		if (draggedObject) {
			event.dataTransfer!.dropEffect = 'move';
		} else {
			event.dataTransfer!.dropEffect = 'copy';
		}

		onDragTargetChange(folderKey);
	}

	function handleFolderDragLeave(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		onDragTargetChange(null);
	}

	function toggleObjectSelection(object: R2Object, event?: MouseEvent, isCheckboxClick = false) {
		const key = object.key!;
		isSelectingMultiple = true;

		// Create a new Set for reactive updates
		let newSelected = new Set(selectedObjects);

		if (event?.ctrlKey || event?.metaKey || isCheckboxClick) {
			// Toggle selection
			if (newSelected.has(key)) {
				newSelected.delete(key);
			} else {
				newSelected.add(key);
			}
		} else if (event?.shiftKey && lastClickedIndex >= 0) {
			// Select range with Shift key
			const currentIndex = sortedObjects().findIndex((obj) => obj.key === key);
			if (currentIndex >= 0) {
				const start = Math.min(lastClickedIndex, currentIndex);
				const end = Math.max(lastClickedIndex, currentIndex);
				for (let i = start; i <= end; i++) {
					newSelected.add(sortedObjects()[i].key!);
				}
			}
		} else {
			// Single selection
			if (newSelected.size === 1 && newSelected.has(key)) {
				newSelected = new Set();
				isSelectingMultiple = false;
			} else {
				newSelected = new Set([key]);
			}
		}

		// Assign new Set to trigger reactivity
		selectedObjects = newSelected;

		const currentIndex = sortedObjects().findIndex((obj) => obj.key === key);
		if (currentIndex >= 0) {
			lastClickedIndex = currentIndex;
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
			event.preventDefault();
			selectAllObjects();
		} else if (event.key === 'Escape') {
			deselectAllObjects();
		} else if (event.key === 'Delete' && selectedObjects.size > 0) {
			handleBatchDelete();
		}
	}

	function handleRowClick(object: R2Object, event: MouseEvent) {
		if (
			isSelectingMultiple ||
			event?.ctrlKey ||
			event?.metaKey ||
			event?.shiftKey ||
			selectedObjects.size > 0
		) {
			toggleObjectSelection(object, event);
			event.stopPropagation();
			event.preventDefault();
		} else {
			onObjectClick(object);
		}
	}

	function selectAllObjects() {
		selectedObjects = new Set(sortedObjects().map((obj) => obj.key!));
		isSelectingMultiple = true;
	}

	function deselectAllObjects() {
		selectedObjects = new Set();
		isSelectingMultiple = false;
	}

	function handleBatchDelete() {
		if (selectedObjects.size === 0) return;

		const selectedItems = sortedObjects().filter((obj) => selectedObjects.has(obj.key!));

		if (onMultipleObjectsDelete) {
			onMultipleObjectsDelete(selectedItems);
			selectedObjects = new Set();
			isSelectingMultiple = false;
		} else if (selectedObjects.size === 1) {
			// Fallback to single delete if batch delete isn't implemented
			const obj = sortedObjects().find((obj) => obj.key === Array.from(selectedObjects)[0]);
			if (obj) onDeleteObject(obj);
			selectedObjects = new Set();
			isSelectingMultiple = false;
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="overflow-auto p-4" bind:this={fileListRef} onkeydown={handleKeyDown} tabindex="0">
	{#if isLoading}
		<div class="flex h-full items-center justify-center">
			<div class="glass-panel pulse-glow p-8">
				<div class="flex items-center gap-3">
					<div
						class="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-200"
					></div>
					<span class="text-lg">Loading...</span>
				</div>
			</div>
		</div>
	{:else if objects.length === 0}
		<div class="mt-8 flex h-full flex-col items-center justify-center gap-6">
			<div class="glass-panel p-8 text-center">
				<div class="mb-2 text-xl">No files or folders found</div>
				<div class="text-zinc-500">Drag and drop files here to upload</div>
			</div>
		</div>
	{:else}
		<div class="w-full space-y-2">
			<!-- Header -->
			<div class="glass-panel mb-4 p-4">
				<div
					class="grid font-semibold text-zinc-300"
					style="grid-template-columns: 40px 1fr 1fr 1fr 1fr;"
				>
					<div class="flex items-center justify-center text-center">
						<input
							type="checkbox"
							onclick={(e) => {
								e.stopPropagation();
								if (sortedObjects().length > 0) {
									if (selectedObjects.size === sortedObjects().length) {
										deselectAllObjects();
									} else {
										selectAllObjects();
									}
								}
							}}
							checked={sortedObjects().length > 0 &&
								selectedObjects.size === sortedObjects().length}
							class="checkbox scale-110 accent-blue-500"
						/>
					</div>
					<div class="text-left">Name</div>
					<div class="text-left">Size</div>
					<div class="text-left">Last Modified</div>
					<div class="text-right">Actions</div>
				</div>
			</div>

			<!-- File/Folder rows -->
			<div class="space-y-2">
				{#each sortedObjects() as object}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="glass-panel group grid cursor-pointer items-center p-4 transition-colors duration-200 hover:bg-zinc-800 {selectedObjects.has(
							object.key!
						)
							? '!border-blue-600 !bg-zinc-800'
							: ''}"
						style="grid-template-columns: 40px 1fr 1fr 1fr 1fr;"
						class:drag-highlight={dragTarget === object.key && draggedObject?.key !== object.key}
						ondragover={object.isFolder ? (e) => handleFolderDragOver(e, object.key!) : undefined}
						ondragleave={object.isFolder ? handleFolderDragLeave : undefined}
						ondrop={object.isFolder ? (e) => onFolderDrop(e, object.key!) : undefined}
						ondragstart={(e) => handleObjectDragStart(e, object)}
						ondragend={handleObjectDragEnd}
						draggable={selectedObjects.size > 0 ? selectedObjects.has(object.key!) : true}
						onclick={(e) => handleRowClick(object, e)}
					>
						<div
							class="flex items-center justify-center text-center"
							onclick={(e) => {
								e.stopPropagation();
								toggleObjectSelection(object, undefined, true);
							}}
						>
							<input
								type="checkbox"
								checked={selectedObjects.has(object.key!)}
								class="checkbox scale-110 accent-blue-500"
							/>
						</div>
						<div class="">
							<div class="flex items-center gap-3">
								{#if object.isFolder}
									<Fa
										icon={faFolder}
										class="text-blue-400 transition-transform group-hover:scale-110"
									/>
								{:else}
									{@const fileIconData = getFileIcon(getObjectName(object.key!))}
									<Fa
										icon={fileIconData.icon}
										class="{fileIconData.color} transition-transform group-hover:scale-110"
									/>
								{/if}
								<span class="font-medium">{getObjectName(object.key!)}</span>
							</div>
						</div>
						<div class="text-zinc-300">
							{#if object.isFolder}
								{#if folderSizes.has(object.key!)}
									{formatSize(folderSizes.get(object.key!))}
								{:else if isFolderSizeLoading.has(object.key!)}
									<span class="flex items-center gap-2 text-blue-400">
										<div
											class="h-4 w-4 animate-spin rounded-full border-2 border-blue-400/30 border-t-blue-400"
										></div>
										Calculating...
									</span>
								{:else}
									<button
										class="btn flex items-center gap-2 !px-2 !py-1 text-sm"
										onclick={(e) => {
											e.stopPropagation();
											getFolderSize(object);
										}}
									>
										<Fa icon={faCalculator} size="sm" />
										<span>Calculate</span>
									</button>
								{/if}
							{:else}
								{formatSize(object.size)}
							{/if}
						</div>
						<div class="text-zinc-300">
							{object.isFolder ? '-' : formatDate(object.lastModified)}
						</div>
						<div class="flex justify-end gap-2 text-right">
							{#if object.isFolder}
								<button
									onclick={(e) => {
										e.stopPropagation();
										onFolderUpload(object.key!);
									}}
									class="btn-circle group/btn !h-8 !w-8"
									title="Upload to folder"
								>
									<Fa
										icon={faUpload}
										class="text-green-400 transition-transform group-hover/btn:scale-110"
									/>
								</button>
							{:else}
								<button
									onclick={(e) => {
										e.stopPropagation();
										onCopyLink(object);
									}}
									class="btn-circle group/btn !h-8 !w-8"
									title="Copy link"
								>
									<Fa
										icon={faLink}
										class="text-blue-400 transition-transform group-hover/btn:scale-110"
									/>
								</button>
								<button
									onclick={(e) => {
										e.stopPropagation();
										onDownloadObject(object);
									}}
									class="btn-circle group/btn !h-8 !w-8"
									title="Download"
								>
									<Fa
										icon={faDownload}
										class="text-purple-400 transition-transform group-hover/btn:scale-110"
									/>
								</button>
							{/if}
							<button
								onclick={(e) => {
									e.stopPropagation();
									onDeleteObject(object);
								}}
								class="btn-circle group/btn !h-8 !w-8"
								title="Delete"
							>
								<Fa
									icon={faTrash}
									class="text-red-400 transition-transform group-hover/btn:scale-110"
								/>
							</button>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	@reference "tailwindcss";
	
	[ondragover] {
		transition: all 0.3s ease;
		transform: translateY(-2px);
	}

	[draggable='true'] {
		cursor: grab;
	}

	[draggable='true']:active {
		cursor: grabbing;
	}

	.checkbox {
		@apply h-4 w-4 rounded border-zinc-600 bg-zinc-900;
	}

	input[type='checkbox']:checked {
		@apply border-blue-500 bg-blue-500;
	}
</style>
