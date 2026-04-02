import { command, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { statements } from '$lib/db';
import { generateUploadUrl } from '$lib/r2-server';
import { sanitizeFilename } from '$lib/filename-utils';

export const getPresignedUploadUrl = command(
	v.object({
		token: v.string(),
		filename: v.string(),
		fileType: v.optional(v.string(), 'application/octet-stream')
	}),
	async ({ token, filename, fileType }) => {
		const link = statements.getOneTimeLink.get(token);
		if (!link) error(404, 'Invalid or expired upload link');
		if (link.used_count >= link.max_uploads) error(403, 'Upload limit reached');

		const sanitizedFilename = sanitizeFilename(filename);
		const targetPath = link.upload_path.endsWith('/') ? link.upload_path : link.upload_path + '/';
		const fileKey = targetPath + sanitizedFilename;
		const uploadUrl = await generateUploadUrl(fileKey, fileType);

		return { success: true, uploadUrl, fileKey, sanitizedName: sanitizedFilename };
	}
);

export const confirmUpload = command(
	v.object({ token: v.string(), fileKey: v.string() }),
	async ({ token }) => {
		const link = statements.getOneTimeLink.get(token);
		if (!link) error(404, 'Invalid or expired upload link');

		statements.incrementUploadCount.run(token);

		const updatedLink = statements.getOneTimeLink.get(token);
		if (!updatedLink || updatedLink.used_count >= updatedLink.max_uploads) {
			statements.deleteOneTimeLink.run(token);
		}

		return { success: true };
	}
);
