<script lang="ts">
	import { FolderPlus } from 'lucide-svelte';

	interface Props {
		onConfirm: (name: string) => void;
		onCancel: () => void;
	}

	let { onConfirm, onCancel }: Props = $props();

	let inputValue = $state('');
	let inputEl = $state<HTMLInputElement | null>(null);

	$effect(() => {
		inputEl?.focus();
	});

	const submit = () => {
		const name = inputValue.trim();
		if (!name) return;
		onConfirm(name);
	};

	const handleKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			submit();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			onCancel();
		}
	};

	const handleBackdropClick = (e: MouseEvent) => {
		if (e.target === e.currentTarget) onCancel();
	};
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
	onclick={handleBackdropClick}
>
	<div
		class="relative w-80 border border-(--border) bg-(--surface) p-6 before:absolute before:-top-px before:-right-px before:h-8 before:w-8 before:border-t-2 before:border-r-2 before:border-(--accent)"
	>
		<div class="mb-4 flex items-center gap-2">
			<FolderPlus size={14} class="text-(--accent)" />
			<span class="font-mono text-[10px] tracking-[0.16em] text-(--text) uppercase">New Folder</span
			>
		</div>

		<label
			for="new-folder-input"
			class="mb-1 block font-mono text-[10px] tracking-[0.16em] text-(--muted) uppercase"
			>Folder name</label
		>
		<input
			id="new-folder-input"
			bind:this={inputEl}
			bind:value={inputValue}
			type="text"
			class="mb-5 w-full border border-(--border) bg-(--input-bg) px-3 py-2 font-mono text-[13px] text-(--text) transition-colors outline-none placeholder:text-(--muted) focus:border-(--accent)"
			placeholder="my-folder"
			onkeydown={handleKeydown}
		/>

		<div class="flex justify-end gap-2">
			<button
				type="button"
				class="cursor-pointer border border-(--border) bg-transparent px-4 py-1.5 font-mono text-[11px] tracking-[0.12em] text-(--muted) uppercase transition-[color,border-color] hover:border-(--muted) hover:text-(--text)"
				onclick={onCancel}
			>
				Cancel
			</button>
			<button
				type="button"
				class="cursor-pointer border border-(--accent) bg-(--accent) px-4 py-1.5 font-mono text-[11px] font-medium tracking-[0.12em] text-(--bg) uppercase transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
				onclick={submit}
				disabled={!inputValue.trim()}
			>
				Create
			</button>
		</div>
	</div>
</div>
