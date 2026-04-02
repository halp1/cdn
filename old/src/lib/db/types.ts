export interface User {
	id: number;
	username: string;
	password_hash: string;
}

export interface OneTimeLink {
	id: number;
	token: string;
	upload_path: string;
	expires_at: number;
	max_uploads: number;
	used_count: number;
	created_at: string;
}

export interface ExpireTime {
	id: number;
	object_key: string;
	timestamp: number;
}

export interface ApiKey {
	id: number;
	name: string;
	key: string;
	permissions: ApiKeyPermission[]; // Parsed from JSON
	scoped_paths: string[]; // Parsed from JSON
	created_at: string;
	last_used_at?: string;
	is_active: boolean;
}

export type ApiKeyPermission = 'read' | 'write' | 'delete' | 'list';

export interface ApiKeyCreate {
	name: string;
	permissions: ApiKeyPermission[];
	scopedPaths: string[];
}
