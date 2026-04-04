import { json } from "@sveltejs/kit";
import { extractApiKeyFromHeader, validateApiKeyAccess } from "$lib/api-keys";
import { deleteObject } from "$lib/r2-server";
import { statements } from "$lib/db";
import type { RequestHandler } from "@sveltejs/kit";

export const DELETE: RequestHandler = async ({ request }) => {
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
  const { key } = body as Record<string, unknown>;
  if (typeof key !== "string") return json({ error: "key is required" }, { status: 400 });

  const pathPart = "/" + key.split("/").slice(0, -1).join("/");
  const validation = validateApiKeyAccess(apiKey, "delete", pathPart);
  if (!validation.valid) return json({ error: validation.error }, { status: 403 });

  const file = statements.getFileByPath.get(key);
  if (!file) return json({ error: "File not found" }, { status: 404 });

  await deleteObject(file.id, file.extension);
  statements.deleteExpireTime.run(file.id);
  statements.deleteFileByPath.run(key);
  return json({ success: true });
};
