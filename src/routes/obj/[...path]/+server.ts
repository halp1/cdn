import { redirect, error } from '@sveltejs/kit';
import { R2_URL } from '$env/static/private';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params }) => {
	const { path } = params;
	if (!path) error(400, 'No path specified');
	const r2Url = R2_URL.endsWith('/') ? R2_URL : R2_URL + '/';
	redirect(302, `${r2Url}${path}`);
};
