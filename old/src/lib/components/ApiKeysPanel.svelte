<script lang="ts">
	import CreateApiKeyModal from './CreateApiKeyModal.svelte';
	import { getApiKeys, deleteApiKeyCommand } from '$lib/api/api-keys.remote';
	import type { ApiKeyPermission } from '$lib/db/types';

	interface ApiKeyDisplay {
		id: number;
		name: string;
		permissions: ApiKeyPermission[];
		scoped_paths: string[];
		created_at: string;
		last_used_at?: string;
		is_active: boolean;
		key_preview: string;
	}

	let showCreateModal = $state(false);

	async function deleteApiKey(id: number, permanent: boolean = false) {
		if (
			!confirm(
				`Are you sure you want to ${permanent ? 'permanently delete' : 'deactivate'} this API key?`
			)
		) {
			return;
		}

		try {
			await deleteApiKeyCommand({ id, permanent });
		} catch (err) {
			alert('Error deleting API key: ' + (err instanceof Error ? err.message : String(err)));
			console.error('Error deleting API key:', err);
		}
	}

	function formatDate(timestamp: string): string {
		return new Date(parseInt(timestamp) * 1000).toLocaleString();
	}

	function onApiKeyCreated() {
		showCreateModal = false;
	}
</script>

<div class="p-6">
	<div class="mb-6 flex items-center justify-between">
		<h3 class="text-2xl font-semibold text-zinc-100">API Keys</h3>
		<button class="btn" onclick={() => (showCreateModal = true)}> Create API Key </button>
	</div>

	{#await getApiKeys()}
		<div class="glass-panel p-8 text-center">
			<div class="text-zinc-400">Loading API keys...</div>
		</div>
	{:then data}
		{#if data.apiKeys.length === 0}
			<div class="glass-panel p-12 text-center">
				<div class="mb-4 text-zinc-400">
					<p>No API keys found.</p>
				</div>
				<button class="btn" onclick={() => (showCreateModal = true)}>
					Create your first API key
				</button>
			</div>
		{:else}
			<div class="space-y-4">
				{#each data.apiKeys as apiKey (apiKey.id)}
					<div class="glass-panel p-6">
					<div class="mb-4 flex items-center justify-between">
						<h4 class="text-lg font-medium text-zinc-100">{apiKey.name}</h4>
						<div class="flex gap-2">
							<button
								class="btn btn-warning px-3 py-1 text-sm"
								onclick={() => deleteApiKey(apiKey.id, false)}
								title="Deactivate API key"
							>
								Deactivate
							</button>
							<button
								class="btn btn-danger px-3 py-1 text-sm"
								onclick={() => deleteApiKey(apiKey.id, true)}
								title="Delete API key permanently"
							>
								Delete
							</button>
						</div>
					</div>

					<div class="space-y-3">
						<div class="flex flex-wrap items-start gap-2">
							<span class="min-w-fit text-sm font-medium text-zinc-400">Key:</span>
							<code class="glass-input font-mono text-sm">{apiKey.key_preview}</code>
						</div>

						<div class="flex flex-wrap items-start gap-2">
							<span class="min-w-fit text-sm font-medium text-zinc-400">Permissions:</span>
							<div class="flex flex-wrap gap-1">
								{#each apiKey.permissions as permission}
									<span
										class="rounded-md border border-blue-700 bg-zinc-900 px-2 py-1 text-xs font-medium text-blue-300"
									>
										{permission}
									</span>
								{/each}
							</div>
						</div>

						<div class="flex flex-wrap items-start gap-2">
							<span class="min-w-fit text-sm font-medium text-zinc-400">Scoped Paths:</span>
							<div class="flex flex-wrap gap-1">
								{#each apiKey.scoped_paths as path}
									<code
										class="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-300"
									>
										{path}
									</code>
								{/each}
							</div>
						</div>

						<div class="flex flex-wrap items-start gap-2">
							<span class="min-w-fit text-sm font-medium text-zinc-400">Created:</span>
							<span class="text-sm text-zinc-400">{formatDate(apiKey.created_at)}</span>
						</div>

						{#if apiKey.last_used_at}
							<div class="flex flex-wrap items-start gap-2">
								<span class="min-w-fit text-sm font-medium text-zinc-400">Last Used:</span>
								<span class="text-sm text-zinc-400">{formatDate(apiKey.last_used_at)}</span>
							</div>
						{/if}
					</div>
				</div>
				{/each}
			</div>
		{/if}
	{:catch error}
		<div class="glass-panel p-8 text-center">
			<div class="mb-4 text-red-400">Error: {error.message || 'Failed to load API keys'}</div>
			<button class="btn" onclick={() => getApiKeys().refresh()}>Retry</button>
		</div>
	{/await}
</div>

{#if showCreateModal}
	<CreateApiKeyModal onclose={() => (showCreateModal = false)} onCreated={onApiKeyCreated} />
{/if}
