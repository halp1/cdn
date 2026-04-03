<script lang="ts">
	import type { PageData } from './$types';
	import FileBrowser from '$lib/components/FileBrowser.svelte';

	interface Props {
		data: PageData;
	}
	let { data }: Props = $props();
</script>

<FileBrowser path={data.path} username={data.user?.username ?? ''} r2Url={data.env?.r2_url ?? ''} />
