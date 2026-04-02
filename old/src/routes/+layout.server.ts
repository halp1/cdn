import { R2_URL } from '$env/static/private';

export const load = async ({ locals: { user } }) => {
	return {
		user,
		env: {
			r2_url: R2_URL
		}
	};
};
