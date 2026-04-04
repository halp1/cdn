import { statements } from "$lib/db";

export const handleMkcol = (logicalPath: string): Response => {
  if (!logicalPath) return new Response("Forbidden", { status: 403 });

  const existing = statements.getFileByPath.get(logicalPath);
  if (existing) return new Response("Conflict", { status: 409 });

  const existingFolder = statements.folderExists.get(logicalPath);
  if (existingFolder && existingFolder.count > 0)
    return new Response("Method Not Allowed", { status: 405 });

  statements.createFolder.run(logicalPath);
  return new Response(null, { status: 201 });
};
