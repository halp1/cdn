import { GetObjectCommand } from "@aws-sdk/client-s3";
import type { GetObjectCommandOutput } from "@aws-sdk/client-s3";
import { S3, R2_BUCKET_NAME } from "../r2";
import { statements } from "$lib/db";

export const handleGet = async (logicalPath: string, headOnly: boolean): Promise<Response> => {
  if (!logicalPath) return new Response("Not Found", { status: 404 });

  const file = statements.getFileByPath.get(logicalPath);
  if (!file) return new Response("Not Found", { status: 404 });

  const r2Key = file.extension ? `${file.id}.${file.extension}` : file.id;

  let result: GetObjectCommandOutput;
  try {
    result = await S3.send(new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: r2Key }));
  } catch {
    return new Response("Not Found", { status: 404 });
  }

  const headers: Record<string, string> = {
    "Content-Type": file.content_type || "application/octet-stream",
    "Accept-Ranges": "bytes",
    ETag: `"${file.id}"`
  };

  if (file.size > 0) {
    headers["Content-Length"] = String(file.size);
  } else if (result.ContentLength != null) {
    headers["Content-Length"] = String(result.ContentLength);
  }

  if (headOnly) {
    return new Response(null, { status: 200, headers });
  }

  const stream = result.Body?.transformToWebStream();
  if (!stream) return new Response("File unavailable", { status: 502 });

  return new Response(stream, { status: 200, headers });
};
