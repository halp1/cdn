import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectCommand,
  PutObjectCommand,
  CopyObjectCommand,
  GetObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_S3_ENDPOINT
} from "$env/static/private";

export const S3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY
  }
});

const S3Stats = new S3Client({
  region: "auto",
  endpoint: R2_S3_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY
  }
});

export interface R2Object {
  key: string;
  size?: number;
  lastModified?: Date;
  isFolder: boolean;
  isPrivate?: boolean;
  explicitPrivate?: number | null;
}

export interface R2ListResult {
  objects: R2Object[];
  prefix: string;
}

export interface R2StorageStats {
  totalSize: number;
  objectCount: number;
}

export const buildR2Key = (id: string, extension?: string): string =>
  extension ? `${id}.${extension}` : id;

export const generateUploadUrl = async (
  id: string,
  extension: string,
  contentType: string
): Promise<string> =>
  getSignedUrl(
    S3,
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: buildR2Key(id, extension),
      ContentType: contentType
    }),
    { expiresIn: 3600 }
  );

export const generateDownloadUrl = async (
  id: string,
  extension: string,
  filename?: string
): Promise<string> =>
  getSignedUrl(
    S3,
    new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: buildR2Key(id, extension),
      ...(filename ? { ResponseContentDisposition: `inline; filename="${filename}"` } : {})
    }),
    { expiresIn: 3600 }
  );

export const getObjectBuffer = async (id: string, extension: string): Promise<Buffer> => {
  const result = await S3.send(
    new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: buildR2Key(id, extension) })
  );
  const chunks: Uint8Array[] = [];
  for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

export const deleteObject = async (id: string, extension: string): Promise<void> => {
  await S3.send(
    new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: buildR2Key(id, extension) })
  );
};

export const listAllObjects = async (): Promise<R2Object[]> => {
  const objects: R2Object[] = [];
  let continuationToken: string | undefined;
  do {
    const result = await S3.send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
        ContinuationToken: continuationToken,
        MaxKeys: 1000
      })
    );
    for (const obj of result.Contents ?? []) {
      objects.push({
        key: obj.Key!,
        size: obj.Size,
        lastModified: obj.LastModified,
        isFolder: false
      });
    }
    continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
  } while (continuationToken);
  return objects;
};

export const copyObject = async (sourceKey: string, destinationKey: string): Promise<void> => {
  await S3.send(
    new CopyObjectCommand({
      Bucket: R2_BUCKET_NAME,
      CopySource: `${R2_BUCKET_NAME}/${encodeURIComponent(sourceKey)}`,
      Key: destinationKey
    })
  );
};

export const getStorageStats = async (): Promise<R2StorageStats> => {
  let totalSize = 0;
  let objectCount = 0;
  let continuationToken: string | undefined;

  do {
    const result = await S3Stats.send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
        ContinuationToken: continuationToken,
        MaxKeys: 1000
      })
    );
    for (const obj of result.Contents ?? []) {
      totalSize += obj.Size ?? 0;
      objectCount++;
    }
    continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
  } while (continuationToken);

  return { totalSize, objectCount };
};
