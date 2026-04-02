<script lang="ts">
	import { toast } from '$lib/toast';
	import { getUploadLinks, deleteUploadLink } from '$lib/api/upload-links.remote';
	import Fa from 'svelte-fa';
	import { faLink, faCopy, faTrash, faClock, faUpload } from '@fortawesome/free-solid-svg-icons';

	async function copyLink(token: string) {
		const url = `${window.location.origin}/upload/${token}`;
		try {
			await navigator.clipboard.writeText(url);
			toast.success('Upload link copied to clipboard');
		} catch (error) {
			toast.error('Failed to copy link');
		}
	}

	async function deleteLinkHandler(token: string) {
		try {
			await deleteUploadLink({ token });
			toast.success('Upload link deleted');
		} catch (error) {
			console.error('Error deleting upload link:', error);
			toast.error('Failed to delete upload link');
		}
	}

	function formatTimeLeft(expiresAt: number) {
		const now = Math.floor(Date.now() / 1000);
		const timeLeft = expiresAt - now;

		if (timeLeft <= 0) {
			return 'Expired';
		}

		const hours = Math.floor(timeLeft / 3600);
		const minutes = Math.floor((timeLeft % 3600) / 60);

		if (hours > 0) {
			return `${hours}h ${minutes}m`;
		} else {
			return `${minutes}m`;
		}
	}

	function isExpired(expiresAt: number) {
		return expiresAt <= Math.floor(Date.now() / 1000);
	}

	// Export function to allow parent to refresh links
	export function refreshLinks() {
		getUploadLinks().refresh();
	}
</script>

{#await getUploadLinks()}
	<div class="glass-panel mx-4 mb-4 p-4">
		<p class="text-zinc-400">Loading upload links...</p>
	</div>
{:then data}
	{#if data.links.length > 0}
		<div class="glass-panel mx-4 mb-4 p-4">
			<h3 class="mb-4 flex items-center text-lg font-semibold text-zinc-100">
				<Fa icon={faLink} class="mr-2 text-blue-400" />
				Active Upload Links ({data.links.length})
			</h3>

			<div class="max-h-48 space-y-3 overflow-y-auto">
				{#each data.links as link}
					<div
						class="glass-panel group flex items-center justify-between p-4 transition-colors duration-200 hover:bg-zinc-800"
					>
						<div class="min-w-0 flex-1 bg-zinc-800">
							<div class="flex items-center space-x-2">
								<span class="truncate font-mono text-sm font-medium text-zinc-100">
									{link.upload_path || 'Root folder'}
								</span>
							</div>
							<div class="mt-2 flex items-center space-x-4">
								<span class="flex items-center text-xs text-zinc-500">
									<Fa icon={faClock} class="mr-1 text-purple-400" />
									{formatTimeLeft(link.expires_at)}
								</span>
								<span class="flex items-center text-xs text-zinc-500">
									<Fa icon={faUpload} class="mr-1 text-green-400" />
									{link.used_count}/{link.max_uploads} used
								</span>
							</div>
						</div>

						<div class="ml-4 flex items-center space-x-2">
							{#if !isExpired(link.expires_at)}
								<button
									onclick={() => copyLink(link.token)}
									class="btn-circle group/btn h-8! w-8!"
									title="Copy link"
								>
									<Fa
										icon={faCopy}
										class="text-green-400 transition-transform group-hover/btn:scale-110"
									/>
								</button>
							{/if}
							<button
								onclick={() => deleteLinkHandler(link.token)}
								class="btn-circle group/btn h-8! w-8!"
								title="Delete link"
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
{:catch error}
	<div class="glass-panel mx-4 mb-4 p-4">
		<p class="text-red-400">Failed to load upload links: {error.message}</p>
	</div>
{/await}
