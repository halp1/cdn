import { json } from '@sveltejs/kit';
import { validateApiKeyAccess, extractApiKeyFromHeader } from '$lib/api-keys';
import { deleteObjectFromBucket } from '$lib/r2-server';
import type { RequestHandler } from '@sveltejs/kit';

export const DELETE: RequestHandler = async ({ request }) => {
	try {
		const authHeader = request.headers.get('authorization');
		const apiKey = extractApiKeyFromHeader(authHeader);

		if (!apiKey) {
			return json({ error: 'API key required in Authorization header' }, { status: 401 });
		}

		const { key } = await request.json();

		if (!key) {
			return json({ error: 'Object key is required' }, { status: 400 });
		}

		// Extract path from key for permission check
		const path = '/' + key.split('/').slice(0, -1).join('/');

		// Validate API key access
		const validation = validateApiKeyAccess(apiKey, 'delete', path);
		if (!validation.valid) {
			return json({ error: validation.error }, { status: 403 });
		}

		// Delete the object
		const success = await deleteObjectFromBucket(key);

		if (success) {
			return json({
				success: true,
				message: 'Object deleted successfully',
				key
			});
		} else {
			return json({ error: 'Failed to delete object' }, { status: 500 });
		}
	} catch (error) {
		console.error('Error deleting object:', error);
		return json({ error: 'Failed to delete object' }, { status: 500 });
	}
};
