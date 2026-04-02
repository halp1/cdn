import { toast } from '$lib/toast';
import { deleteObject, moveObject, getFolderSize, type R2Object } from '$lib/r2';

export function getObjectName(key: string): string {
	if (!key) return '';

	if (key.endsWith('/')) {
		key = key.slice(0, -1);
	}

	const parts = key.split('/');
	return parts[parts.length - 1];
}

export async function handleObjectMoveToFolder(
	sourceObject: R2Object,
	targetFolder: string,
	onSuccess: () => Promise<void>
) {
	if (!sourceObject || !sourceObject.key) return;

	// Don't move to the same folder
	const sourcePath = sourceObject.key.split('/');
	sourcePath.pop(); // Remove filename or folder name
	const sourceFolder = sourcePath.join('/') + (sourcePath.length > 0 ? '/' : '');

	if (sourceFolder === targetFolder) {
		// toast.error('Item is already in this folder');
		return;
	}

	// Get the filename or folder name
	const name = getObjectName(sourceObject.key);

	// Build the destination key
	let destinationKey = targetFolder + name;
	if (sourceObject.isFolder && !destinationKey.endsWith('/')) {
		destinationKey += '/';
	}

	const { dismiss } = toast.loading(`Moving ${name}...`);
	try {
		// Check if it's a folder - we need to handle differently
		if (sourceObject.isFolder) {
			// For folders, we need to move all contents
			toast.success(`Moving folder ${name}... This may take a moment.`);

			// List all objects with this prefix and move them
			// This is a simplified version - in reality, you'd need to list all objects with this prefix
			// and move them one by one
			await moveObject(sourceObject.key, destinationKey);
		} else {
			// Regular file move
			await moveObject(sourceObject.key, destinationKey);
		}

		toast.success(`Moved ${name} to ${targetFolder === '' ? 'Root' : targetFolder}`);
		await onSuccess();
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : 'Unknown error';
		toast.error(`Failed to move ${name}: ${errorMessage}`);
		console.error(err);
	} finally {
		dismiss();
	}
}

export async function handleDeleteObject(object: R2Object, onSuccess: () => Promise<void>) {
	if (!object.key) return;

	if (!confirm(`Are you sure you want to delete ${getObjectName(object.key)}?`)) {
		return;
	}

	try {
		await deleteObject(object.key);
		await onSuccess();
	} catch (err) {
		toast.error('Failed to delete the object');
		console.error(err);
	}
}

export async function calculateFolderSize(folderKey: string): Promise<number> {
	try {
		if (!folderKey.endsWith('/')) {
			folderKey += '/';
		}
		return await getFolderSize(folderKey);
	} catch (err) {
		toast.error('Failed to calculate folder size');
		console.error(err);
		return 0;
	}
}

export function formatFileSize(bytes: number): string {
	if (bytes === 0) return '0 Bytes';

	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
