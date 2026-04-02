import { query, command, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import {
	listObjects,
	generateUploadUrl,
	generateDownloadUrl,
	deleteObject,
	moveObject,
	getFolderSize,
	getStorageStats,
	listAllObjects
} from '$lib/r2-server';
import { statements } from '$lib/db';

export const listObjectsQuery = query(
	v.object({ prefix: v.optional(v.string(), '') }),
	async ({ prefix }) => {
		const { locals } = getRequestEvent();
		if (!locals.user) error(401, 'Unauthorized');
		return listObjects(prefix);
	}
);

export const getUploadUrl = command(
	v.object({ key: v.string(), type: v.string() }),
	async ({ key, type }) => {
		const { locals } = getRequestEvent();
		if (!locals.user) error(401, 'Unauthorized');
		const url = await generateUploadUrl(key, type);
		return { url };
	}
);

export const getDownloadUrl = command(v.object({ key: v.string() }), async ({ key }) => {
	const { locals } = getRequestEvent();
	if (!locals.user) error(401, 'Unauthorized');
	const url = await generateDownloadUrl(key);
	return { url };
});

export const deleteObjectCommand = command(v.object({ key: v.string() }), async ({ key }) => {
	const { locals } = getRequestEvent();
	if (!locals.user) error(401, 'Unauthorized');
	await deleteObject(key);
	return { success: true };
});

export const moveObjectCommand = command(
	v.object({ sourceKey: v.string(), destinationKey: v.string() }),
	async ({ sourceKey, destinationKey }) => {
		const { locals } = getRequestEvent();
		if (!locals.user) error(401, 'Unauthorized');
		await moveObject(sourceKey, destinationKey);
		return { success: true };
	}
);

export const getFolderSizeQuery = query(v.object({ prefix: v.string() }), async ({ prefix }) => {
	const { locals } = getRequestEvent();
	if (!locals.user) error(401, 'Unauthorized');
	const size = await getFolderSize(prefix);
	return { size };
});

export const getStorageStatsQuery = query(async () => {
	const { locals } = getRequestEvent();
	if (!locals.user) error(401, 'Unauthorized');
	return getStorageStats();
});

export const createFolderCommand = command(v.object({ path: v.string() }), async ({ path }) => {
	const { locals } = getRequestEvent();
	if (!locals.user) error(401, 'Unauthorized');
	const normalizedPath = path.endsWith('/') ? path : path + '/';
	statements.createFolder.run(normalizedPath);
	return { success: true, path: normalizedPath };
});

export const deleteFolderCommand = command(v.object({ path: v.string() }), async ({ path }) => {
	const { locals } = getRequestEvent();
	if (!locals.user) error(401, 'Unauthorized');
	const normalizedPath = path.endsWith('/') ? path : path + '/';
	statements.deleteFolder.run(normalizedPath);
	return { success: true };
});

export const getVirtualFolders = query(
	v.object({ prefix: v.optional(v.string(), '') }),
	async ({ prefix }) => {
		const { locals } = getRequestEvent();
		if (!locals.user) error(401, 'Unauthorized');
		const pattern = prefix ? `${prefix}%` : '%';
		const folders = statements.getFoldersByPrefix.all(pattern);
		return { folders };
	}
);

export const listAllObjectsQuery = query(async () => {
	const { locals } = getRequestEvent();
	if (!locals.user) error(401, 'Unauthorized');
	const [r2Objects, dbFolders] = await Promise.all([
		listAllObjects(),
		Promise.resolve(statements.getAllFolders.all())
	]);
	const r2Keys = new Set(r2Objects.map((o) => o.key));
	const virtualFolders = dbFolders
		.filter((f) => !r2Keys.has(f.path))
		.map((f) => ({ key: f.path, isFolder: true as const }));
	return { objects: [...r2Objects, ...virtualFolders] };
});
