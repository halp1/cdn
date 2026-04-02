import { jwt } from '$lib';
import { statements } from '$lib/db';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	if (event.cookies.get('token')) {
		const user = jwt.verify(event.cookies.get('token')!);
		if (!user) {
			event.cookies.delete('token', { path: '/' });
		} else {
			// Verify that the user still exists in the database
			const dbUser = (statements as any).getUserByUsername.get(user.username);
			if (dbUser) {
				event.locals.user = user;
			} else {
				// User no longer exists in database, clear the token
				event.cookies.delete('token', { path: '/' });
			}
		}
	}
	if (!event.locals.user) {
		event.locals.user = null;
	}

	const response = await resolve(event);
	return response;
};
