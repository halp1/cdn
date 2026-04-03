<script lang="ts">
	interface Props {
		isModalOpen: boolean;
		onToggleModal: (open: boolean) => void;
	}

	let { isModalOpen, onToggleModal }: Props = $props();

	const handleKeyDown = (e: KeyboardEvent) => {
		// Ctrl+K or Cmd+K to toggle file search modal
		if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
			e.preventDefault();
			onToggleModal(!isModalOpen);
		}

		// Escape to close modal
		if (e.key === 'Escape' && isModalOpen) {
			e.preventDefault();
			onToggleModal(false);
		}
	};
</script>

<svelte:window onkeydown={handleKeyDown} />
