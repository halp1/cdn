import { error, isHttpError, redirect } from '@sveltejs/kit';
import { statements } from '$lib/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const { token } = params;

	if (!token) {
		throw error(400, 'Invalid upload link');
	}

	try {
		const link = (statements as any).getOneTimeLink.get(token);

		if (!link) {
			throw error(404, 'Upload link not found or expired');
		}

		return {
			token,
			targetPath: link.upload_path,
			expiresAt: link.expires_at,
			maxUploads: link.max_uploads,
			usedCount: link.used_count,
			remainingUploads: link.max_uploads - link.used_count
		};
	} catch (err) {
		if (isHttpError(err)) throw err;
		console.error('Error loading upload link:', err);
		throw error(500, 'Failed to load upload link');
	}
};
