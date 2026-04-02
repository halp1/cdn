<script lang="ts">
	import type { ApiKeyPermission } from '$lib/db/types';
	import { createApiKeyCommand } from '$lib/api/api-keys.remote';

	interface Props {
		onclose: () => void;
		onCreated: () => void;
	}

	let { onclose, onCreated }: Props = $props();

	let name = $state('');
	let selectedPermissions = $state<Set<ApiKeyPermission>>(new Set());
	let paths = $state<string[]>(['']);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let newApiKey = $state<string | null>(null);
	let showKey = $state(false);

	const availablePermissions: ApiKeyPermission[] = ['read', 'write', 'delete', 'list'];

	function togglePermission(permission: ApiKeyPermission) {
		const newSet = new Set(selectedPermissions);
		if (newSet.has(permission)) {
			newSet.delete(permission);
		} else {
			newSet.add(permission);
		}
		selectedPermissions = newSet;
	}

	function addPath() {
		paths = [...paths, ''];
	}

	function removePath(index: number) {
		paths = paths.filter((_, i) => i !== index);
	}

	function updatePath(index: number, value: string) {
		paths = paths.map((path, i) => (i === index ? value : path));
	}

	async function createApiKey() {
		if (!name.trim()) {
			error = 'Name is required';
			return;
		}

		if (selectedPermissions.size === 0) {
			error = 'At least one permission is required';
			return;
		}

		const validPaths = paths.filter((p) => p.trim());
		if (validPaths.length === 0) {
			error = 'At least one path is required';
			return;
		}

		try {
			loading = true;
			error = null;

			const result = await createApiKeyCommand({
				name: name.trim(),
				permissions: Array.from(selectedPermissions),
				scopedPaths: validPaths.map((p) => p.trim())
			});

			newApiKey = result.key ?? null;
			showKey = true;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create API key';
			console.error('Error creating API key:', err);
		} finally {
			loading = false;
		}
	}

	function copyToClipboard() {
		if (newApiKey) {
			navigator.clipboard
				.writeText(newApiKey)
				.then(() => {
					// Could show a temporary success message here
				})
				.catch((err) => {
					console.error('Failed to copy to clipboard:', err);
				});
		}
	}

	function handleClose() {
		if (showKey) {
			onCreated();
		}
		onclose();
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onclick={handleClose}>
	<div
		class="glass-panel mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto"
		onclick={(e) => e.stopPropagation()}
	>
		<div class="flex items-center justify-between border-b border-zinc-800 p-6">
			<h2 class="text-2xl font-semibold text-zinc-100">
				{showKey ? 'API Key Created' : 'Create API Key'}
			</h2>
			<button
				class="text-2xl text-zinc-500 transition-colors hover:text-zinc-100"
				onclick={handleClose}
			>
				×
			</button>
		</div>

		{#if showKey && newApiKey}
			<div class="p-6">
				<div class="text-center">
					<p class="mb-4 text-zinc-100">
						<strong>Your API key has been created successfully!</strong>
					</p>
					<div class="mb-4 rounded-lg border border-yellow-600 bg-zinc-900 p-4 text-yellow-300">
						⚠️ This is the only time you'll see this key. Make sure to copy and store it securely.
					</div>

					<div class="mb-6 flex items-center gap-3 rounded-lg bg-zinc-900 p-4">
						<code class="glass-input flex-1 font-mono text-sm break-all">{newApiKey}</code>
						<button class="btn" onclick={copyToClipboard}>Copy</button>
					</div>

					<div class="text-left">
						<h4 class="mb-2 text-lg font-medium text-zinc-100">Usage:</h4>
						<p class="mb-3 text-zinc-400">Use this API key in the Authorization header:</p>
						<code class="glass-input mb-4 block font-mono text-sm break-all">
							Authorization: Bearer {newApiKey}
						</code>

						<h4 class="mb-2 text-lg font-medium text-zinc-100">API Endpoints:</h4>
						<ul class="space-y-1 pl-6 text-zinc-400">
							<li><code class="text-blue-300">POST /api/v1/upload</code> - Upload files</li>
							<li>
								<code class="text-blue-300">GET /api/v1/list?path=/folder</code> - List objects
							</li>
							<li>
								<code class="text-blue-300">GET /api/v1/download?key=file.jpg</code> - Get download URL
							</li>
							<li><code class="text-blue-300">DELETE /api/v1/delete</code> - Delete objects</li>
						</ul>
					</div>
				</div>
			</div>

			<div class="flex justify-end gap-3 border-t border-zinc-800 p-6">
				<button class="btn" onclick={handleClose}>Close</button>
			</div>
		{:else}
			<div class="p-6">
				{#if error}
					<div class="mb-4 rounded-lg border border-red-600 bg-zinc-900 p-4 text-red-300">
						{error}
					</div>
				{/if}

				<div class="mb-6">
					<label for="name" class="mb-2 block text-sm font-medium text-zinc-100">Name</label>
					<input
						id="name"
						type="text"
						bind:value={name}
						placeholder="e.g., My Project API Key"
						class="glass-input w-full"
					/>
				</div>

				<div class="mb-6">
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label class="mb-3 block text-sm font-medium text-zinc-100">Permissions</label>
					<div class="grid grid-cols-2 gap-3 md:grid-cols-4">
						{#each availablePermissions as permission}
							<label
								class="flex cursor-pointer items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 p-3 transition-colors hover:bg-zinc-800"
							>
								<input
									type="checkbox"
									checked={selectedPermissions.has(permission)}
									onchange={() => togglePermission(permission)}
									class="rounded border-zinc-700 bg-zinc-900 text-blue-500 focus:ring-2 focus:ring-blue-600"
								/>
								<span class="text-sm text-zinc-100 capitalize">{permission}</span>
							</label>
						{/each}
					</div>
				</div>

				<div class="mb-6">
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label class="mb-3 block text-sm font-medium text-zinc-100">Scoped Paths</label>
					<div class="space-y-3">
						{#each paths as path, index}
							<div class="flex items-center gap-2">
								<input
									type="text"
									value={path}
									oninput={(e) => updatePath(index, e.currentTarget.value)}
									placeholder="/path/to/folder"
									class="glass-input flex-1"
								/>
								{#if paths.length > 1}
									<button
										type="button"
										class="btn btn-danger px-3 py-2 text-sm"
										onclick={() => removePath(index)}
									>
										Remove
									</button>
								{/if}
							</div>
						{/each}
						<button type="button" class="btn" onclick={addPath}> Add Path </button>
					</div>
					<div class="mt-2 text-sm text-zinc-500">
						Specify the folder paths this API key can access. Use "/" for root access.
					</div>
				</div>
			</div>

			<div class="flex justify-end gap-3 border-t border-zinc-800 p-6">
				<button class="btn" onclick={onclose} disabled={loading}> Cancel </button>
				<button class="btn" onclick={createApiKey} disabled={loading}>
					{loading ? 'Creating...' : 'Create API Key'}
				</button>
			</div>
		{/if}
	</div>
</div>
