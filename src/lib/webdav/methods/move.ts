import { statements } from "$lib/db";
import type { FileRecord, Folder } from "$lib/db/types";
import { parseDestinationHeader } from "../path";

export const handleMove = (logicalPath: string, request: Request): Response => {
  if (!logicalPath) return new Response("Forbidden", { status: 403 });

  const destinationHeader = request.headers.get("destination");
  if (!destinationHeader) return new Response("Bad Request", { status: 400 });

  const overwrite = request.headers.get("overwrite") !== "F";
  const destPath = parseDestinationHeader(destinationHeader, "");
  if (destPath === null) return new Response("Bad Request", { status: 400 });
  if (destPath === logicalPath) return new Response("Forbidden", { status: 403 });

  const sourceFile = statements.getFileByPath.get(logicalPath);
  if (sourceFile) {
    const destFile = statements.getFileByPath.get(destPath);
    if (destFile) {
      if (!overwrite) return new Response("Precondition Failed", { status: 412 });
      statements.deleteFileByPath.run(destPath);
    }
    statements.moveFile.run(destPath, logicalPath);
    return new Response(null, { status: destFile ? 204 : 201 });
  }

  const folders = statements.getFoldersByPrefix.all(logicalPath + "%") as Folder[];
  const exactFolder = folders.find((f) => f.path === logicalPath);
  if (!exactFolder) return new Response("Not Found", { status: 404 });

  const destFolderCheck = statements.folderExists.get(destPath);
  if (destFolderCheck && destFolderCheck.count > 0) {
    if (!overwrite) return new Response("Precondition Failed", { status: 412 });
  }

  const allFiles = statements.getAllFiles.all() as FileRecord[];
  const toMove = allFiles.filter(
    (f) => f.path === logicalPath || f.path.startsWith(logicalPath + "/")
  );

  for (const f of toMove) {
    const newPath = destPath + f.path.slice(logicalPath.length);
    statements.moveFile.run(newPath, f.path);
  }

  for (const folder of folders) {
    if (folder.path === logicalPath || folder.path.startsWith(logicalPath + "/")) {
      const newFolderPath = destPath + folder.path.slice(logicalPath.length);
      statements.deleteFolder.run(folder.path);
      statements.createFolder.run(newFolderPath);
    }
  }

  return new Response(null, { status: 201 });
};
