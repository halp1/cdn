import { JWT_SECRET } from '$env/static/private';
import { createHmac } from 'node:crypto';

export namespace jwt {
	export const secret = JWT_SECRET;

	export interface User {
		username: string;
	}

	export const sign = (p: User): string => {
		const header = JSON.stringify({ alg: 'HS256', typ: 'JWT' });
		const payload = JSON.stringify({ username: p.username });
		const signature = createHmac('sha256', secret)
			.update(`${header}.${payload}`)
			.digest('base64url');
		return `${header}.${payload}.${signature}`;
	};

	export const verify = (token: string): User | null => {
		const [header, payload, signature] = token.split('.');
		if (!header || !payload || !signature) return null;
		const expected = createHmac('sha256', secret)
			.update(`${header}.${payload}`)
			.digest('base64url');
		if (signature !== expected) return null;
		try {
			const data = JSON.parse(payload);
			if (typeof data.username !== 'string') return null;
			return { username: data.username };
		} catch {
			return null;
		}
	};
}
