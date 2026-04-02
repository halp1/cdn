import { command, getRequestEvent } from '$app/server';
import { statements } from '$lib/db';
import { generateUploadUrl } from '$lib/r2-server';
import { sanitizeFilename } from '$lib/filename-utils';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';

// Command to get presigned upload URL
const GetPresignedUrlSchema = v.object({
	token: v.string(),
	filename: v.string(),
	fileType: v.optional(v.string())
});

export const getPresignedUploadUrl = command(GetPresignedUrlSchema, async (data) => {
	try {
		const link = (statements as any).getOneTimeLink.get(data.token);
		if (!link) {
			error(404, 'Invalid or expired upload link, or upload limit reached');
		}

		if (link.used_count >= link.max_uploads) {
			error(403, 'Upload limit reached for this link');
		}

		const sanitizedFilename = sanitizeFilename(data.filename);

		// Generate the full file path
		const targetPath = link.upload_path.endsWith('/') ? link.upload_path : link.upload_path + '/';
		const fileKey = targetPath + sanitizedFilename;

		// Get presigned upload URL using the extracted function
		const uploadUrl = await generateUploadUrl(fileKey, data.fileType || 'application/octet-stream');

		return {
			success: true,
			uploadUrl,
			fileKey,
			originalName: data.filename,
			sanitizedName: sanitizedFilename
		};
	} catch (err) {
		console.error('Error getting upload URL:', err);
		error(500, 'Failed to get upload URL');
	}
});

// Command to confirm upload completion
const ConfirmUploadSchema = v.object({
	token: v.string(),
	fileKey: v.string()
});

export const confirmUpload = command(ConfirmUploadSchema, async (data) => {
	try {
		const link = (statements as any).getOneTimeLink.get(data.token);
		if (!link) {
			error(404, 'Invalid or expired upload link');
		}

		(statements as any).incrementUploadCount.run(data.token);

		if (link.used_count + 1 >= link.max_uploads) {
			(statements as any).deleteOneTimeLink.run(data.token);
			return {
				success: true,
				message: 'Upload confirmed and link deleted (limit reached)'
			};
		}

		return {
			success: true,
			message: 'Upload confirmed',
			remaining: link.max_uploads - (link.used_count + 1)
		};
	} catch (err) {
		console.error('Error confirming upload:', err);
		error(500, 'Failed to confirm upload');
	}
});
