import { query, command, getRequestEvent } from '$app/server';
import { createApiKey, getAllApiKeys, deactivateApiKey, deleteApiKey } from '$lib/api-keys';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';

// Query to get all API keys
export const getApiKeys = query(async () => {
	const { locals } = getRequestEvent();
	
	if (!locals.user) {
		error(401, 'Unauthorized');
	}

	try {
		const apiKeys = getAllApiKeys();
		// Don't send the actual keys back, only metadata
		const sanitizedKeys = apiKeys.map((key) => ({
			id: key.id,
			name: key.name,
			permissions: key.permissions,
			scoped_paths: key.scoped_paths,
			created_at: key.created_at,
			last_used_at: key.last_used_at,
			is_active: key.is_active,
			key_preview: key.key.substring(0, 12) + '...' // Show only first 12 chars
		}));

		return { success: true, apiKeys: sanitizedKeys };
	} catch (err) {
		console.error('Error getting API keys:', err);
		error(500, 'Failed to get API keys');
	}
});

// Command to create a new API key
const CreateApiKeySchema = v.object({
	name: v.string(),
	permissions: v.array(v.picklist(['read', 'write', 'delete', 'list'])),
	scopedPaths: v.array(v.string())
});

export const createApiKeyCommand = command(CreateApiKeySchema, async (data) => {
	const { locals } = getRequestEvent();
	
	if (!locals.user) {
		error(401, 'Unauthorized');
	}

	try {
		const result = createApiKey({ 
			name: data.name, 
			permissions: data.permissions, 
			scopedPaths: data.scopedPaths 
		});

		if (result.success) {
			// Refresh the API keys list
			await getApiKeys().refresh();
			
			return {
				success: true,
				key: result.key,
				message: 'API key created successfully'
			};
		} else {
			error(400, result.error || 'Failed to create API key');
		}
	} catch (err) {
		console.error('Error creating API key:', err);
		error(500, 'Failed to create API key');
	}
});

// Command to delete/deactivate an API key
const DeleteApiKeySchema = v.object({
	id: v.number(),
	permanent: v.boolean()
});

export const deleteApiKeyCommand = command(DeleteApiKeySchema, async (data) => {
	const { locals } = getRequestEvent();
	
	if (!locals.user) {
		error(401, 'Unauthorized');
	}

	try {
		let success;
		if (data.permanent) {
			success = deleteApiKey(data.id);
		} else {
			success = deactivateApiKey(data.id);
		}

		if (success) {
			// Refresh the API keys list
			await getApiKeys().refresh();
			
			return {
				success: true,
				message: data.permanent ? 'API key deleted permanently' : 'API key deactivated'
			};
		} else {
			error(500, 'Failed to delete/deactivate API key');
		}
	} catch (err) {
		console.error('Error deleting API key:', err);
		error(500, 'Failed to delete API key');
	}
});