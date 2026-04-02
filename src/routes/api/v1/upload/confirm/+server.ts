import { json } from '@sveltejs/kit';
import { extractApiKeyFromHeader, validateApiKeyAccess } from '$lib/api-keys';
import { statements } from '$lib/db';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
	const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));
	if (!apiKey) return json({ error: 'API key required' }, { status: 401 });

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}
	if (typeof body !== 'object' || body === null)
		return json({ error: 'Invalid body' }, { status: 400 });
	const { fileKey } = body as Record<string, unknown>;
	if (typeof fileKey !== 'string') return json({ error: 'fileKey is required' }, { status: 400 });

	const pathPart = '/' + fileKey.split('/').slice(0, -1).join('/');
	const validation = validateApiKeyAccess(apiKey, 'write', pathPart);
	if (!validation.valid) return json({ error: validation.error }, { status: 403 });

	return json({ success: true, fileKey });
};
