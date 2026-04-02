import { query, command, getRequestEvent } from '$app/server';
import {
	S3Client,
	ListObjectsV2Command,
	DeleteObjectCommand,
	PutObjectCommand,
	CopyObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
	R2_ACCOUNT_ID,
	R2_ACCESS_KEY_ID,
	R2_SECRET_ACCESS_KEY,
	R2_BUCKET_NAME,
	R2_S3_ENDPOINT
} from '$env/static/private';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';

const S3 = new S3Client({
	region: 'auto',
	endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
	credentials: {
		accessKeyId: R2_ACCESS_KEY_ID,
		secretAccessKey: R2_SECRET_ACCESS_KEY
	}
});

const S3Stats = new S3Client({
	region: 'auto',
	endpoint: R2_S3_ENDPOINT,
	credentials: {
		accessKeyId: R2_ACCESS_KEY_ID,
		secretAccessKey: R2_SECRET_ACCESS_KEY
	}
});

// Query to list R2 objects
const ListObjectsSchema = v.object({
	prefix: v.optional(v.string())
});

export const listObjects = query(ListObjectsSchema, async (data) => {
	const { locals } = getRequestEvent();
	
	if (!locals.user) {
		error(401, 'Unauthorized');
	}

	const prefix = data?.prefix || '';
	const delimiter = '/';

	try {
		const command = new ListObjectsV2Command({
			Bucket: R2_BUCKET_NAME,
			Prefix: prefix,
			Delimiter: delimiter
		});

		const response = await S3.send(command);

		const objects =
			response.Contents?.map((obj) => ({
				key: obj.Key!,
				size: obj.Size,
				lastModified: obj.LastModified,
				isFolder: false
			})) || [];

		const folders =
			response.CommonPrefixes?.map((prefix) => ({
				key: prefix.Prefix!,
				isFolder: true
			})) || [];

		return {
			objects: [...folders, ...objects],
			prefix
		};
	} catch (err) {
		console.error('Error listing objects:', err);
		error(500, 'Failed to list objects');
	}
});

// Command to get upload URL
const GetUploadUrlSchema = v.object({
	key: v.string(),
	type: v.string()
});

export const getUploadUrl = command(GetUploadUrlSchema, async (data) => {
	const { locals } = getRequestEvent();
	
	if (!locals.user) {
		error(401, 'Unauthorized');
	}

	try {
		const command = new PutObjectCommand({
			Bucket: R2_BUCKET_NAME,
			Key: data.key,
			ContentType: data.type
		});

		const signedUrl = await getSignedUrl(S3, command, { expiresIn: 3600 });
		return { url: signedUrl };
	} catch (err) {
		console.error('Error generating signed URL:', err);
		error(500, 'Failed to generate upload URL');
	}
});

// Command to delete an object
const DeleteObjectSchema = v.object({
	key: v.string()
});

export const deleteObject = command(DeleteObjectSchema, async (data) => {
	const { locals } = getRequestEvent();
	
	if (!locals.user) {
		error(401, 'Unauthorized');
	}

	try {
		const command = new DeleteObjectCommand({
			Bucket: R2_BUCKET_NAME,
			Key: data.key
		});

		await S3.send(command);
		return { success: true };
	} catch (err) {
		console.error('Error deleting object:', err);
		error(500, 'Failed to delete object');
	}
});

// Command to move an object
const MoveObjectSchema = v.object({
	sourceKey: v.string(),
	destinationKey: v.string()
});

export const moveObject = command(MoveObjectSchema, async (data) => {
	const { locals } = getRequestEvent();
	
	if (!locals.user) {
		error(401, 'Unauthorized');
	}

	try {
		console.log('Server: Moving from', data.sourceKey, 'to', data.destinationKey);

		// 1. Copy the object to the new location
		const copyCommand = new CopyObjectCommand({
			Bucket: R2_BUCKET_NAME,
			CopySource: `${R2_BUCKET_NAME}/${encodeURIComponent(data.sourceKey)}`,
			Key: data.destinationKey
		});

		console.log('Executing copy command:', copyCommand);
		await S3.send(copyCommand);

		// 2. Delete the original object
		const deleteCommand = new DeleteObjectCommand({
			Bucket: R2_BUCKET_NAME,
			Key: data.sourceKey
		});

		console.log('Executing delete command:', deleteCommand);
		await S3.send(deleteCommand);

		return { success: true };
	} catch (err) {
		console.error('Error moving object:', err);
		const errorMsg = err instanceof Error ? err.message : 'Unknown error';
		error(500, 'Failed to move object: ' + errorMsg);
	}
});

// Query to get storage stats
export const getStorageStats = query(async () => {
	const { locals } = getRequestEvent();
	
	if (!locals.user) {
		error(401, 'Unauthorized');
	}

	try {
		let totalSize = 0;
		let objectCount = 0;
		let continuationToken: string | undefined;

		do {
			const command = new ListObjectsV2Command({
				Bucket: R2_BUCKET_NAME,
				ContinuationToken: continuationToken,
				MaxKeys: 1000 // Process in chunks to avoid memory issues
			});

			const response = await S3Stats.send(command);

			if (response.Contents) {
				for (const object of response.Contents) {
					if (object.Size) {
						totalSize += object.Size;
					}
					objectCount++;
				}
			}

			continuationToken = response.NextContinuationToken;
		} while (continuationToken);

		return {
			totalSize,
			objectCount,
			lastUpdated: new Date().toISOString()
		};
	} catch (err) {
		console.error('Error calculating storage stats:', err);
		error(500, 'Failed to fetch storage statistics');
	}
});

// Query to get folder size
const GetFolderSizeSchema = v.object({
	prefix: v.string()
});

export const getFolderSize = query(GetFolderSizeSchema, async (data) => {
	const { locals } = getRequestEvent();
	
	if (!locals.user) {
		error(401, 'Unauthorized');
	}

	try {
		let totalSize = 0;
		let continuationToken = undefined;

		// We need to recursively list all objects with the given prefix
		do {
			const command: ListObjectsV2Command = new ListObjectsV2Command({
				Bucket: R2_BUCKET_NAME,
				Prefix: data.prefix,
				ContinuationToken: continuationToken
			});

			const response = await S3.send(command);

			// Sum up the sizes of all objects
			if (response.Contents) {
				for (const obj of response.Contents) {
					totalSize += obj.Size || 0;
				}
			}

			continuationToken = response.NextContinuationToken;
		} while (continuationToken);

		return {
			folderSize: totalSize,
			prefix: data.prefix
		};
	} catch (err) {
		console.error('Error calculating folder size:', err);
		error(500, 'Failed to calculate folder size');
	}
});