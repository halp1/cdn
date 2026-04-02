<script lang="ts">
	import { onMount } from 'svelte';
	import { getStorageStats, type R2StorageStats } from '$lib/r2';
	import { formatFileSize, formatNumber } from '$lib/utils';
	import Fa from 'svelte-fa';
	import { faDatabase, faRefresh } from '@fortawesome/free-solid-svg-icons';

	let storageStats = $state<R2StorageStats | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);

	async function fetchStats() {
		loading = true;
		error = null;

		try {
			storageStats = await getStorageStats();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load storage stats';
			console.error('Error fetching storage stats:', err);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		fetchStats();
	});
</script>

<div class=" flex items-center gap-3 text-sm">
	{#if loading}
		<div class="flex items-center gap-2">
			<div
				class="h-4 w-4 animate-spin rounded-full border-2 border-blue-400/20 border-t-blue-400"
			></div>
			<span>Loading...</span>
		</div>
	{:else if error}
		<div class="flex items-center gap-2 text-red-400">
			<Fa icon={faDatabase} />
			<span>Error loading stats</span>
		</div>
	{:else if storageStats}
		<div class="flex items-center gap-4">
			<div class="flex items-center gap-2">
				<Fa icon={faDatabase} class="text-purple-400" />
				<span class="font-medium">Storage: {formatFileSize(storageStats.totalSize)}</span>
			</div>
			{#if storageStats.objectCount > 0}
				<div class="text-white/60">
					{formatNumber(storageStats.objectCount)} objects
				</div>
			{/if}
		</div>
	{/if}

	{#if !loading}
		<button
			class="btn-circle group !h-8 !w-8"
			onclick={fetchStats}
			title="Refresh storage statistics"
		>
			<Fa icon={faRefresh} class="text-blue-400 transition-transform group-hover:scale-110" />
		</button>
	{/if}
</div>
