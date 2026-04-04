import { PutObjectCommand } from "@aws-sdk/client-s3";
import { S3, R2_BUCKET_NAME } from "../r2";
import { statements } from "$lib/db";
import { sanitizeFilename } from "$lib/filename-utils";

export const handlePut = async (logicalPath: string, request: Request): Promise<Response> => {
  if (!logicalPath) return new Response("Forbidden", { status: 403 });

  const contentLengthHeader = request.headers.get("content-length");
  const contentLength = contentLengthHeader != null ? parseInt(contentLengthHeader, 10) : null;

  if (contentLength === null) {
    return new Response("Length Required", { status: 411 });
  }

  const segments = logicalPath.split("/");
  const rawFilename = segments.pop()!;
  const filename = sanitizeFilename(rawFilename);
  const parentPath = segments.join("/");
  const finalPath = parentPath ? `${parentPath}/${filename}` : filename;

  const contentType = request.headers.get("content-type") || "application/octet-stream";
  const ext = filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : "";

  const existing = statements.getFileByPath.get(finalPath);

  let fileId: string;
  if (existing) {
    fileId = existing.id;
  } else {
    fileId = crypto.randomUUID();
    statements.createFile.run(fileId, finalPath, ext, contentLength, contentType);
  }

  const r2Key = ext ? `${fileId}.${ext}` : fileId;

  try {
    await S3.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: r2Key,
        Body: request.body as ReadableStream,
        ContentLength: contentLength,
        ContentType: contentType
      })
    );
  } catch (err) {
    if (!existing) {
      statements.deleteFileByPath.run(finalPath);
    }
    return new Response("Failed to upload to storage", { status: 502 });
  }

  if (existing) {
    return new Response(null, { status: 204 });
  }
  return new Response(null, { status: 201 });
};
