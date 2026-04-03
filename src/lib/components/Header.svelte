<script lang="ts">
	import { Search, Upload, Key, Link, BarChart2, Rocket, LogOut } from 'lucide-svelte';

	interface Props {
		username: string;
		onSearch: (q: string) => void;
		onUpload: () => void;
		rightPanel: string;
		onTogglePanel: (panel: string) => void;
	}

	let { username, onSearch, onUpload, rightPanel, onTogglePanel }: Props = $props();

	let searchValue = $state('');

	const handleSearch = (e: Event) => {
		e.preventDefault();
		onSearch(searchValue);
	};
</script>

<header
	class="relative z-10 flex h-10 shrink-0 items-center gap-0 border-b border-(--border) bg-(--surface) px-3"
>
	<div class="flex min-w-0 flex-1 items-center">
		<span
			class="shrink-0 [font-family:var(--font-heading)] text-[14px] tracking-[0.08em] text-(--accent)"
			>HALP/CDN</span
		>
	</div>

	<form class="search-wrap relative shrink-0" onsubmit={handleSearch}>
		<Search
			size={13}
			class="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-(--muted)"
		/>
		<input
			type="search"
			class="search-input w-55 rounded-none border border-(--border) bg-(--bg) py-1.25 pr-2.5 pl-7.5 font-mono text-[12px] text-(--text) transition-[border-color,width] duration-200 outline-none placeholder:text-[#333] focus:w-70 focus:border-(--accent)"
			placeholder="Search files..."
			bind:value={searchValue}
		/>
	</form>

	<div class="ml-3 flex shrink-0 items-center gap-0.5">
		<button
			class="flex cursor-pointer items-center justify-center border-none bg-transparent p-1.5 text-(--muted) transition-colors hover:bg-white/4 hover:text-(--text)"
			title="Upload"
			onclick={onUpload}
		>
			<Upload size={14} />
		</button>
		<div class="mx-1 h-5 w-px bg-(--border)"></div>
		<button
			class="flex cursor-pointer items-center justify-center border-none bg-transparent p-1.5 transition-colors hover:bg-white/4 hover:text-(--text) {rightPanel ===
			'upload-links'
				? 'text-(--accent)'
				: 'text-(--muted)'}"
			title="Upload Links"
			onclick={() => onTogglePanel('upload-links')}
		>
			<Link size={14} />
		</button>
		<button
			class="flex cursor-pointer items-center justify-center border-none bg-transparent p-1.5 transition-colors hover:bg-white/4 hover:text-(--text) {rightPanel ===
			'api-keys'
				? 'text-(--accent)'
				: 'text-(--muted)'}"
			title="API Keys"
			onclick={() => onTogglePanel('api-keys')}
		>
			<Key size={14} />
		</button>
		<button
			class="flex cursor-pointer items-center justify-center border-none bg-transparent p-1.5 transition-colors hover:bg-white/4 hover:text-(--text) {rightPanel ===
			'stats'
				? 'text-(--accent)'
				: 'text-(--muted)'}"
			title="Storage Stats"
			onclick={() => onTogglePanel('stats')}
		>
			<BarChart2 size={14} />
		</button>
		<div class="mx-1 h-5 w-px bg-(--border)"></div>
		<button
			class="flex cursor-pointer items-center justify-center border-none bg-transparent p-1.5 text-(--muted) transition-colors hover:bg-white/4 hover:text-[#f0a830]"
			title="Deploy"
		>
			<Rocket size={14} />
		</button>
		<form method="POST" action="/logout">
			<button
				type="submit"
				class="flex cursor-pointer items-center justify-center border-none bg-transparent p-1.5 text-(--muted) transition-colors hover:bg-white/4 hover:text-(--text)"
				title="Sign out — {username}"
			>
				<LogOut size={14} />
			</button>
		</form>
	</div>
</header>

<style>
	.search-input::-webkit-search-cancel-button {
		display: none;
	}
</style>
