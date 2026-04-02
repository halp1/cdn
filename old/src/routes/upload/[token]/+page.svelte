<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from '$lib/toast';
	import { getPresignedUploadUrl, confirmUpload } from '$lib/api/upload.remote';
	import Fa from 'svelte-fa';
	import { faUpload, faFile, faTrash, faCheck, faCopy } from '@fortawesome/free-solid-svg-icons';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let files = $state<File[]>([]);
	let isDragging = $state(false);
	let isUploading = $state(false);
	let uploadProgress = $state<Record<string, number>>({});
	let uploadComplete = $state(false);
	let uploadedFiles = $state<Array<{ key: string; name: string }>>([]);
	let remainingUploads = $state((data as any).remainingUploads ?? 1);

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			const newFiles = Array.from(input.files).slice(0, remainingUploads);
			files = [...files, ...newFiles].slice(0, remainingUploads);
			if (input.files.length > remainingUploads) {
				toast.error(`Only ${remainingUploads} upload(s) remaining`);
			}
		}
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;

		if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
			const newFiles = Array.from(event.dataTransfer.files).slice(0, remainingUploads);
			files = [...files, ...newFiles].slice(0, remainingUploads);
			if (event.dataTransfer.files.length > remainingUploads) {
				toast.error(`Only ${remainingUploads} upload(s) remaining`);
			}
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragging = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
	}

	function removeFile(index: number) {
		files = files.filter((_, i) => i !== index);
	}

	async function uploadFiles() {
		if (files.length === 0) return;
		if (files.length > remainingUploads) {
			toast.error(`Only ${remainingUploads} upload(s) allowed`);
			return;
		}

		isUploading = true;
		uploadProgress = {};
		const uploadPromises: Promise<void>[] = [];

		for (const file of files) {
			uploadPromises.push(uploadSingleFile(file));
		}

		try {
			await Promise.all(uploadPromises);
			uploadComplete = true;
		} catch (error) {
			console.error('Upload error:', error);
		} finally {
			isUploading = false;
		}
	}

	async function uploadSingleFile(file: File) {
		try {
			const presignedData = await getPresignedUploadUrl({
				token: data.token,
				filename: file.name,
				fileType: file.type
			});

			await new Promise<void>((resolve, reject) => {
				const xhr = new XMLHttpRequest();

				xhr.upload.addEventListener('progress', (event) => {
					if (event.lengthComputable) {
						uploadProgress = {
							...uploadProgress,
							[file.name]: Math.round((event.loaded / event.total) * 100)
						};
					}
				});

				xhr.addEventListener('load', async () => {
					if (xhr.status === 200) {
						try {
							const result = await confirmUpload({
								token: data.token,
								fileKey: presignedData.fileKey
							});

							uploadedFiles = [
								...uploadedFiles,
								{ key: presignedData.fileKey, name: presignedData.sanitizedName }
							];

							if (result.remaining !== undefined) {
								remainingUploads = result.remaining;
							} else {
								remainingUploads = 0;
							}

							if (presignedData.originalName !== presignedData.sanitizedName) {
								toast.success(`${file.name} uploaded as "${presignedData.sanitizedName}"`);
							} else {
								toast.success(`${file.name} uploaded successfully!`);
							}
							resolve();
						} catch (error) {
							toast.error(`Upload succeeded but failed to confirm: ${file.name}`);
							reject(error);
						}
					} else {
						toast.error(`Failed to upload ${file.name} to storage`);
						reject(new Error(`Upload failed with status ${xhr.status}`));
					}
				});

				xhr.addEventListener('error', () => {
					toast.error(`Upload failed for ${file.name}`);
					reject(new Error('Upload failed'));
				});

				xhr.open('PUT', presignedData.uploadUrl);
				xhr.setRequestHeader('Content-Type', file.type);
				xhr.send(file);
			});
		} catch (error) {
			console.error('Upload error for', file.name, error);
			throw error;
		}
	}

	function formatExpiryTime(timestamp: number) {
		const now = Math.floor(Date.now() / 1000);
		const expiresAt = timestamp;
		const timeLeft = expiresAt - now;

		if (timeLeft <= 0) {
			return 'Expired';
		}

		const hours = Math.floor(timeLeft / 3600);
		const minutes = Math.floor((timeLeft % 3600) / 60);

		if (hours > 0) {
			return `${hours}h ${minutes}m remaining`;
		} else {
			return `${minutes}m remaining`;
		}
	}

	function getFileUrl(fileKey: string) {
		const baseUrl = window.location.origin;
		return `${baseUrl}/obj/${fileKey}`;
	}

	async function copyFileLink(fileKey: string) {
		try {
			const fileUrl = getFileUrl(fileKey);
			await navigator.clipboard.writeText(fileUrl);
			toast.success('File link copied to clipboard!');
		} catch (error) {
			console.error('Failed to copy link:', error);
			toast.error('Failed to copy link to clipboard');
		}
	}

	function getOverallProgress() {
		if (Object.keys(uploadProgress).length === 0) return 0;
		const total = Object.values(uploadProgress).reduce((sum, val) => sum + val, 0);
		return Math.round(total / files.length);
	}
</script>

