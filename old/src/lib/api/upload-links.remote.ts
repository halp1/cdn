import { query, command, getRequestEvent } from '$app/server';
import { statements } from '$lib/db';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';

// Query to get all upload links
export const getUploadLinks = query(async () => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		error(401, 'Unauthorized');
	}

	try {
		// Clean up expired links first
		(statements as any).deleteExpiredOneTimeLinks.run();

		// Get all active links
		const links = (statements as any).getAllOneTimeLinks.all();

		return { links };
	} catch (err) {
		console.error('Error fetching one-time links:', err);
		error(500, 'Failed to fetch upload links');
	}
});

// Command to create a new upload link
const CreateUploadLinkSchema = v.object({
	upload_path: v.string(),
	expires_in_hours: v.optional(v.number()),
	max_uploads: v.optional(v.number())
});

export const createUploadLink = command(CreateUploadLinkSchema, async (data) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		error(401, 'Unauthorized');
	}

	try {
		const expiresInHours = data.expires_in_hours || 24;
		const maxUploads = data.max_uploads || 1;

		if (maxUploads < 1 || maxUploads > 100) {
			error(400, 'Maximum uploads must be between 1 and 100');
		}

		const expiresAt = Math.floor(Date.now() / 1000) + expiresInHours * 60 * 60;
		const token = crypto.randomUUID();

		(statements as any).createOneTimeLink.run(token, data.upload_path, expiresAt, maxUploads);

		// Refresh the upload links list
		await getUploadLinks().refresh();

		return {
			success: true,
			token,
			upload_path: data.upload_path,
			expires_at: expiresAt,
			upload_url: `/upload/${token}`
		};
	} catch (err) {
		console.error('Error creating one-time link:', err);
		error(500, 'Failed to create upload link');
	}
});

// Command to delete an upload link
const DeleteUploadLinkSchema = v.object({
	token: v.string()
});

export const deleteUploadLink = command(DeleteUploadLinkSchema, async (data) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		error(401, 'Unauthorized');
	}

	try {
		(statements as any).deleteOneTimeLink.run(data.token);

		// Refresh the upload links list
		await getUploadLinks().refresh();

		return { success: true };
	} catch (err) {
		console.error('Error deleting one-time link:', err);
		error(500, 'Failed to delete upload link');
	}
});
