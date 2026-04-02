<script lang="ts">
	import { toast } from '$lib/toast';
	import { createUploadLink } from '$lib/api/upload-links.remote';
	import Fa from 'svelte-fa';
	import { faTimes, faCalendar, faFolder, faUpload } from '@fortawesome/free-solid-svg-icons';
	import { fade, fly } from 'svelte/transition';

	let {
		show = $bindable(),
		currentPrefix = '',
		onLinkCreated
	}: {
		show: boolean;
		currentPrefix: string;
		onLinkCreated?: (link: any) => void;
	} = $props();

	let expiresInHours = $state(24);
	let maxUploads = $state(1);
	let isCreating = $state(false);

	async function createUploadLinkHandler() {
		isCreating = true;

		try {
			const result = await createUploadLink({
				upload_path: currentPrefix,
				expires_in_hours: expiresInHours,
				max_uploads: maxUploads
			});

			// Copy link to clipboard
			const fullUrl = `${window.location.origin}${result.upload_url}`;
			await navigator.clipboard.writeText(fullUrl);

			toast.success('Upload link created and copied to clipboard!');

			if (onLinkCreated) {
				onLinkCreated(result);
			}

			show = false;
			resetForm();
		} catch (error) {
			console.error('Error creating upload link:', error);
			toast.error(error instanceof Error ? error.message : 'Failed to create upload link');
		} finally {
			isCreating = false;
		}
	}

	function resetForm() {
		expiresInHours = 24;
		maxUploads = 1;
	}

	function handleClose() {
		show = false;
		resetForm();
	}
</script>

{#if show}
	<!-- Modal backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
		transition:fade={{
			duration: 200
		}}
		onclick={handleClose}
	>
		<!-- Modal content -->
		<div
			transition:fly={{
				duration: 300,
				y: -50
			}}
			class="glass-panel w-96 p-6 font-mono"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="mb-6 flex items-center justify-between">
				<h2 class="text-xl font-bold text-zinc-100">Create Upload Link</h2>
				<button onclick={handleClose} class="btn-circle group">
					<Fa icon={faTimes} class="text-red-400 transition-transform group-hover:scale-110" />
				</button>
			</div>

			<form
				onsubmit={(e) => {
					e.preventDefault();
					createUploadLinkHandler();
				}}
				class="space-y-4"
			>
				<div class="glass-panel p-4">
					<p class="flex items-center gap-2 text-sm text-zinc-400">
						<Fa icon={faFolder} class="text-blue-400" />
						Files will be uploaded to:
					</p>
					<p class="mt-2 font-mono font-medium text-zinc-100">
						{currentPrefix || 'Root folder'}
					</p>
				</div>

				<div>
					<label class="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-100">
						<Fa icon={faCalendar} class="text-purple-400" />
						Expires In (hours)
					</label>
					<select bind:value={expiresInHours} class="glass-input w-full focus:outline-none">
						<option value={1}>1 hour</option>
						<option value={6}>6 hours</option>
						<option value={12}>12 hours</option>
						<option value={24}>24 hours (1 day)</option>
						<option value={72}>72 hours (3 days)</option>
						<option value={168}>168 hours (1 week)</option>
					</select>
				</div>

				<div>
					<label class="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-100">
						<Fa icon={faUpload} class="text-green-400" />
						Maximum Uploads
					</label>
					<input
						type="number"
						bind:value={maxUploads}
						min="1"
						max="100"
						class="glass-input w-full focus:outline-none"
					/>
					<p class="mt-2 text-xs text-zinc-500">
						Number of files that can be uploaded using this link (1-100)
					</p>
				</div>

				<div class="flex space-x-3 pt-4">
					<button type="button" onclick={handleClose} class="btn flex-1 py-3" disabled={isCreating}>
						Cancel
					</button>
					<button
						type="submit"
						class="btn btn-primary flex-1 py-3 disabled:opacity-50"
						disabled={isCreating}
					>
						{#if isCreating}
							<div class="flex items-center justify-center gap-2">
								<div
									class="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-200"
								></div>
								Creating...
							</div>
						{:else}
							Create Link
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
