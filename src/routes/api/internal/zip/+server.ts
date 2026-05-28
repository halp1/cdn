import type { RequestHandler } from "@sveltejs/kit";
import { zipSync } from "fflate";
import { statements } from "$lib/db";
import { getObjectBuffer } from "$lib/r2-server";

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

  const allFiles: { zipPath: string; record: ReturnType<typeof statements.getFileByPath.get> }[] =
    [];

  for (const p of paths) {
    if (p.endsWith("/")) {
      const folderFiles = statements.getFilesInFolder.all(p);
      for (const f of folderFiles) {
        allFiles.push({ zipPath: f.path, record: f });
      }
    } else {
      const file = statements.getFileByPath.get(p);
      if (file) allFiles.push({ zipPath: p, record: file });
    }
  }

  if (allFiles.length === 0) return new Response("No files found", { status: 404 });

  const entries: Record<string, Uint8Array> = {};
  await Promise.all(
    allFiles.map(async ({ zipPath, record }) => {
      if (!record) return;
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
