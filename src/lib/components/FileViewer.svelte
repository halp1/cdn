<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { X, ExternalLink, Download, Loader } from 'lucide-svelte';
	import type { R2Object } from '$lib/r2-server';
	import { formatFileSize } from '$lib/utils';
	import { getDownloadUrl } from '$lib/api/r2.remote';

	interface Props {
		obj: R2Object | null;
		r2Url: string;
		onClose: () => void;
	}

	let { obj, r2Url, onClose }: Props = $props();

	let loading = $state(false);
	let error = $state('');
	let textContent = $state('');
	let downloadUrl = $state('');
	let abortController = $state<AbortController | null>(null);

	const getExt = (key: string) => key.split('.').pop()?.toLowerCase() ?? '';

	const getType = (key: string): 'image' | 'video' | 'text' | 'binary' => {
		const ext = getExt(key);
		if (['png', 'jpg', 'jpeg', 'jfif', 'gif', 'webp', 'svg', 'ico'].includes(ext)) return 'image';
		if (['mp4', 'mov', 'webm', 'avi'].includes(ext)) return 'video';
		if (
			[
				'txt',
				'md',
				'json',
				'js',
				'ts',
				'css',
				'html',
				'sh',
				'py',
				'rs',
				'go',
				'csv',
				'log',
				'xml',
				'yaml',
				'yml'
			].includes(ext)
		)
			return 'text';
		return 'binary';
	};

	const publicUrl = $derived(() => (obj ? `${r2Url}/${obj.key}` : ''));
	const fileType = $derived(() => (obj ? getType(obj.key) : 'binary'));

	$effect(() => {
		if (!obj) {
			textContent = '';
			downloadUrl = '';
			error = '';
			return;
		}
		textContent = '';
		error = '';
		downloadUrl = '';

		if (fileType() === 'text') {
			loading = true;
			abortController?.abort();
			const ctrl = new AbortController();
			abortController = ctrl;

			fetch(`/obj/${obj.key}`, { signal: ctrl.signal })
				.then((r) => r.text())
				.then((t) => {
					textContent = t;
				})
				.catch((e) => {
					if (e.name !== 'AbortError') error = 'Failed to load file';
				})
				.finally(() => {
					loading = false;
				});
		} else if (fileType() === 'binary') {
			getDownloadUrl({ key: obj.key }).then((r) => {
				downloadUrl = r.url;
			});
		}

		return () => {
			abortController?.abort();
		};
	});
</script>

<div class="flex h-full flex-col overflow-hidden">
	{#if !obj}
		<div
			class="flex flex-1 items-center justify-center text-[11px] tracking-widest text-(--border) uppercase"
		>
			<span>Select a file to preview</span>
		</div>
	{:else}
		<div class="flex h-9 shrink-0 items-center gap-2 border-b border-(--border) px-3">
			<span class="flex-1 truncate text-[11px] text-(--text)" title={obj.key}
				>{obj.key.split('/').pop()}</span
			>
			<div class="flex shrink-0 items-center gap-0.5">
				{#if obj.size}
					<span class="mr-1 text-[10px] text-(--muted)">{formatFileSize(obj.size)}</span>
				{/if}
				<a
					href={publicUrl()}
					target="_blank"
					rel="noopener noreferrer"
					class="flex cursor-pointer items-center border-none bg-transparent p-1.25 text-(--muted) no-underline transition-colors hover:text-(--text)"
					title="Open in new tab"
				>
					<ExternalLink size={13} />
				</a>
				<button
					class="flex cursor-pointer items-center border-none bg-transparent p-1.25 text-(--muted) transition-colors hover:text-(--text)"
					onclick={onClose}
					title="Close"
				>
					<X size={13} />
				</button>
			</div>
		</div>

		<div
			class="min-h-0 flex-1 overflow-auto [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-(--border) [&::-webkit-scrollbar-track]:bg-transparent"
		>
			{#if loading}
				<div
					class="flex h-37.5 flex-col items-center justify-center gap-3 text-[12px] text-(--muted)"
				>
					<Loader size={18} class="spin" />
				</div>
			{:else if error}
				<div
					class="flex h-37.5 flex-col items-center justify-center gap-3 text-[12px] text-[#ff8080]"
				>
					{error}
				</div>
			{:else if fileType() === 'image'}
				<div class="flex min-h-25 items-center justify-center p-4">
					<img src={publicUrl()} alt={obj.key} class="block max-h-100 max-w-full object-contain" />
				</div>
			{:else if fileType() === 'video'}
				<video class="block max-h-100 w-full bg-black" controls>
					<source src={publicUrl()} />
					<track kind="captions" />
				</video>
			{:else if fileType() === 'text'}
				<pre
					class="m-0 p-3 font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap text-(--text)">{textContent}</pre>
			{:else}
				<div
					class="flex h-37.5 flex-col items-center justify-center gap-3 text-[12px] text-(--muted)"
				>
					<Download size={24} />
					<span>Binary file</span>
					{#if downloadUrl}
						<a
							href={downloadUrl}
							class="inline-block bg-(--accent) px-4 py-2 font-mono text-[11px] font-medium tracking-widest text-bg uppercase no-underline transition-opacity hover:opacity-[0.88]"
							download>Download</a
						>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>
