<script lang="ts">
	import { onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import type { R2Object } from '$lib/r2';
	import Fa from 'svelte-fa';
	import { faTimes, faDownload } from '@fortawesome/free-solid-svg-icons';
	// Lazy import for Monaco editor to avoid SSR issues
	import type * as monaco from 'monaco-editor';

	const { object, onClose } = $props<{
		object: R2Object | null;
		onClose: () => void;
	}>();

	let isLoading = $state(false);
	let loadProgress = $state(0);
	let fileContent = $state<string | ArrayBuffer | null>(null);
	let fileType = $state('');
	let mimeType = $state('');
	let fileUrl = $state('');
	let viewerElement = $state<HTMLDivElement>(null as any);
	let monacoEditor: monaco.editor.IStandaloneCodeEditor | null = null;
	// Flag to track if Monaco editor is loaded
	let monacoLoaded = $state(false);
	let abort = $state<AbortController | null>(null);

	$effect(() => {
		if (object) {
			loadFile();
		}
	});

	onDestroy(() => {
		if (browser && monacoEditor) {
			monacoEditor.dispose();
		}
		if (fileUrl) {
			URL.revokeObjectURL(fileUrl);
		}
		if (abort) {
			abort.abort();
		}
	});

	async function loadFile() {
		if (!object || !object.key) return;

		isLoading = true;
		loadProgress = 0;
		fileContent = null;
		fileType = '';
		fileUrl = '';

		if (monacoEditor) {
			monacoEditor.dispose();
			monacoEditor = null;
		}

		const fileName = object.key.split('/').pop() || '';
		const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';

		const controller = new AbortController();
		const { signal } = controller;
		abort = controller;

		try {
			const response = await fetch(`/api/r2/download?key=${encodeURIComponent(object.key)}`, {
				method: 'GET',
				signal
			}).catch(() => {});

			if (!response?.ok) {
				if (!response?.statusText) return;
				throw new Error(`Failed to load file: ${response?.statusText}`);
			}

			const contentType = response.headers.get('content-type') || '';
			mimeType = contentType;

			const reader = response.body?.getReader();
			if (!reader) throw new Error('Unable to read the file');

			if (contentType.startsWith('video/')) {
				fileType = 'video';
				fileUrl = `/obj/${encodeURIComponent(object.key)}`;
				try {
					await reader.cancel();
				} catch {}
				isLoading = false;
				return;
			}

			const contentLength = Number(response.headers.get('content-length')) || 0;
			let receivedLength = 0;
			const chunks = [] as Uint8Array[];

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				chunks.push(value);
				receivedLength += value.length;
				if (contentLength) {
					loadProgress = Math.round((receivedLength / contentLength) * 100);
				}
			}

			const allChunks = new Uint8Array(receivedLength);
			let position = 0;
			for (const chunk of chunks) {
				allChunks.set(chunk, position);
				position += chunk.length;
			}

			if (contentType.startsWith('image/')) {
				const blob = new Blob([allChunks], { type: contentType });
				fileUrl = URL.createObjectURL(blob);
				fileType = 'image';
			} else if (contentType.startsWith('audio/')) {
				const blob = new Blob([allChunks], { type: contentType });
				fileUrl = URL.createObjectURL(blob);
				fileType = 'audio';
			} else {
				const text = new TextDecoder().decode(allChunks);
				fileContent = text;
				fileType = 'text';
				if (browser) {
					setTimeout(() => {
						if (viewerElement && fileContent) {
							initMonacoEditor(fileContent.toString(), fileExtension);
						}
					}, 0);
				}
			}
		} catch (err) {
			console.error('Error loading file:', err);
			fileContent = 'Error loading file';
			fileType = 'error';
		} finally {
			isLoading = false;
		}
	}

	function initMonacoEditor(content: string, fileExtension: string) {
		if (!browser) return;

		// Dynamically import Monaco editor only on the client side
		import('monaco-editor')
			.then((monaco) => {
				monacoLoaded = true;

				// Map file extensions to Monaco language IDs
				const languageMap: Record<string, string> = {
					js: 'javascript',
					ts: 'typescript',
					html: 'html',
					css: 'css',
					json: 'json',
					md: 'markdown',
					py: 'python',
					sh: 'shell',
					svelte: 'html', // Default to HTML for Svelte
					txt: 'plaintext'
				};

				const language = languageMap[fileExtension] || 'plaintext';

				monacoEditor = monaco.editor.create(viewerElement, {
					value: content,
					language: language,
					theme: 'vs-dark',
					readOnly: true,
					minimap: { enabled: true },
					scrollBeyondLastLine: false,
					automaticLayout: true
				});
			})
			.catch((err) => {
				console.error('Failed to load Monaco editor:', err);
			});
	}

	function handleDownload() {
		if (object && object.key) {
			window.open(`/api/r2/download?key=${encodeURIComponent(object.key)}`, '_blank');
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="flex h-full flex-col overflow-hidden">
	<div class="glass-panel m-4 mb-0 flex items-center justify-between p-4">
		<div class="truncate text-lg font-semibold text-zinc-100">
			{object ? object.key?.split('/').pop() || 'File Viewer' : 'File Viewer'}
		</div>
		<div class="flex gap-2">
			<button class="btn-circle group" onclick={handleDownload} title="Download">
				<Fa icon={faDownload} class="text-purple-400 transition-transform group-hover:scale-110" />
			</button>
			<button class="btn-circle group" onclick={onClose} title="Close">
				<Fa icon={faTimes} class="text-red-400 transition-transform group-hover:scale-110" />
			</button>
		</div>
	</div>

	{#if isLoading}
		<div class="flex flex-1 flex-col items-center justify-center p-8">
			<div class="glass-panel p-6 text-center">
				<div class="mb-6 text-lg text-zinc-100">Loading file...</div>
				<div class="relative w-full max-w-md">
					<div class="h-3 w-full overflow-hidden rounded-full border border-zinc-800 bg-zinc-900">
						<div class="h-full bg-blue-600" style="width: {loadProgress}%"></div>
					</div>
					<div class="mt-2 text-sm text-zinc-400">{loadProgress}%</div>
				</div>
			</div>
		</div>
	{:else if fileType === 'image'}
		<div class="flex flex-1 items-center justify-center overflow-auto p-4">
			<div class="glass-panel p-4">
				<img
					src={fileUrl}
					alt="File preview"
					class="max-h-full max-w-full rounded-lg object-contain"
				/>
			</div>
		</div>
	{:else if fileType === 'video'}
		<div class="flex flex-1 items-center justify-center p-4">
			<div class="glass-panel p-4">
				<!-- svelte-ignore a11y_media_has_caption -->
				<video controls autoplay class="max-h-full max-w-full rounded-lg">
					<source src={fileUrl} type={mimeType} />
					Your browser does not support the video tag.
				</video>
			</div>
		</div>
	{:else if fileType === 'audio'}
		<div class="flex flex-1 items-center justify-center p-4">
			<div class="glass-panel p-6">
				<audio controls class="w-full">
					<source src={fileUrl} type={mimeType} />
					Your browser does not support the audio tag.
				</audio>
			</div>
		</div>
	{:else if fileType === 'text'}
		<div class="glass-panel m-4 mt-0 flex-1 overflow-auto" bind:this={viewerElement}>
			{#if !monacoLoaded && fileContent}
				<pre class="p-4 font-mono text-sm text-zinc-200">{fileContent}</pre>
			{/if}
		</div>
	{:else if fileType === 'error'}
		<div class="flex flex-1 items-center justify-center p-4">
			<div class="glass-panel p-6 text-center text-red-400">
				{fileContent}
			</div>
		</div>
	{:else}
		<div class="flex flex-1 items-center justify-center p-4">
			<div class="glass-panel p-6 text-center text-zinc-300">
				<div class="mb-2 text-lg">No preview available</div>
				<div class="text-sm text-zinc-500">This file type cannot be previewed</div>
			</div>
		</div>
	{/if}
</div>
