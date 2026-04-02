<script lang="ts">
	import Fa from 'svelte-fa';
	import { faTimes } from '@fortawesome/free-solid-svg-icons';

	interface Props {
		showNewFolderInput: boolean;
		newFolderName: string;
		onCreateFolder: () => void;
		onShowNewFolderInputChange: (show: boolean) => void;
		onNewFolderNameChange: (name: string) => void;
	}

	let folderInputRef = $state<HTMLInputElement | null>(null);

	let {
		showNewFolderInput,
		newFolderName = $bindable(),
		onCreateFolder,
		onShowNewFolderInputChange,
		onNewFolderNameChange
	}: Props = $props();

	function handleKeyPress(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			onCreateFolder();
		} else if (event.key === 'Escape') {
			onShowNewFolderInputChange(false);
			onNewFolderNameChange('');
		}
	}

	$effect(() => {
		if (showNewFolderInput && folderInputRef) {
			setTimeout(() => {
				folderInputRef?.focus();
			}, 0);
		}
	});
</script>

{#if showNewFolderInput}
	<div class="glass-panel flex items-center">
		<input
			type="text"
			class="glass-input min-w-0 flex-1"
			placeholder="New folder name"
			bind:value={newFolderName}
			onkeydown={handleKeyPress}
			onchange={(e) => onNewFolderNameChange((e.target as HTMLInputElement).value)}
			bind:this={folderInputRef}
		/>
		<button
			class="btn-circle ml-2"
			onclick={() => {
				onShowNewFolderInputChange(false);
				onNewFolderNameChange('');
			}}
			title="Cancel"
		>
			<Fa icon={faTimes} />
		</button>
	</div>
{/if}
