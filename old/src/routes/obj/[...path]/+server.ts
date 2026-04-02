import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from '../$types';
import { R2_URL } from '$env/static/private';

export const GET: RequestHandler = async ({ url, setHeaders }) => {
	setHeaders({
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization'
	});
	return redirect(302, R2_URL + url.pathname.replace('/obj', '') + url.search);
};
