import { redirect } from '@sveltejs/kit';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
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

async function listR2Objects(prefix = '') {
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
				key: obj.Key,
				size: obj.Size,
				lastModified: obj.LastModified,
				isFolder: false
			})) || [];

		const folders =
			response.CommonPrefixes?.map((prefix) => ({
				key: prefix.Prefix,
				isFolder: true
			})) || [];

		return {
			objects: [...folders, ...objects],
			prefix
		};
	} catch (error) {
		console.error('Error listing objects:', error);
		throw new Error('Failed to list objects');
	}
}

export const load = async ({ locals: { user } }) => {
	if (!user) {
		return redirect(302, '/auth');
	}

	try {
		const initialFiles = await listR2Objects();

		return {
			preload: {
				initialFiles
			}
		};
	} catch (error) {
		console.error('Error preloading files:', error);
		return {
			preload: {
				initialFiles: { objects: [], prefix: '' }
			}
		};
	}
};
