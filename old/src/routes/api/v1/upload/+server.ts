import { json } from '@sveltejs/kit';
import { validateApiKeyAccess, extractApiKeyFromHeader } from '$lib/api-keys';
import { generateUploadUrl } from '$lib/r2-server';
import { sanitizeFilename } from '$lib/filename-utils';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const authHeader = request.headers.get('authorization');
		const apiKey = extractApiKeyFromHeader(authHeader);

		if (!apiKey) {
			return json({ error: 'API key required in Authorization header' }, { status: 401 });
		}

		const { path, filename, fileType } = await request.json();

		if (!path || !filename) {
			return json({ error: 'Path and filename are required' }, { status: 400 });
		}

		// Validate API key access
		const validation = validateApiKeyAccess(apiKey, 'write', path);
		if (!validation.valid) {
			return json({ error: validation.error }, { status: 403 });
		}

		// Sanitize the filename
		const sanitizedFilename = sanitizeFilename(filename);

		// Generate the full file path
		const targetPath = path.endsWith('/') ? path : path + '/';
		const fileKey = targetPath + sanitizedFilename;

		// Get presigned upload URL
		const uploadUrl = await generateUploadUrl(fileKey, fileType || 'application/octet-stream');

		return json({
			success: true,
			uploadUrl,
			fileKey,
			originalName: filename,
			sanitizedName: sanitizedFilename
		});
	} catch (error) {
		console.error('Error getting upload URL:', error);
		return json({ error: 'Failed to get upload URL' }, { status: 500 });
	}
};
