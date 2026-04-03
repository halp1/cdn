<script lang="ts">
	import { Plus, Trash2, Copy, Check, RefreshCw, X } from 'lucide-svelte';
	import { getUploadLinks, createUploadLink, deleteUploadLink } from '$lib/api/upload-links.remote';
	import { getApiKeys, createApiKeyCommand, deleteApiKeyCommand } from '$lib/api/api-keys.remote';
	import { getStorageStatsQuery } from '$lib/api/r2.remote';
	import { formatFileSize } from '$lib/utils';
	import type { ApiKeyPermission } from '$lib/db/types';

	type Panel = 'upload-links' | 'api-keys' | 'stats';

	interface Props {
		panel: Panel;
		onClose: () => void;
		width: number;
		onResize: (w: number) => void;
	}

	let { panel, onClose, width, onResize }: Props = $props();

	const uploadLinksResult = getUploadLinks();
	const apiKeysResult = getApiKeys();
	const statsResult = getStorageStatsQuery();

	let copiedToken = $state('');
	const copyLink = async (token: string) => {
		await navigator.clipboard.writeText(`${window.location.origin}/upload/${token}`);
		copiedToken = token;
		setTimeout(() => {
			copiedToken = '';
		}, 2000);
	};

	let newLinkPath = $state('');
	let newLinkHours = $state(24);
	let newLinkMax = $state(1);
	let showNewLink = $state(false);
	let creatingLink = $state(false);

	const submitLink = async () => {
		if (!newLinkPath) return;
		creatingLink = true;
		await createUploadLink({
			upload_path: newLinkPath,
			expires_in_hours: newLinkHours,
			max_uploads: newLinkMax
		});
		newLinkPath = '';
		newLinkHours = 24;
		newLinkMax = 1;
		showNewLink = false;
		creatingLink = false;
	};

	const formatExpiry = (expires_at: number): string => {
		const diff = expires_at - Math.floor(Date.now() / 1000);
		if (diff <= 0) return 'expired';
		const h = Math.floor(diff / 3600);
		const m = Math.floor((diff % 3600) / 60);
		return h > 0 ? `${h}h ${m}m` : `${m}m`;
	};

	let newKeyName = $state('');
	let newKeyPerms = $state<ApiKeyPermission[]>(['read', 'list']);
	let newKeyPaths = $state<string[]>(['/']);
	let showNewKey = $state(false);
	let creatingKey = $state(false);
	let newKeyValue = $state('');

	const togglePerm = (perm: ApiKeyPermission) => {
		if (newKeyPerms.includes(perm)) newKeyPerms = newKeyPerms.filter((p) => p !== perm);
		else newKeyPerms = [...newKeyPerms, perm];
	};

	const submitKey = async () => {
		if (!newKeyName) return;
		creatingKey = true;
		const result = await createApiKeyCommand({
			name: newKeyName,
			permissions: newKeyPerms,
			scopedPaths: newKeyPaths
		});
		newKeyValue = result.key;
		newKeyName = '';
		newKeyPerms = ['read', 'list'];
		newKeyPaths = ['/'];
		showNewKey = false;
		creatingKey = false;
	};

	let resizing = false;
	let startX = 0;
	let startW = 0;

	const onMouseDown = (e: MouseEvent) => {
		resizing = true;
		startX = e.clientX;
		startW = width;
		e.preventDefault();
	};

	const titles: Record<Panel, string> = {
		'upload-links': 'Upload Links',
		'api-keys': 'API Keys',
		stats: 'Storage Stats'
	};
</script>

<svelte:window
	onmousemove={(e) => {
		if (resizing) onResize(Math.max(220, Math.min(600, startW - (e.clientX - startX))));
	}}
	onmouseup={() => {
		resizing = false;
	}}
/>

<aside
	class="relative flex shrink-0 flex-col overflow-hidden border-l border-border bg-surface"
	style="width: {width}px"
