import { json } from '@sveltejs/kit';
import { validateApiKeyAccess, extractApiKeyFromHeader } from '$lib/api-keys';
import { R2_URL } from '$env/static/private';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ request, url }) => {
	try {
		const authHeader = request.headers.get('authorization');
		const apiKey = extractApiKeyFromHeader(authHeader);

		if (!apiKey) {
			return json({ error: 'API key required in Authorization header' }, { status: 401 });
		}

		const key = url.searchParams.get('key');

		if (!key) {
			return json({ error: 'Object key is required' }, { status: 400 });
		}

		// Extract path from key for permission check
		const path = '/' + key.split('/').slice(0, -1).join('/');

		// Validate API key access
		const validation = validateApiKeyAccess(apiKey, 'read', path);
		if (!validation.valid) {
			return json({ error: validation.error }, { status: 403 });
		}

		// Return the download URL (using your existing R2_URL)
		const downloadUrl = `${R2_URL}/${key}`;

		return json({
			success: true,
			key,
			downloadUrl
		});
	} catch (error) {
		console.error('Error getting download URL:', error);
		return json({ error: 'Failed to get download URL' }, { status: 500 });
	}
};
