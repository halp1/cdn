<script lang="ts">
	import ApiKeysPanel from '$lib/components/ApiKeysPanel.svelte';
	import Fa from 'svelte-fa';
	import { faArrowLeft, faSignOutAlt } from '@fortawesome/free-solid-svg-icons';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>API Keys - HALP/CDN</title>
</svelte:head>

<div class="font-fira relative z-10 flex h-screen w-full flex-col gap-3 text-zinc-100">
	<!-- Header -->
	<div class="glass-panel mx-4 mt-4 flex h-16 items-center justify-between p-4">
		<div class="flex items-center gap-4">
			<a href="/" class="btn-circle group" title="Back to Files">
				<Fa icon={faArrowLeft} class="transition-transform group-hover:scale-110" />
			</a>
			<div class="font-anta text-2xl !font-bold text-zinc-100 italic">API Keys Management</div>
		</div>

		<div class="flex items-center gap-3">
			<span class="text-zinc-400">Welcome, {data.user.username}</span>
			<form method="post" action="/logout" class="inline">
				<button type="submit" class="btn-circle group" title="Logout">
					<Fa icon={faSignOutAlt} class="text-red-400 transition-transform group-hover:scale-110" />
				</button>
			</form>
		</div>
	</div>

	<!-- Main Content -->
	<div class="glass-panel relative mx-4 mb-4 flex flex-1 overflow-hidden">
		<div class="h-full w-full overflow-auto">
			<ApiKeysPanel />
		</div>
	</div>
</div>

<style>
	/* Use existing global styles from app.css */
</style>
