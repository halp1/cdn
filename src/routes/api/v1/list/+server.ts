import { json } from "@sveltejs/kit";
import { extractApiKeyFromHeader, validateApiKeyAccess } from "$lib/api-keys";
import { statements } from "$lib/db";
import type { RequestHandler } from "@sveltejs/kit";

export const GET: RequestHandler = async ({ request, url }) => {
  const apiKey = extractApiKeyFromHeader(request.headers.get("authorization"));
  if (!apiKey) return json({ error: "API key required" }, { status: 401 });

  const path = url.searchParams.get("path") ?? "";
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100"), 1000);

  const normalizedPath = path === "/" ? "" : path.replace(/^\//, "");
  const validation = validateApiKeyAccess(apiKey, "list", normalizedPath || "/");
  if (!validation.valid) return json({ error: validation.error }, { status: 403 });

  const files = statements.getFilesInFolder.all(normalizedPath).slice(0, limit);
  const objects = files.map((f) => ({
    key: f.path,
    size: f.size,
    contentType: f.content_type,
    createdAt: f.created_at
  }));
  return json({ success: true, path: normalizedPath, objects, count: objects.length });
};
