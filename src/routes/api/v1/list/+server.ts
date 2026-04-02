import { json } from '@sveltejs/kit';
import { extractApiKeyFromHeader, validateApiKeyAccess } from '$lib/api-keys';
import { listObjectsInBucket } from '$lib/r2-server';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ request, url }) => {
	const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));
	if (!apiKey) return json({ error: 'API key required' }, { status: 401 });

	const path = url.searchParams.get('path') ?? '/';
	const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100'), 1000);

	const validation = validateApiKeyAccess(apiKey, 'list', path);
	if (!validation.valid) return json({ error: validation.error }, { status: 403 });

	const objects = await listObjectsInBucket(path, limit);
	return json({ success: true, path, objects, count: objects.length });
};
