<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { listObjects, getUploadUrl, type R2Object, moveObject, deleteObject } from '$lib/r2';
	import FileViewer from '$lib/components/FileViewer.svelte';
	import Breadcrumbs from '$lib/components/file-explorer/Breadcrumbs.svelte';
	import FileList from '$lib/components/file-explorer/FileList.svelte';
	import UploadProgress from '$lib/components/file-explorer/UploadProgress.svelte';
	import NewFolderInput from '$lib/components/file-explorer/NewFolderInput.svelte';
	import CreateUploadLinkModal from '$lib/components/CreateUploadLinkModal.svelte';
	import UploadLinksPanel from '$lib/components/UploadLinksPanel.svelte';
	import {
		uploadFile,
		processDirectoryEntry,
		processFileEntry,
		type UploadFile
	} from '$lib/file-upload';
	import { handleObjectMoveToFolder, handleDeleteObject } from '$lib/file-operations';
	import Fa from 'svelte-fa';
	import {
		faUpload,
		faFolder,
		faFolderPlus,
		faSignOutAlt,
		faLink,
		faKey,
		faRocket
	} from '@fortawesome/free-solid-svg-icons';
	import { toast } from '$lib/toast';
	import { deployCommand } from '$lib/api/deploy.remote';

	const data = page.data.preload!;

	let objects = $state<R2Object[]>(data.initialFiles.objects);
	let currentPrefix = $state(data.initialFiles.prefix);
	let isLoading = $state(false);
	let uploadFiles = $state<UploadFile[]>([]);
	let selectedObject = $state<R2Object | null>(null);
	let showFileViewer = $state(false);
	let panelWidth = $state(50); // Default to 50% width for file viewer
	let newFolderName = $state('');
	let showNewFolderInput = $state(false);
	let dragTarget = $state<string | null>(null);
	let fileListRef = $state<HTMLDivElement | null>(null);
	let draggedObject = $state<R2Object | null>(null);
	let draggedObjects = $state<R2Object[]>([]);
	let fileListSelectedObjects = $state<Set<string>>(new Set());
	let showCreateUploadLinkModal = $state(false);
	let uploadLinksPanel = $state<any>(null);

	async function loadObjects(prefixToLoad: string = '') {
		isLoading = true;

		try {
			const result = await listObjects(prefixToLoad);
			objects = result.objects;
			currentPrefix = result.prefix;
		} catch (err) {
			toast.error('Failed to load files and folders');
			console.error(err);
		} finally {
			isLoading = false;
		}
	}

	function handleObjectClick(object: R2Object) {
		if (object.isFolder) {
			loadObjects(object.key);
			// Clear selection when navigating to a different folder
			fileListSelectedObjects = new Set();
		} else {
			selectedObject = object;
			showFileViewer = true;
		}
	}

	function closeFileViewer() {
		showFileViewer = false;
		selectedObject = null;
	}

	function handleBreadcrumbClick(prefix: string) {
		loadObjects(prefix);
		// Clear selection when navigating to a different folder
		fileListSelectedObjects = new Set();
	}

	function handleDownloadObject(object: R2Object) {
		window.open(`/api/r2/download?key=${encodeURIComponent(object.key!)}`, '_blank');
	}

	function handleFileUpload(event: Event, targetPrefix: string | null = null) {
		const input = event.target as HTMLInputElement;
		if (!input.files || input.files.length === 0) return;

		const prefix = targetPrefix ?? currentPrefix;

		for (const file of Array.from(input.files)) {
			const newUploadFile = { file, progress: 0, isUploading: false, abort: () => {} };
			uploadFiles = [...uploadFiles, newUploadFile];
			handleUploadFile(newUploadFile, prefix);
		}
	}

	async function handleUploadFile(uploadFileItem: UploadFile, prefix: string) {
		uploadFiles = await uploadFile(
			uploadFileItem,
			prefix,
			uploadFiles,
			() => loadObjects(currentPrefix),
			(files) => {
				uploadFiles = files;
			}
		);
	}

	function handleResizeStart(event: MouseEvent) {
		const startX = event.clientX;
		const startWidth = panelWidth;

		function handleMouseMove(moveEvent: MouseEvent) {
			// Calculate new width based on mouse movement
			const containerWidth = document.body.clientWidth;
			const dx = moveEvent.clientX - startX;
			const newWidthPercent = Math.max(20, Math.min(80, startWidth - (dx / containerWidth) * 100));
			panelWidth = newWidthPercent;
		}

		function handleMouseUp() {
			document.removeEventListener('mousemove', handleMouseMove);
			document.removeEventListener('mouseup', handleMouseUp);
		}

		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();

		// Add a subtle highlight to the dropzone
		if (fileListRef && event.dataTransfer?.types.includes('Files')) {
			fileListRef.classList.add('drag-highlight');
		}
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();

		// Remove highlight
		if (fileListRef) {
			fileListRef.classList.remove('drag-highlight');
		}

		dragTarget = null;
	}

	function handleDrop(event: DragEvent, targetPrefix: string | null = null) {
		event.preventDefault();
		event.stopPropagation();

		// Remove highlight
		if (fileListRef) {
			fileListRef.classList.remove('drag-highlight');
		}

		const prefix = targetPrefix ?? currentPrefix;
		const items = event.dataTransfer?.items;

		if (!items || items.length === 0) return;

		// Handle directory drops using the DataTransferItemList API
		for (const item of Array.from(items)) {
			if (item.kind === 'file') {
				const entry = item.webkitGetAsEntry?.();
				if (entry) {
					if (entry.isDirectory) {
						processDirectoryEntry(
							entry as FileSystemDirectoryEntry,
							prefix,
							uploadFiles,
							(file, dirPath) => {
								const newUploadFile = { file, progress: 0, isUploading: false, abort: () => {} };
								uploadFiles = [...uploadFiles, newUploadFile];
								handleUploadFile(newUploadFile, dirPath);
							}
						);
					} else if (entry.isFile) {
						processFileEntry(entry as FileSystemFileEntry, prefix, (file, dirPath) => {
							const newUploadFile = { file, progress: 0, isUploading: false, abort: () => {} };
							uploadFiles = [...uploadFiles, newUploadFile];
							handleUploadFile(newUploadFile, dirPath);
						});
					}
				} else {
					// Fallback for browsers that don't support webkitGetAsEntry
					const file = item.getAsFile();
					if (file) {
						const newUploadFile = { file, progress: 0, isUploading: false, abort: () => {} };
						uploadFiles = [...uploadFiles, newUploadFile];
						handleUploadFile(newUploadFile, prefix);
					}
				}
			}
		}

		dragTarget = null;
	}

	function handleBreadcrumbDrop(event: { event: DragEvent; prefix: string }) {
		if (draggedObject) {
			// This is a move operation
			if (draggedObjects.length > 1) {
				handleMultipleObjectsMove(draggedObjects, event.prefix);
				draggedObjects = [];
			} else {
				handleObjectMove(draggedObject, event.prefix);
			}
			draggedObject = null;
		} else {
			// This is a regular file upload
			handleDrop(event.event, event.prefix);
		}

		dragTarget = null;
	}

	function handleFolderDrop(event: { event: DragEvent; key: string }) {
		if (draggedObject) {
			// This is a move operation
			if (draggedObjects.length > 1) {
				handleMultipleObjectsMove(draggedObjects, event.key);
				draggedObjects = [];
			} else {
				handleObjectMove(draggedObject, event.key);
			}
			draggedObject = null;
		} else {
			// This is a regular file upload
			handleDrop(event.event, event.key);
		}

		dragTarget = null;
	}

	function createNewFolder() {
		if (!newFolderName.trim()) {
			toast.error('Folder name cannot be empty');
			return;
		}

		// Client-side only: create a folder representation
		const folderKey = `${currentPrefix}${newFolderName.trim()}/`;

		// Check if folder already exists
		if (objects.some((obj) => obj.isFolder && obj.key === folderKey)) {
			toast.error(`Folder '${newFolderName}' already exists`);
			return;
		}

		// Add to objects array
		objects = [
			...objects,
			{
				key: folderKey,
				isFolder: true
			}
		];

		// Reset input
		newFolderName = '';
		showNewFolderInput = false;
	}

	function handleFolderUpload(folderKey: string) {
		// Create a file input and trigger click
		const input = document.createElement('input');
		input.type = 'file';
		input.multiple = true;
		input.onchange = (e) => handleFileUpload(e, folderKey);
		input.click();
	}

	async function handleObjectMove(sourceObject: R2Object, targetFolder: string) {
		await handleObjectMoveToFolder(sourceObject, targetFolder, () => loadObjects(currentPrefix));
	}

	function handleDirectoryUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files || input.files.length === 0) return;

		for (const file of Array.from(input.files)) {
			// Get relative path of file within directory
			const path = file.webkitRelativePath;
			if (!path) continue;

			// Extract directory structure
			const pathParts = path.split('/');
			pathParts.pop(); // Remove filename

			// Build the prefix including the directory structure
			const dirPrefix =
				pathParts.length > 0 ? `${currentPrefix}${pathParts.join('/')}/` : currentPrefix;

			const newUploadFile = { file, progress: 0, isUploading: false, abort: () => {} };
			uploadFiles = [...uploadFiles, newUploadFile];
			handleUploadFile(newUploadFile, dirPrefix);
		}
	}

	async function handleCopyLink(object: R2Object) {
		if (!object.key) {
			toast.error('Cannot copy link: Object key is missing');
			return;
		}

		const url = `${location.origin}/obj/${encodeURIComponent(object.key)}`;

		try {
			await navigator.clipboard.writeText(url);
			toast.success('Link copied to clipboard');
		} catch (err) {
			console.error('Failed to copy link:', err);
			toast.error('Failed to copy link to clipboard');
		}
	}

	async function handleMultipleObjectsMove(objects: R2Object[], targetFolder: string) {
		const { dismiss } = toast.loading(`Moving ${objects.length} items...`);
		let success = true;

		try {
			for (const obj of objects) {
				try {
					await handleObjectMoveToFolder(obj, targetFolder, () => Promise.resolve());
				} catch (err) {
					success = false;
					console.error(`Failed to move ${obj.key}:`, err);
				}
			}

			if (success) {
				toast.success(
					`Moved ${objects.length} items to ${targetFolder === '' ? 'Root' : targetFolder}`
				);
			} else {
				toast.error('Some items could not be moved');
			}

			await loadObjects(currentPrefix);
		} catch (err) {
			toast.error('Failed to move items');
			console.error(err);
		} finally {
			dismiss();
		}
	}

	async function handleMultipleObjectsDelete(objects: R2Object[]) {
		if (objects.length === 0) return;

		if (
			!confirm(
				`Are you sure you want to delete ${objects.length} item${objects.length !== 1 ? 's' : ''}?`
			)
		) {
			return;
		}

		const { dismiss } = toast.loading(`Deleting ${objects.length} items...`);
		let success = true;
		let failedCount = 0;

		try {
			for (const obj of objects) {
				try {
					await deleteObject(obj.key!);
				} catch (err) {
					success = false;
					failedCount++;
					console.error(`Failed to delete ${obj.key}:`, err);
				}
			}

			if (success) {
				toast.success(`Deleted ${objects.length} items`);
			} else {
				toast.error(`${failedCount} item${failedCount !== 1 ? 's' : ''} could not be deleted`);
			}

			await loadObjects(currentPrefix);
		} catch (err) {
			toast.error('Failed to delete items');
			console.error(err);
		} finally {
			dismiss();
		}
	}

	function handleSelectAll() {
		if (objects.length > 0) {
			// We need to use objects here since sortedObjects is a component-internal variable
			fileListSelectedObjects = new Set(objects.map((obj) => obj.key!));
		}
	}

	function handleDeselectAll() {
		fileListSelectedObjects = new Set();
	}

	function handleBatchDelete() {
		if (fileListSelectedObjects.size === 0) return;

		const selectedItems = objects.filter((obj) => fileListSelectedObjects.has(obj.key!));
		handleMultipleObjectsDelete(selectedItems);
		fileListSelectedObjects = new Set();
	}

	function handleMultipleObjectsDrag(objects: R2Object[]) {
		draggedObjects = objects;
	}

	async function handleDeploy() {
		const { dismiss } = toast.loading('Starting deployment...');

		try {
			const result = await deployCommand();
			dismiss();

			if (result.success) {
				toast.success(result.message || 'Deployment started successfully');
			} else {
				toast.error('Failed to start deployment');
			}
		} catch (err) {
			dismiss();
			console.error('Deploy error:', err);
			toast.error('Failed to start deployment');
		}
	}

	// Add global event listener for keyboard shortcuts
	onMount(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			// Check if we're not in an input field or textarea
			const target = event.target as HTMLElement;
			if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
				return;
			}

			// Select all items with Ctrl+A
			if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
				event.preventDefault();
				handleSelectAll();
			}
			// Deselect all items with Escape key
			else if (event.key === 'Escape') {
				// Only prevent default if we actually have something selected
				if (fileListSelectedObjects.size > 0) {
					event.preventDefault();
				}
				handleDeselectAll();
			}
		};

		window.addEventListener('keydown', handleKeyDown);

		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="font-fira relative z-10 flex h-screen w-full flex-col gap-3 text-zinc-100"
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
>
	<div class="glass-panel mx-4 mt-4 flex h-16 items-center justify-between p-4">
		<div class="font-anta pr-2 text-2xl !font-bold text-zinc-100 italic">HALP/CDN</div>
		<div class="flex items-center gap-3">
			<NewFolderInput
				{showNewFolderInput}
				bind:newFolderName
				onCreateFolder={createNewFolder}
				onShowNewFolderInputChange={(show) => (showNewFolderInput = show)}
				onNewFolderNameChange={(name) => (newFolderName = name)}
			/>
			<button
				class="btn-circle group"
				onclick={() => (showNewFolderInput = true)}
				title="New Folder"
			>
				<Fa icon={faFolderPlus} class="transition-transform group-hover:scale-110" />
			</button>
			<button
				class="btn-circle group"
				onclick={() => (showCreateUploadLinkModal = true)}
				title="Create Upload Link"
			>
				<Fa icon={faLink} class="transition-transform group-hover:scale-110" />
			</button>
			<a href="/api-keys" class="btn-circle group" title="Manage API Keys">
				<Fa icon={faKey} class="transition-transform group-hover:scale-110" />
			</a>
			<label class="btn-circle group" title="Upload Files">
				<Fa icon={faUpload} class="transition-transform group-hover:scale-110" />
				<input type="file" onchange={handleFileUpload} class="hidden" multiple />
			</label>
			<label class="btn-circle group" title="Upload Folder">
				<Fa icon={faFolder} class="transition-transform group-hover:scale-110" />
				<input
					type="file"
					onchange={handleDirectoryUpload}
					class="hidden"
					webkitdirectory={true}
					multiple
				/>
			</label>

			<button class="btn-circle group" onclick={handleDeploy} title="Deploy">
				<Fa icon={faRocket} class="text-green-400 transition-transform group-hover:scale-110" />
			</button>

			<form method="post" action="/logout" class="inline">
				<button type="submit" class="btn-circle group" title="Logout">
					<Fa icon={faSignOutAlt} class="text-red-400 transition-transform group-hover:scale-110" />
				</button>
			</form>
		</div>
	</div>

	<Breadcrumbs
		{currentPrefix}
		{dragTarget}
		{draggedObject}
		selectedObjects={fileListSelectedObjects}
		onBreadcrumbClick={(prefix) => handleBreadcrumbClick(prefix)}
		onBreadcrumbDrop={(event, prefix) => handleBreadcrumbDrop({ event, prefix })}
		onDragTargetChange={(target) => (dragTarget = target)}
		onDeselectAll={handleDeselectAll}
		onBatchDelete={handleBatchDelete}
	/>

	<UploadProgress {uploadFiles} />

	<UploadLinksPanel bind:this={uploadLinksPanel} />

	<div class="glass-panel relative mx-4 mb-4 flex flex-1 overflow-hidden">
		<!-- File list panel -->
		<div
			style="width: {showFileViewer ? `${100 - panelWidth}%` : '100%'}"
			class="h-full overflow-auto"
		>
			<FileList
				{objects}
				{isLoading}
				{currentPrefix}
				{dragTarget}
				{draggedObject}
				bind:fileListRef
				bind:selectedObjects={fileListSelectedObjects}
				onObjectClick={(object) => handleObjectClick(object)}
				onFolderDrop={(event, key) => handleFolderDrop({ event, key })}
				onFolderUpload={(key) => handleFolderUpload(key)}
				onDownloadObject={(object) => handleDownloadObject(object)}
				onCopyLink={(object) => handleCopyLink(object)}
				onDeleteObject={(object) => handleDeleteObject(object, () => loadObjects(currentPrefix))}
				onDragTargetChange={(target) => (dragTarget = target)}
				onDraggedObjectChange={(object) => (draggedObject = object)}
				onMultipleObjectsDelete={(objects) => handleMultipleObjectsDelete(objects)}
				onMultipleObjectsDrag={(objects) => handleMultipleObjectsDrag(objects)}
			/>
		</div>

		{#if showFileViewer}
			<div
				class="w-1 cursor-col-resize bg-zinc-800 transition-colors duration-200 hover:bg-zinc-700"
				onmousedown={handleResizeStart}
			></div>
		{/if}

		<!-- File viewer panel -->
		{#if showFileViewer && selectedObject}
			<div
				class="overflow-hidden border-l border-zinc-800 bg-zinc-900"
				style="width: {panelWidth}%"
			>
				<FileViewer object={selectedObject} onClose={closeFileViewer} />
			</div>
		{/if}
	</div>
</div>

<CreateUploadLinkModal
	bind:show={showCreateUploadLinkModal}
	{currentPrefix}
	onLinkCreated={() => uploadLinksPanel?.refreshLinks()}
/>
