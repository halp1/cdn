import {
	S3Client,
	PutObjectCommand,
	ListObjectsV2Command,
	DeleteObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
	R2_ACCOUNT_ID,
	R2_ACCESS_KEY_ID,
	R2_SECRET_ACCESS_KEY,
	R2_BUCKET_NAME
} from '$env/static/private';

const S3 = new S3Client({
	region: 'auto',
	endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
	credentials: {
		accessKeyId: R2_ACCESS_KEY_ID,
		secretAccessKey: R2_SECRET_ACCESS_KEY
	}
});

/**
 * Generate a presigned upload URL for R2
 * This is the extracted logic from the internal R2 API callback
 */
export async function generateUploadUrl(key: string, contentType: string): Promise<string> {
	const command = new PutObjectCommand({
		Bucket: R2_BUCKET_NAME,
		Key: key,
		ContentType: contentType
	});

	const signedUrl = await getSignedUrl(S3, command, { expiresIn: 3600 });
	return signedUrl;
}

/**
 * List objects in a bucket path
 */
export async function listObjectsInBucket(path: string, maxKeys: number = 100) {
	// Normalize path for S3 prefix
	let prefix = path.startsWith('/') ? path.substring(1) : path;
	if (prefix && !prefix.endsWith('/')) prefix += '/';

	const command = new ListObjectsV2Command({
		Bucket: R2_BUCKET_NAME,
		Prefix: prefix,
		MaxKeys: maxKeys
	});

	try {
		const response = await S3.send(command);
		return (
			response.Contents?.map((obj) => ({
				key: obj.Key,
				size: obj.Size,
				lastModified: obj.LastModified,
				etag: obj.ETag
			})) || []
		);
	} catch (error) {
		console.error('Error listing objects:', error);
		throw error;
	}
}

/**
 * Delete an object from R2
 */
export async function deleteObjectFromBucket(key: string): Promise<boolean> {
	const command = new DeleteObjectCommand({
		Bucket: R2_BUCKET_NAME,
		Key: key
	});

	try {
		await S3.send(command);
		return true;
	} catch (error) {
		console.error('Error deleting object:', error);
		return false;
	}
}
