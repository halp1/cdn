<script lang="ts">
	import Fa from 'svelte-fa';
	import { getFileIcon } from '$lib/file-icons';

	type UploadFile = {
		file: File;
		progress: number;
		isUploading: boolean;
		abort: () => void;
	};

	interface Props {
		uploadFiles: UploadFile[];
	}

	const { uploadFiles }: Props = $props();

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
</script>

{#if uploadFiles.length > 0}
	<div class="glass-panel mx-4 mb-4 space-y-3 p-4">
		<h3 class="mb-3 text-lg font-semibold text-zinc-100">Uploading Files</h3>
		{#each uploadFiles as uploadFile}
			{@const fileIconData = getFileIcon(uploadFile.file.name)}
			<div class="glass-panel relative overflow-hidden p-3">
				<div class="relative z-10 flex items-center justify-between">
					<div class="flex items-center gap-3">
						<Fa icon={fileIconData.icon} class="{fileIconData.color} text-lg" />
						<div class="flex flex-col">
							<span class="font-medium text-zinc-100">{uploadFile.file.name}</span>
							<span class="text-sm text-zinc-500">{formatSize(uploadFile.file.size)}</span>
						</div>
					</div>
					<div class="text-right">
						<div class="text-sm font-semibold text-zinc-100">{uploadFile.progress}%</div>
						{#if uploadFile.isUploading}
							<div
								class="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-200"
							></div>
						{/if}
					</div>
				</div>
				<div class="mt-3 h-2 w-full overflow-hidden rounded bg-zinc-800">
					<div
						class="h-full bg-blue-600 transition-all duration-300"
						style="width: {uploadFile.progress}%"
					></div>
				</div>
			</div>
		{/each}
	</div>
{/if}
