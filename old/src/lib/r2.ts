export interface R2Object {
	key: string;
	size?: number;
	lastModified?: Date;
	isFolder: boolean;
	folderSize?: number; // Adding folderSize property for folders
}

export interface R2ListResponse {
	objects: R2Object[];
	prefix: string;
}

export interface R2StorageStats {
	totalSize: number;
	objectCount: number;
	lastUpdated: string;
}

import {
	listObjects as listObjectsRemote,
	getStorageStats as getStorageStatsRemote,
	getUploadUrl as getUploadUrlRemote,
	deleteObject as deleteObjectRemote,
	moveObject as moveObjectRemote,
	getFolderSize as getFolderSizeRemote
} from '$lib/api/r2.remote';

export async function listObjects(prefix: string = ''): Promise<R2ListResponse> {
	return await listObjectsRemote({ prefix });
}

export async function getStorageStats(): Promise<R2StorageStats> {
	return await getStorageStatsRemote();
}

export async function getUploadUrl(key: string, type: string): Promise<string> {
	const result = await getUploadUrlRemote({ key, type });
	return result.url;
}

export async function getUploadUrl_server(
	fetch: typeof globalThis.fetch,
	key: string,
	type: string
): Promise<string> {
	// For server-side usage, we'll still use the remote function
	const result = await getUploadUrlRemote({ key, type });
	return result.url;
}

export async function deleteObject(key: string): Promise<void> {
	await deleteObjectRemote({ key });
}

export async function moveObject(sourceKey: string, destinationKey: string): Promise<void> {
	await moveObjectRemote({ sourceKey, destinationKey });
}

export async function getFolderSize(prefix: string): Promise<number> {
	const result = await getFolderSizeRemote({ prefix });
	return result.folderSize;
}
