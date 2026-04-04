import { query, command, getRequestEvent } from "$app/server";
import { error } from "@sveltejs/kit";
import * as v from "valibot";
import { createApiKey, getAllApiKeys, deactivateApiKey, deleteApiKey } from "$lib/api-keys";

export const getApiKeys = query(async () => {
  const { locals } = getRequestEvent();
  if (!locals.user) error(401, "Unauthorized");
  return {
    apiKeys: getAllApiKeys().map((k) => ({
      id: k.id,
      name: k.name,
      permissions: k.permissions,
      scoped_paths: k.scoped_paths,
      created_at: k.created_at,
      last_used_at: k.last_used_at,
      is_active: k.is_active,
      key_preview: k.key.substring(0, 5) + "•••"
    }))
  };
});

export const createApiKeyCommand = command(
  v.object({
    name: v.string(),
    permissions: v.array(v.picklist(["read", "write", "delete", "list"])),
    scopedPaths: v.array(v.string())
  }),
  async (data) => {
    const { locals } = getRequestEvent();
    if (!locals.user) error(401, "Unauthorized");
    const result = createApiKey(data);
    if (!result.success) error(400, result.error ?? "Failed to create API key");
    await getApiKeys().refresh();
    return { success: true, key: result.key! };
  }
);

export const deleteApiKeyCommand = command(
  v.object({ id: v.number(), permanent: v.boolean() }),
  async ({ id, permanent }) => {
    const { locals } = getRequestEvent();
    if (!locals.user) error(401, "Unauthorized");
    if (permanent) deleteApiKey(id);
    else deactivateApiKey(id);
    await getApiKeys().refresh();
    return { success: true };
  }
);
