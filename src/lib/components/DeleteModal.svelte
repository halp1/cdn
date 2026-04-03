<script lang="ts">
	import { Trash2 } from 'lucide-svelte';

	interface Props {
		count: number;
		onConfirm: () => void;
		onCancel: () => void;
	}

	let { count, onConfirm, onCancel }: Props = $props();

	let focusEl = $state<HTMLButtonElement | null>(null);

	$effect(() => {
		focusEl?.focus();
	});

	const handleKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			onConfirm();
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
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
	onclick={handleBackdropClick}
	onkeydown={handleKeydown}
>
	<div
		class="relative w-80 border border-border bg-(--surface) p-6 before:absolute before:-top-px before:-right-px before:h-8 before:w-8 before:border-t-2 before:border-r-2 before:border-[#ff6b6b]"
	>
		<div class="mb-3 flex items-center gap-2">
			<Trash2 size={14} class="text-[#ff6b6b]" />
			<span class="font-mono text-xs tracking-[0.16em] text-(--text) uppercase">Confirm Delete</span
			>
		</div>

		<p class="mb-5 font-mono text-base text-(--muted)">
			Delete <span class="text-(--text)">{count} item{count !== 1 ? 's' : ''}</span>? This cannot be
			undone.
		</p>

		<div class="flex justify-end gap-2">
			<button
				type="button"
				class="cursor-pointer border border-border bg-transparent px-4 py-1.5 font-mono text-sm tracking-[0.12em] text-(--muted) uppercase transition-[color,border-color] hover:border-(--muted) hover:text-(--text)"
				onclick={onCancel}
			>
				Cancel
			</button>
			<button
				bind:this={focusEl}
				type="button"
				class="cursor-pointer border border-[#ff6b6b] bg-[#ff6b6b] px-4 py-1.5 font-mono text-sm font-medium tracking-[0.12em] text-(--bg) uppercase transition-opacity hover:opacity-80"
				onclick={onConfirm}
			>
				Delete
			</button>
		</div>
	</div>
</div>
