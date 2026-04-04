import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { S3, R2_BUCKET_NAME } from "../r2";
import { statements } from "$lib/db";
import type { FileRecord, Folder } from "$lib/db/types";

export const handleDelete = async (logicalPath: string): Promise<Response> => {
  if (!logicalPath) return new Response("Forbidden", { status: 403 });

  const file = statements.getFileByPath.get(logicalPath);
  if (file) {
    const r2Key = file.extension ? `${file.id}.${file.extension}` : file.id;
    try {
      await S3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: r2Key }));
    } catch {
      return new Response("Failed to delete from storage", { status: 502 });
    }
    statements.deleteExpireTime.run(file.id);
    statements.deleteFileByPath.run(logicalPath);
    return new Response(null, { status: 204 });
  }

  const folders = statements.getFoldersByPrefix.all(logicalPath + "%") as Folder[];
  const exactFolder = folders.find((f) => f.path === logicalPath);
  if (!exactFolder) return new Response("Not Found", { status: 404 });

  const children = statements.getAllFiles.all() as FileRecord[];
  const toDelete = children.filter(
    (f) => f.path === logicalPath || f.path.startsWith(logicalPath + "/")
  );

  const deleteOps = toDelete.map(async (f) => {
    const r2Key = f.extension ? `${f.id}.${f.extension}` : f.id;
    await S3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: r2Key }));
    statements.deleteExpireTime.run(f.id);
    statements.deleteFileByPath.run(f.path);
  });

  await Promise.all(deleteOps);

  for (const folder of folders) {
    if (folder.path === logicalPath || folder.path.startsWith(logicalPath + "/")) {
      statements.deleteFolder.run(folder.path);
    }
  }

  return new Response(null, { status: 204 });
};