<div class="relative min-h-screen font-mono text-zinc-100">
	<!-- Background decoration -->
	<div class="pointer-events-none absolute inset-0 overflow-hidden"></div>

	<div class="relative z-10 container mx-auto px-4 py-8">
		<div class="mx-auto max-w-2xl">
			<!-- Header -->
			<div class="glass-panel mb-8 p-6">
				<h1 class="mb-3 text-3xl font-bold text-zinc-100">File Upload</h1>
				<p class="mb-2 text-zinc-300">
					Upload files to: <span class="font-semibold text-zinc-100"
						>{data.targetPath || 'Root folder'}</span
					>
				</p>
				<div class="flex items-center gap-4 text-sm text-zinc-500">
					<span>Link expires: {formatExpiryTime(data.expiresAt)}</span>
					<span class="text-zinc-600">•</span>
					<span>
						{remainingUploads} / {(data as any).maxUploads ?? 1} upload{((data as any).maxUploads ??
							1) !== 1
							? 's'
							: ''} remaining
					</span>
				</div>
			</div>

			{#if uploadComplete}
				<div class="glass-panel p-8">
					<div
						class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900"
					>
						<Fa icon={faCheck} class="text-3xl text-green-400" />
					</div>
					<h2 class="mb-3 text-center text-2xl font-bold text-zinc-100">Upload Complete!</h2>
					<p class="mb-6 text-center text-zinc-300">
						{uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''} uploaded successfully
					</p>

					<div class="space-y-4">
						{#each uploadedFiles as file}
							<div class="glass-panel p-4">
								<p class="mb-3 font-mono text-sm font-medium text-zinc-100">{file.name}</p>
								<div
									class="mb-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3 font-mono text-xs break-all text-zinc-400"
								>
									{getFileUrl(file.key)}
								</div>
								<button
									onclick={() => copyFileLink(file.key)}
									class="btn btn-success flex w-full items-center justify-center gap-2 text-sm font-semibold"
								>
									<Fa icon={faCopy} />
									Copy Link
								</button>
							</div>
						{/each}
					</div>

					<p class="mt-6 text-center text-sm text-zinc-500">You can now close this page.</p>
				</div>
			{:else}
				<!-- Upload Interface -->
				<!-- Drag and Drop Zone -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="glass-panel border-dashed p-8 text-center transition-colors duration-200 {isDragging
						? 'border-blue-600 bg-zinc-900'
						: 'hover:border-zinc-700'}"
					ondrop={handleDrop}
					ondragover={handleDragOver}
					ondragleave={handleDragLeave}
				>
					<div
						class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900"
					>
						<Fa icon={faUpload} class="text-3xl text-blue-400" />
					</div>
					<p class="mb-2 text-lg text-zinc-100">
						Drag and drop {remainingUploads === 1 ? 'a file' : 'files'} here
					</p>
					<p class="mb-2 text-zinc-500">or</p>
					<label class="btn btn-primary inline-block cursor-pointer px-6 py-3 font-semibold">
						Choose {remainingUploads === 1 ? 'File' : 'Files'}
						<input
							type="file"
							class="hidden"
							onchange={handleFileSelect}
							multiple={remainingUploads > 1}
						/>
					</label>
					<p class="mt-4 text-sm text-zinc-500">
						{remainingUploads} upload{remainingUploads !== 1 ? 's' : ''} remaining
					</p>
				</div>

				{#if files.length > 0}
					<div class="mt-8">
						<h3 class="mb-4 text-xl font-semibold text-zinc-100">
							Selected {files.length === 1 ? 'File' : 'Files'} ({files.length})
						</h3>
						<div class="space-y-3">
							{#each files as file, index}
								<div
									class="glass-panel group flex items-center justify-between p-4 transition-colors duration-200 hover:bg-zinc-800"
								>
									<div class="flex items-center space-x-3">
										<Fa icon={faFile} class="text-green-400" />
										<div>
											<p class="font-medium text-zinc-100">{file.name}</p>
											<p class="text-sm text-zinc-500">
												{(file.size / 1024 / 1024).toFixed(2)} MB
											</p>
										</div>
									</div>
									<button
										onclick={() => removeFile(index)}
										class="btn-circle group/btn h-8! w-8!"
										disabled={isUploading}
										title="Remove file"
									>
										<Fa
											icon={faTrash}
											class="text-red-400 transition-transform group-hover/btn:scale-110"
										/>
									</button>
								</div>
							{/each}
						</div>

						{#if isUploading}
							<div class="glass-panel mt-6 p-4">
								<div class="mb-4 flex items-center justify-between text-sm">
									<span class="text-zinc-100"
										>Uploading {files.length} file{files.length !== 1 ? 's' : ''}...</span
									>
									<span class="font-semibold text-zinc-100">{getOverallProgress()}%</span>
								</div>

								<div class="space-y-3">
									{#each files as file}
										<div class="space-y-1">
											<div class="flex items-center justify-between text-xs">
												<span class="truncate text-zinc-300">{file.name}</span>
												<span class="text-zinc-400">{uploadProgress[file.name] || 0}%</span>
											</div>
											<div
												class="relative h-2 w-full overflow-hidden rounded-full border border-zinc-800 bg-zinc-900"
											>
												<div
													class="h-full bg-blue-600 transition-all duration-300"
													style="width: {uploadProgress[file.name] || 0}%"
												></div>
											</div>
										</div>
									{/each}
								</div>
							</div>
						{:else}
							<button
								onclick={uploadFiles}
								disabled={isUploading || files.length === 0 || files.length > remainingUploads}
								class="btn btn-primary mt-6 w-full py-4 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
							>
								Upload {files.length} File{files.length !== 1 ? 's' : ''}
							</button>
						{/if}
					</div>
				{/if}
			{/if}
		</div>
	</div>
</div>
