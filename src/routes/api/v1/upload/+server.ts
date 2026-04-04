import { json } from "@sveltejs/kit";
import { extractApiKeyFromHeader, validateApiKeyAccess } from "$lib/api-keys";
import { generateUploadUrl } from "$lib/r2-server";
import { statements } from "$lib/db";
import { sanitizeFilename } from "$lib/filename-utils";
import type { RequestHandler } from "@sveltejs/kit";

export const POST: RequestHandler = async ({ request }) => {
  const apiKey = extractApiKeyFromHeader(request.headers.get("authorization"));
  if (!apiKey) return json({ error: "API key required" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null)
    return json({ error: "Invalid body" }, { status: 400 });
  const { path, filename, fileType } = body as Record<string, unknown>;

  if (typeof path !== "string" || typeof filename !== "string") {
    return json({ error: "path and filename are required" }, { status: 400 });
  }

  const validation = validateApiKeyAccess(apiKey, "write", path);
  if (!validation.valid) return json({ error: validation.error }, { status: 403 });

  const sanitizedFilename = sanitizeFilename(filename);
  const targetPath = path.endsWith("/") ? path : path + "/";
  const fileKey = targetPath + sanitizedFilename;
  const resolvedType = typeof fileType === "string" ? fileType : "application/octet-stream";
  const resolvedSize =
    typeof (body as Record<string, unknown>).size === "number"
      ? ((body as Record<string, unknown>).size as number)
      : 0;

  const id = crypto.randomUUID();
  const ext = sanitizedFilename.includes(".")
    ? sanitizedFilename.split(".").pop()!.toLowerCase()
    : "";
  statements.createFile.run(id, fileKey, ext, resolvedSize, resolvedType);
  const uploadUrl = await generateUploadUrl(id, ext, resolvedType);

  return json({
    success: true,
    uploadUrl,
    fileKey,
    originalName: filename,
    sanitizedName: sanitizedFilename
  });
};
