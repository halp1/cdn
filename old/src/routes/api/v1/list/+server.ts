import { json } from '@sveltejs/kit';
import { validateApiKeyAccess, extractApiKeyFromHeader } from '$lib/api-keys';
import { listObjectsInBucket } from '$lib/r2-server';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ request, url }) => {
	try {
		const authHeader = request.headers.get('authorization');
		const apiKey = extractApiKeyFromHeader(authHeader);

		if (!apiKey) {
			return json({ error: 'API key required in Authorization header' }, { status: 401 });
		}

		const path = url.searchParams.get('path') || '/';
		const limit = parseInt(url.searchParams.get('limit') || '100');

		// Validate API key access
		const validation = validateApiKeyAccess(apiKey, 'list', path);
		if (!validation.valid) {
			return json({ error: validation.error }, { status: 403 });
		}

		// List objects in the path
		const objects = await listObjectsInBucket(path, limit);

		return json({
			success: true,
			path,
			objects,
			count: objects.length
		});
	} catch (error) {
		console.error('Error listing objects:', error);
		return json({ error: 'Failed to list objects' }, { status: 500 });
	}
};
