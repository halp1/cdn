import { redirect } from '@sveltejs/kit';
import { R2_URL } from '$env/static/private';

export const load = async ({ locals, url }) => {
	if (!locals.user && !url.pathname.startsWith('/auth')) redirect(302, '/auth');
	return { user: locals.user, env: { r2_url: R2_URL } };
};
