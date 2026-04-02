import { json } from '@sveltejs/kit';
import { validateApiKeyAccess, extractApiKeyFromHeader } from '$lib/api-keys';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const authHeader = request.headers.get('authorization');
		const apiKey = extractApiKeyFromHeader(authHeader);

		if (!apiKey) {
			return json({ error: 'API key required in Authorization header' }, { status: 401 });
		}

		const { fileKey } = await request.json();

		if (!fileKey) {
			return json({ error: 'File key is required' }, { status: 400 });
		}

		// Extract path from key for permission check
		const path = '/' + fileKey.split('/').slice(0, -1).join('/');

		// Validate API key access
		const validation = validateApiKeyAccess(apiKey, 'write', path);
		if (!validation.valid) {
			return json({ error: validation.error }, { status: 403 });
		}

		// In a real implementation, you might want to:
		// 1. Verify the file was actually uploaded to R2
		// 2. Update database records
		// 3. Process the file (generate thumbnails, etc.)

		return json({
			success: true,
			message: 'Upload confirmed',
			fileKey
		});
	} catch (error) {
		console.error('Error confirming upload:', error);
		return json({ error: 'Failed to confirm upload' }, { status: 500 });
	}
};
