import { randomBytes } from 'crypto';
import { statements } from './db';
import type { ApiKey, ApiKeyCreate, ApiKeyPermission } from './db/types';

const API_KEY_PREFIX = 'hcdn_';
const KEY_LENGTH = 32; // bytes, will be 64 hex characters

/**
 * Generate a new API key with the hcdn_ prefix
 */
export function generateApiKey(): string {
	const randomPart = randomBytes(KEY_LENGTH).toString('hex');
	return `${API_KEY_PREFIX}${randomPart}`;
}

/**
 * Create a new API key
 */
export function createApiKey(data: ApiKeyCreate): {
	success: boolean;
	key?: string;
	error?: string;
} {
	try {
		const key = generateApiKey();

		// Validate permissions
		const validPermissions: ApiKeyPermission[] = ['read', 'write', 'delete', 'list'];
		const invalidPerms = data.permissions.filter((p) => !validPermissions.includes(p));
		if (invalidPerms.length > 0) {
			return { success: false, error: `Invalid permissions: ${invalidPerms.join(', ')}` };
		}

		// Validate scoped paths
		if (data.scopedPaths.length === 0) {
			return { success: false, error: 'At least one scoped path is required' };
		}

		// Normalize paths (ensure they start with / and don't end with / unless root)
		const normalizedPaths = data.scopedPaths.map((path) => {
			if (!path.startsWith('/')) path = '/' + path;
			if (path !== '/' && path.endsWith('/')) path = path.slice(0, -1);
			return path;
		});

		statements.createApiKey.run(
			data.name,
			key,
			JSON.stringify(data.permissions),
			JSON.stringify(normalizedPaths)
		);

		return { success: true, key };
	} catch (error) {
		console.error('Error creating API key:', error);
		return { success: false, error: 'Failed to create API key' };
	}
}

/**
 * Get an API key by key string
 */
export function getApiKey(key: string): ApiKey | null {
	try {
		const result = statements.getApiKey.get(key) as any;
		if (!result) return null;

		return {
			...result,
			permissions: JSON.parse(result.permissions),
			scoped_paths: JSON.parse(result.scoped_paths)
		};
	} catch (error) {
		console.error('Error getting API key:', error);
		return null;
	}
}

/**
 * Get all active API keys
 */
export function getAllApiKeys(): ApiKey[] {
	try {
		const results = statements.getAllApiKeys.all() as any[];
		return results.map((result) => ({
			...result,
			permissions: JSON.parse(result.permissions),
			scoped_paths: JSON.parse(result.scoped_paths)
		}));
	} catch (error) {
		console.error('Error getting API keys:', error);
		return [];
	}
}

/**
 * Update API key last used timestamp
 */
export function updateApiKeyLastUsed(key: string): void {
	try {
		statements.updateApiKeyLastUsed.run(key);
	} catch (error) {
		console.error('Error updating API key last used:', error);
	}
}

/**
 * Deactivate an API key
 */
export function deactivateApiKey(id: number): boolean {
	try {
		statements.deactivateApiKey.run(id);
		return true;
	} catch (error) {
		console.error('Error deactivating API key:', error);
		return false;
	}
}

/**
 * Delete an API key permanently
 */
export function deleteApiKey(id: number): boolean {
	try {
		statements.deleteApiKey.run(id);
		return true;
	} catch (error) {
		console.error('Error deleting API key:', error);
		return false;
	}
}

/**
 * Check if an API key has a specific permission
 */
export function hasPermission(apiKey: ApiKey, permission: ApiKeyPermission): boolean {
	return apiKey.permissions.includes(permission);
}

/**
 * Check if a path is within the API key's scoped paths
 */
export function isPathAllowed(apiKey: ApiKey, targetPath: string): boolean {
	// Normalize target path
	if (!targetPath.startsWith('/')) targetPath = '/' + targetPath;
	if (targetPath !== '/' && targetPath.endsWith('/')) targetPath = targetPath.slice(0, -1);

	return apiKey.scoped_paths.some((scopedPath) => {
		// Root path allows everything
		if (scopedPath === '/') return true;

		// Exact match or starts with scoped path + /
		return targetPath === scopedPath || targetPath.startsWith(scopedPath + '/');
	});
}

/**
 * Validate API key and check permissions/path access
 */
export function validateApiKeyAccess(
	key: string,
	permission: ApiKeyPermission,
	targetPath: string
): { valid: boolean; apiKey?: ApiKey; error?: string } {
	const apiKey = getApiKey(key);

	if (!apiKey) {
		return { valid: false, error: 'Invalid API key' };
	}

	if (!hasPermission(apiKey, permission)) {
		return { valid: false, error: `Missing ${permission} permission` };
	}

	if (!isPathAllowed(apiKey, targetPath)) {
		return { valid: false, error: 'Path not allowed for this API key' };
	}

	// Update last used timestamp
	updateApiKeyLastUsed(key);

	return { valid: true, apiKey };
}

/**
 * Extract API key from Authorization header
 */
export function extractApiKeyFromHeader(authHeader: string | null): string | null {
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return null;
	}

	const key = authHeader.substring(7); // Remove 'Bearer ' prefix

	// Validate it's a proper API key format
	if (!key.startsWith(API_KEY_PREFIX)) {
		return null;
	}

	return key;
}
