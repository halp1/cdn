import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ cookies }) => {
		// Clear the authentication token
		cookies.delete('token', { path: '/' });

		// Redirect to auth page
		throw redirect(302, '/auth');
	}
};
