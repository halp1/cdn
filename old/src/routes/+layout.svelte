<script lang="ts">
	import { Toaster } from 'svelte-french-toast';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>halp/cdn</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" />
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<main class="font-fira relative min-h-screen w-full text-white">
	{@render children()}
</main>

<Toaster />
