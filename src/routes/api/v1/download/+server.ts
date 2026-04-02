import { json } from '@sveltejs/kit';
import { extractApiKeyFromHeader, validateApiKeyAccess } from '$lib/api-keys';
import { generateDownloadUrl } from '$lib/r2-server';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ request, url }) => {
	const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));
	if (!apiKey) return json({ error: 'API key required' }, { status: 401 });

	const key = url.searchParams.get('key');
	if (!key) return json({ error: 'key is required' }, { status: 400 });

	const pathPart = '/' + key.split('/').slice(0, -1).join('/');
	const validation = validateApiKeyAccess(apiKey, 'read', pathPart);
	if (!validation.valid) return json({ error: validation.error }, { status: 403 });

	const downloadUrl = await generateDownloadUrl(key);
	return json({ success: true, downloadUrl });
};
