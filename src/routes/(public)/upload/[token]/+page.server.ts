import { error, redirect } from "@sveltejs/kit";
import { statements } from "$lib/db";
import type { PageServerLoad } from "./$types";

export const load = async ({ params }: Parameters<PageServerLoad>[0]) => {
	let { token } = params;
  if (!token) error(400, "Invalid upload link");
  token = decodeURIComponent(token);

  const link = statements.getOneTimeLink.get(token);
  if (!link) error(404, "Upload link not found or expired");

  if (link.used_count >= link.max_uploads) redirect(302, "/");

  return {
    token,
    targetPath: link.upload_path,
    expiresAt: link.expires_at,
    maxUploads: link.max_uploads,
    usedCount: link.used_count,
    remainingUploads: link.max_uploads - link.used_count
  };
};
