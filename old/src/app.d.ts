// See https://svelte.dev/docs/kit/types#app.d.ts

import type { jwt } from '$lib';

// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: jwt.User | null;
		}
		interface PageData {
			preload?: {
				initialFiles: {
					objects: R2Object[];
					prefix: string;
				};
			};
			user: jwt.User | null;
			env: {
				r2_url: string;
			};
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
