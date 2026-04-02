import { error, isRedirect, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { jwt } from '$lib';
import { statements } from '$lib/db';

export const load = async ({ cookies, locals: { user } }) => {
	if (user) {
		return redirect(302, '/'); // User is already logged in
	}

	// Check if there are any users in the database
	const userCount = (statements as any).getUserCount.get() as { count: number };
	const isFirstUser = userCount.count === 0;

	return {
		isFirstUser
	};
};

async function hashPassword(username: string, password: string): Promise<string> {
	const hash = await crypto.subtle.digest(
		'SHA-256',
		new TextEncoder().encode(`${username}:${password}`)
	);
	return Buffer.from(hash).toString('hex');
}

export const actions: Actions = {
	login: async ({ request, cookies }) => {
		const body = await request.formData();

		const username = body.get('username') as string;
		const password = body.get('password') as string;

		if (
			typeof username !== 'string' ||
			typeof password !== 'string' ||
			username.trim() === '' ||
			password.trim() === ''
		) {
			return {
				success: false,
				message: 'Username and password are required.',
				username: username?.trim() || '',
				password: '',
				action: 'login'
			};
		}

		const user = statements.getUserByUsername.get(username.trim()) as any;

		if (!user) {
			console.log(`Invalid login attempt for user: ${username}`);
			return {
				success: false,
				message: 'Invalid username or password.',
				username: username.trim(),
				password: '',
				action: 'login'
			};
		}

		const passwordHash = await hashPassword(username.trim(), password);

		if (user.password_hash !== passwordHash) {
			console.log(`Invalid password for user: ${username}`);
			return {
				success: false,
				message: 'Invalid username or password.',
				username: username.trim(),
				password: '',
				action: 'login'
			};
		}

		const token = jwt.sign({ username: username.trim() });
		cookies.set('token', token, { httpOnly: true, path: '/' });
		return redirect(302, '/');
	},

	register: async ({ request, cookies }) => {
		const body = await request.formData();

		const username = body.get('username') as string;
		const password = body.get('password') as string;
		const confirmPassword = body.get('confirmPassword') as string;

		if (
			typeof username !== 'string' ||
			typeof password !== 'string' ||
			typeof confirmPassword !== 'string' ||
			username.trim() === '' ||
			password.trim() === '' ||
			confirmPassword.trim() === ''
		) {
			return {
				success: false,
				message: 'All fields are required.',
				username: username?.trim() || '',
				password: '',
				confirmPassword: '',
				action: 'register'
			};
		}

		if (password !== confirmPassword) {
			return {
				success: false,
				message: 'Passwords do not match.',
				username: username.trim(),
				password: '',
				confirmPassword: '',
				action: 'register'
			};
		}

		// Check if there are already users (only allow registration if no users exist)
		const userCount = (statements as any).getUserCount.get() as { count: number };
		if (userCount.count > 0) {
			return {
				success: false,
				message: 'Registration is not allowed.',
				username: username.trim(),
				password: '',
				confirmPassword: '',
				action: 'register'
			};
		}

		// Check if username already exists
		const existingUser = statements.getUserByUsername.get(username.trim()) as any;
		if (existingUser) {
			return {
				success: false,
				message: 'Username already exists.',
				username: username.trim(),
				password: '',
				confirmPassword: '',
				action: 'register'
			};
		}

		try {
			const passwordHash = await hashPassword(username.trim(), password);
			statements.createUser.run(username.trim(), passwordHash);

			const token = jwt.sign({ username: username.trim() });
			cookies.set('token', token, { httpOnly: true, path: '/' });
			return redirect(302, '/');
		} catch (err) {
			if (isRedirect(err)) throw err;
			console.error('Error creating user:', err);
			return {
				success: false,
				message: 'Failed to create account.',
				username: username.trim(),
				password: '',
				confirmPassword: '',
				action: 'register'
			};
		}
	}
};
