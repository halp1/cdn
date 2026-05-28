import type { RequestHandler } from "@sveltejs/kit";
import { zipSync } from "fflate";
import { statements } from "$lib/db";
import { getObjectBuffer } from "$lib/r2-server";

const parentDir = (path: string): string => {
  const p = path.endsWith("/") ? path.slice(0, -1) : path;
  const i = p.lastIndexOf("/");
  return i >= 0 ? p.slice(0, i + 1) : "";
};

const commonDirPrefix = (paths: string[]): string => {
  if (paths.length === 0) return "";
  const dirs = paths.map(parentDir);
  const split = dirs.map((d) => d.split("/").filter(Boolean));
  const first = split[0];
  let len = first.length;
  for (const parts of split.slice(1)) {
    let i = 0;
    while (i < len && i < parts.length && parts[i] === first[i]) i++;
    len = i;
  }
  return len > 0 ? first.slice(0, len).join("/") + "/" : "";
};

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) return new Response("Unauthorized", { status: 401 });

  let paths: string[];
  try {
    const body = await request.json();
    if (!Array.isArray(body.paths) || body.paths.some((p: unknown) => typeof p !== "string")) {
      return new Response("Invalid request", { status: 400 });
    }
    paths = body.paths as string[];
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (paths.length === 0) return new Response("No paths provided", { status: 400 });
  if (paths.length > 500) return new Response("Too many paths", { status: 400 });

  const stripPrefix =
    paths.length === 1 && paths[0].endsWith("/") ? paths[0] : commonDirPrefix(paths);

  const allFiles: { zipPath: string; record: ReturnType<typeof statements.getFileByPath.get> }[] =
    [];

  for (const p of paths) {
    if (p.endsWith("/")) {
      const folderFiles = statements.getFilesInFolder.all(p);
      for (const f of folderFiles) {
        allFiles.push({ zipPath: f.path.slice(stripPrefix.length), record: f });
      }
    } else {
      const file = statements.getFileByPath.get(p);
      if (file) allFiles.push({ zipPath: p.slice(stripPrefix.length), record: file });
    }
  }

  if (allFiles.length === 0) return new Response("No files found", { status: 404 });

  const entries: Record<string, Uint8Array> = {};
  await Promise.all(
    allFiles.map(async ({ zipPath, record }) => {
      if (!record || !zipPath) return;
      const buf = await getObjectBuffer(record.id, record.extension);
      entries[zipPath] = new Uint8Array(buf);
    })
  );

  const zip = zipSync(entries, { level: 0 });

  return new Response(zip, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="download.zip"',
      "Content-Length": zip.byteLength.toString()
    }
  });
};
