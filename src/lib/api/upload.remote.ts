import { command, getRequestEvent } from "$app/server";
import { error } from "@sveltejs/kit";
import * as v from "valibot";
import { statements } from "$lib/db";
import { generateUploadUrl } from "$lib/r2-server";
import { sanitizeFilename } from "$lib/filename-utils";

const extractExtension = (filename: string): string => {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(dot + 1).toLowerCase() : "";
};

export const getPresignedUploadUrl = command(
  v.object({
    token: v.string(),
    filename: v.string(),
    fileType: v.optional(v.string(), "application/octet-stream"),
    size: v.optional(v.number(), 0)
  }),
  async ({ token, filename, fileType, size }) => {
    const link = statements.getOneTimeLink.get(token);
    if (!link) error(404, "Invalid or expired upload link");
    if (link.used_count >= link.max_uploads) error(403, "Upload limit reached");

    const sanitizedFilename = sanitizeFilename(filename);
    const targetPath = link.upload_path.endsWith("/") ? link.upload_path : link.upload_path + "/";
    const storedPath = targetPath + sanitizedFilename;

    const id = crypto.randomUUID();
    const extension = extractExtension(sanitizedFilename);
    statements.createFile.run(id, storedPath, extension, size, fileType);
    const uploadUrl = await generateUploadUrl(id, extension, fileType);

    return { success: true, uploadUrl, storedPath, sanitizedName: sanitizedFilename };
  }
);

export const confirmUpload = command(v.object({ token: v.string() }), async ({ token }) => {
  const link = statements.getOneTimeLink.get(token);
  if (!link) error(404, "Invalid or expired upload link");

  statements.incrementUploadCount.run(token);

  const updatedLink = statements.getOneTimeLink.get(token);
  if (!updatedLink || updatedLink.used_count >= updatedLink.max_uploads) {
    statements.deleteOneTimeLink.run(token);
  }

  return { success: true };
});