>
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<!-- svelte-ignore a11y_no_redundant_roles -->
	<hr
		class="absolute top-0 left-0 z-2 h-full w-1 cursor-col-resize border-none bg-transparent transition-colors hover:bg-accent/50"
		onmousedown={onMouseDown}
		role="separator"
		aria-orientation="vertical"
		aria-label="Resize panel"
		tabindex="-1"
	/>

	<div class="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
		<span class="flex-1 text-xs tracking-[0.16em] text-muted uppercase">{titles[panel]}</span>
		<button
			class="flex cursor-pointer items-center border-0 bg-transparent p-1.25 text-muted transition-colors hover:text-text"
			onclick={onClose}><X size={13} /></button
		>
	</div>

	<div
		class="flex-1 overflow-y-auto p-3 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent"
	>
		{#if panel === 'upload-links'}
			<div class="flex flex-col gap-2">
				<button
					class="mb-1 flex w-full cursor-pointer items-center justify-center gap-1.5 border border-border bg-transparent px-2.5 py-1.5 font-mono text-xs tracking-[0.08em] text-muted uppercase transition-all hover:border-accent hover:text-accent"
					onclick={() => {
						showNewLink = !showNewLink;
					}}
				>
					<Plus size={12} />
					New link
				</button>

				{#if showNewLink}
					<div
						class="flex animate-[fadeUp_0.15s_ease_both] flex-col gap-2.5 border border-border bg-bg p-3"
					>
						<div class="flex flex-col gap-1.5">
							<label class="text-xs tracking-[0.14em] text-muted uppercase" for="link-path"
								>Upload path</label
							>
							<input
								class="w-full rounded-none border border-border bg-input-bg px-2.25 py-1.75 font-mono text-sm text-text transition-[border-color] outline-none placeholder:text-[#333] focus:border-accent"
								id="link-path"
								bind:value={newLinkPath}
								placeholder="path/to/folder/"
							/>
						</div>
						<div class="grid grid-cols-2 gap-2">
							<div class="flex flex-col gap-1.5">
								<label class="text-xs tracking-[0.14em] text-muted uppercase" for="link-hours"
									>Expires (hours)</label
								>
								<input
									class="w-full rounded-none border border-border bg-input-bg px-2.25 py-1.75 font-mono text-sm text-text transition-[border-color] outline-none placeholder:text-[#333] focus:border-accent"
									id="link-hours"
									type="number"
									bind:value={newLinkHours}
									min="1"
									max="8760"
								/>
							</div>
							<div class="flex flex-col gap-1.5">
								<label class="text-xs tracking-[0.14em] text-muted uppercase" for="link-max"
									>Max uploads</label
								>
								<input
									class="w-full rounded-none border border-border bg-input-bg px-2.25 py-1.75 font-mono text-sm text-text transition-[border-color] outline-none placeholder:text-[#333] focus:border-accent"
									id="link-max"
									type="number"
									bind:value={newLinkMax}
									min="1"
									max="100"
								/>
							</div>
						</div>
						<div class="flex justify-end gap-1.5">
							<button
								class="cursor-pointer border border-border bg-transparent px-3 py-1.5 font-mono text-xs tracking-widest text-muted uppercase transition-all hover:border-muted hover:text-text"
								onclick={() => {
									showNewLink = false;
								}}>Cancel</button
							>
							<button
								class="cursor-pointer border-0 bg-accent px-3 py-1.5 font-mono text-xs font-medium tracking-widest text-bg uppercase transition-opacity hover:opacity-[0.88] disabled:cursor-not-allowed disabled:opacity-40"
								onclick={submitLink}
								disabled={creatingLink || !newLinkPath}
							>
								{creatingLink ? '…' : 'Create'}
							</button>
						</div>
					</div>
				{/if}

				{#await uploadLinksResult}
					<div class="flex justify-center p-4 text-muted"><RefreshCw size={12} class="spin" /></div>
				{:then data}
					{#each data.links as link (link.token)}
						<div
							class="flex animate-[fadeUp_0.2s_ease_both] flex-col gap-1.5 border border-border bg-bg px-3 py-2.5"
						>
							<div class="overflow-hidden text-sm text-ellipsis whitespace-nowrap text-text">
								{link.upload_path}
							</div>
							<div class="flex items-center gap-1">
								<span
									class="border border-border px-1.25 py-px text-xs tracking-widest text-muted uppercase"
									>{link.used_count}/{link.max_uploads} used</span
								>
								<span
									class="border border-accent/30 px-1.25 py-px text-xs tracking-widest text-accent uppercase"
									>{formatExpiry(link.expires_at)}</span
								>
							</div>
							<div class="flex justify-end gap-0.5">
								<button
									class="flex cursor-pointer items-center border-0 bg-transparent p-1.25 text-muted transition-colors hover:text-text"
									onclick={() => copyLink(link.token)}
									title="Copy link"
								>
									{#if copiedToken === link.token}<Check size={12} />{:else}<Copy size={12} />{/if}
								</button>
								<button
									class="flex cursor-pointer items-center border-0 bg-transparent p-1.25 text-muted transition-colors hover:text-[#ff6b6b]"
									onclick={() => deleteUploadLink({ token: link.token })}
									title="Delete"
								>
									<Trash2 size={12} />
								</button>
							</div>
						</div>
					{:else}
						<p class="py-4 text-center text-sm text-border">No active upload links</p>
					{/each}
				{/await}
			</div>
		{:else if panel === 'api-keys'}
			<div class="flex flex-col gap-2">
				<button
					class="mb-1 flex w-full cursor-pointer items-center justify-center gap-1.5 border border-border bg-transparent px-2.5 py-1.5 font-mono text-xs tracking-[0.08em] text-muted uppercase transition-all hover:border-accent hover:text-accent"
					onclick={() => {
						showNewKey = !showNewKey;
						newKeyValue = '';
					}}
				>
					<Plus size={12} />
					New key
				</button>

				{#if newKeyValue}
					<div
						class="animate-[fadeUp_0.15s_ease_both] border border-accent/20 bg-accent/6 px-3 py-2.5"
					>
						<p class="mb-2 text-xs tracking-[0.06em] text-accent">
							Copy this key now — it won't be shown again.
						</p>
						<div class="flex items-center gap-1.5">
							<code
								class="flex-1 overflow-hidden font-mono text-xs text-ellipsis whitespace-nowrap text-accent"
								>{newKeyValue}</code
							>
							<button
								class="flex cursor-pointer items-center border-0 bg-transparent p-1.25 text-muted transition-colors hover:text-text"
								onclick={() => navigator.clipboard.writeText(newKeyValue)}
							>
								<Copy size={12} />
							</button>
						</div>
					</div>
				{/if}

				{#if showNewKey}
					<div
						class="flex animate-[fadeUp_0.15s_ease_both] flex-col gap-2.5 border border-border bg-bg p-3"
					>
						<div class="flex flex-col gap-1.5">
							<label class="text-xs tracking-[0.14em] text-muted uppercase" for="key-name"
								>Key name</label
							>
							<input
								class="w-full rounded-none border border-border bg-input-bg px-2.25 py-1.75 font-mono text-sm text-text transition-[border-color] outline-none placeholder:text-[#333] focus:border-accent"
								id="key-name"
								bind:value={newKeyName}
								placeholder="my-integration"
							/>
						</div>
						<div class="flex flex-col gap-1.5">
							<p class="text-xs tracking-[0.14em] text-muted uppercase">Permissions</p>
							<div class="grid grid-cols-2 gap-1">
								{#each ['read', 'write', 'delete', 'list'] as perm (perm)}
									<label
										class="flex cursor-pointer items-center gap-1.5 font-mono text-sm text-muted"
									>
										<input
											type="checkbox"
											class="w-auto p-0"
											checked={newKeyPerms.includes(perm as ApiKeyPermission)}
											onchange={() => togglePerm(perm as ApiKeyPermission)}
										/>
										{perm}
									</label>
								{/each}
							</div>
						</div>
						<div class="flex flex-col gap-1.5">
							<p class="text-xs tracking-[0.14em] text-muted uppercase">Scoped paths</p>
							<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
							{#each newKeyPaths as _, i (i)}
								<div class="mb-1 flex items-center gap-1">
									<input
										class="w-full rounded-none border border-border bg-input-bg px-2.25 py-1.75 font-mono text-sm text-text transition-[border-color] outline-none placeholder:text-[#333] focus:border-accent"
										bind:value={newKeyPaths[i]}
										placeholder="/folder"
									/>
									{#if newKeyPaths.length > 1}
										<button
											class="flex shrink-0 cursor-pointer items-center border-0 bg-transparent p-1.25 text-muted transition-colors hover:text-text"
											onclick={() => {
												newKeyPaths = newKeyPaths.filter((_, j) => j !== i);
											}}
										>
											<X size={11} />
										</button>
									{/if}
								</div>
							{/each}
							<button
								class="flex cursor-pointer items-center gap-1.25 border-0 bg-transparent px-0 py-1 font-mono text-xs text-muted transition-colors hover:text-text"
								onclick={() => {
									newKeyPaths = [...newKeyPaths, ''];
								}}>+ Add path</button
							>
						</div>
						<div class="flex justify-end gap-1.5">
							<button
								class="cursor-pointer border border-border bg-transparent px-3 py-1.5 font-mono text-xs tracking-widest text-muted uppercase transition-all hover:border-muted hover:text-text"
								onclick={() => {
									showNewKey = false;
								}}>Cancel</button
							>
							<button
								class="cursor-pointer border-0 bg-accent px-3 py-1.5 font-mono text-xs font-medium tracking-widest text-bg uppercase transition-opacity hover:opacity-[0.88] disabled:cursor-not-allowed disabled:opacity-40"
								onclick={submitKey}
								disabled={creatingKey || !newKeyName}
							>
								{creatingKey ? '…' : 'Create'}
							</button>
						</div>
					</div>
				{/if}

				{#await apiKeysResult}
					<div class="flex justify-center p-4 text-muted"><RefreshCw size={12} class="spin" /></div>
				{:then data}
					{#each data.apiKeys as key (key.id)}
						<div
							class="flex animate-[fadeUp_0.2s_ease_both] flex-col gap-1.5 border border-border bg-bg px-3 py-2.5"
						>
							<div class="text-sm text-text">{key.name}</div>
							<code class="font-mono text-xs text-muted">{key.key_preview}</code>
							<div class="flex flex-wrap items-center gap-1">
								{#each key.permissions as perm (perm)}
									<span
										class="border border-border px-1.25 py-px text-xs tracking-widest text-muted uppercase"
										>{perm}</span
									>
								{/each}
							</div>
							<div class="flex justify-end">
								<button
									class="flex cursor-pointer items-center border-0 bg-transparent p-1.25 text-muted transition-colors hover:text-[#ff6b6b]"
									onclick={() => deleteApiKeyCommand({ id: key.id, permanent: true })}
									title="Delete permanently"
								>
									<Trash2 size={12} />
								</button>
							</div>
						</div>
					{:else}
						<p class="py-4 text-center text-sm text-border">No API keys</p>
					{/each}
				{/await}
			</div>
		{:else if panel === 'stats'}
			<div class="flex flex-col gap-2">
				{#await statsResult}
					<div class="flex justify-center p-4 text-muted"><RefreshCw size={12} class="spin" /></div>
				{:then stats}
					<div class="grid grid-cols-2 gap-2">
						<div class="flex flex-col gap-1.5 border border-border bg-bg px-3 py-3.5">
							<span class="text-xs tracking-[0.14em] text-muted uppercase">Total size</span>
							<span class="font-heading text-2xl leading-none text-accent"
								>{formatFileSize(stats.totalSize)}</span
							>
						</div>
						<div class="flex flex-col gap-1.5 border border-border bg-bg px-3 py-3.5">
							<span class="text-xs tracking-[0.14em] text-muted uppercase">Objects</span>
							<span class="font-heading text-2xl leading-none text-accent"
								>{stats.objectCount.toLocaleString()}</span
							>
						</div>
					</div>
					<button
						class="mt-2 flex cursor-pointer items-center gap-1.25 border-0 bg-transparent px-0 py-1 font-mono text-xs text-muted transition-colors hover:text-text"
						onclick={() => getStorageStatsQuery().refresh()}
					>
						<RefreshCw size={11} /> Refresh
					</button>
				{/await}
			</div>
		{/if}
	</div>
</aside>
