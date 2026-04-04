import { CopyObjectCommand } from "@aws-sdk/client-s3";
import { S3, R2_BUCKET_NAME } from "../r2";
import { statements } from "$lib/db";
import type { FileRecord, Folder } from "$lib/db/types";
import { parseDestinationHeader } from "../path";

const copyFile = async (sourceFile: FileRecord, destPath: string): Promise<void> => {
  const sourceKey = sourceFile.extension
    ? `${sourceFile.id}.${sourceFile.extension}`
    : sourceFile.id;
  const newId = crypto.randomUUID();
  const destKey = sourceFile.extension ? `${newId}.${sourceFile.extension}` : newId;

  await S3.send(
    new CopyObjectCommand({
      Bucket: R2_BUCKET_NAME,
      CopySource: `${R2_BUCKET_NAME}/${encodeURIComponent(sourceKey)}`,
      Key: destKey
    })
  );

  statements.createFile.run(
    newId,
    destPath,
    sourceFile.extension,
    sourceFile.size,
    sourceFile.content_type
  );
};

export const handleCopy = async (logicalPath: string, request: Request): Promise<Response> => {
  if (!logicalPath) return new Response("Forbidden", { status: 403 });

  const destinationHeader = request.headers.get("destination");
  if (!destinationHeader) return new Response("Bad Request", { status: 400 });

  const overwrite = request.headers.get("overwrite") !== "F";
  const destPath = parseDestinationHeader(destinationHeader, "");
  if (destPath === null) return new Response("Bad Request", { status: 400 });
  if (destPath === logicalPath) return new Response("Forbidden", { status: 403 });

  const sourceFile = statements.getFileByPath.get(logicalPath);
  if (sourceFile) {
    const existing = statements.getFileByPath.get(destPath);
    if (existing) {
      if (!overwrite) return new Response("Precondition Failed", { status: 412 });
      statements.deleteFileByPath.run(destPath);
    }
    try {
      await copyFile(sourceFile, destPath);
    } catch {
      return new Response("Failed to copy in storage", { status: 502 });
    }
    return new Response(null, { status: existing ? 204 : 201 });
  }

  const folders = statements.getFoldersByPrefix.all(logicalPath + "%") as Folder[];
  const exactFolder = folders.find((f) => f.path === logicalPath);
  if (!exactFolder) return new Response("Not Found", { status: 404 });

  const allFiles = statements.getAllFiles.all() as FileRecord[];
  const toСopy = allFiles.filter(
    (f) => f.path === logicalPath || f.path.startsWith(logicalPath + "/")
  );

  try {
    await Promise.all(
      toСopy.map((f) => {
        const newPath = destPath + f.path.slice(logicalPath.length);
        return copyFile(f, newPath);
      })
    );
  } catch {
    return new Response("Failed to copy files in storage", { status: 502 });
  }

  statements.createFolder.run(destPath);
  for (const folder of folders) {
    if (folder.path !== logicalPath && folder.path.startsWith(logicalPath + "/")) {
      const newFolderPath = destPath + folder.path.slice(logicalPath.length);
      statements.createFolder.run(newFolderPath);
    }
  }

  return new Response(null, { status: 201 });
};
