<script lang="ts">
	import { page } from '$app/state';
</script>

{#if page.error}
	<div class="flex flex-col items-center justify-center h-screen gap-4 text-center">
		<h1 class="font-anta !font-bold italic underline text-7xl">Error {page.status}</h1>
		<p class="text-2xl">{page.error.message}</p>
	</div>
{/if}
