import { redirect, error } from "@sveltejs/kit";
import { statements, isPathPrivate } from "$lib/db";
import { generateDownloadUrl } from "$lib/r2-server";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params }) => {
  const { path } = params;
  if (!path) error(400, "No path specified");

  if (isPathPrivate(path)) {
    error(404, "File not found");
  }

  const file = statements.getFileByPath.get(path);
  if (!file) error(404, "File not found");

  const filename = path.split("/").pop() ?? path;
  const url = await generateDownloadUrl(file.id, file.extension, filename);
  redirect(302, url);
};
