import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
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

export async function GET({ url, locals }) {
	if (!locals.user) {
		return new Response('Unauthorized', { status: 401 });
	}

	const key = url.searchParams.get('key');

	if (!key) {
		return new Response('Missing key parameter', { status: 400 });
	}

	try {
		const command = new GetObjectCommand({
			Bucket: R2_BUCKET_NAME,
			Key: key
		});

		const response = await S3.send(command);

		if (!response.Body) {
			return new Response('Object not found', { status: 404 });
		}

		const headers = new Headers();

		if (response.ContentType) {
			headers.set('Content-Type', response.ContentType);
		}

		if (response.ContentLength) {
			headers.set('Content-Length', response.ContentLength.toString());
		}

		const filename = key.split('/').pop();
		headers.set('Content-Disposition', `attachment; filename="${filename}"`);

		// Convert the stream to a Response
		const stream = response.Body.transformToWebStream();
		return new Response(stream, { headers });
	} catch (error) {
		console.error('Error downloading object:', error);
		return new Response('Failed to download object', { status: 500 });
	}
}
