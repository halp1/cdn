import { query, command, getRequestEvent } from "$app/server";
import { error } from "@sveltejs/kit";
import * as v from "valibot";
import { statements } from "$lib/db";

export const getUploadLinks = query(async () => {
  const { locals } = getRequestEvent();
  if (!locals.user) error(401, "Unauthorized");
  statements.deleteExpiredOneTimeLinks.run();
  return { links: statements.getAllOneTimeLinks.all() };
});

export const createUploadLink = command(
  v.object({
    upload_path: v.string(),
    expires_in_hours: v.optional(v.number(), 24),
    max_uploads: v.optional(v.number(), 1)
  }),
  async ({ upload_path, expires_in_hours, max_uploads }) => {
    const { locals } = getRequestEvent();
    if (!locals.user) error(401, "Unauthorized");
    if (max_uploads < 1 || max_uploads > 100) error(400, "Max uploads must be 1–100");

    const expiresAt = Math.floor(Date.now() / 1000) + expires_in_hours * 3600;
    const token = crypto.randomUUID();
    statements.createOneTimeLink.run(token, upload_path, expiresAt, max_uploads);
    await getUploadLinks().refresh();
    return { success: true, token, upload_url: `/upload/${token}`, expires_at: expiresAt };
  }
);

export const deleteUploadLink = command(v.object({ token: v.string() }), async ({ token }) => {
  const { locals } = getRequestEvent();
  if (!locals.user) error(401, "Unauthorized");
  statements.deleteOneTimeLink.run(token);
  await getUploadLinks().refresh();
  return { success: true };
});
