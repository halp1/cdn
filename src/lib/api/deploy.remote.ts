import { query, getRequestEvent } from "$app/server";
import { error } from "@sveltejs/kit";
import { execSync } from "child_process";

export const getCurrentCommitQuery = query(async () => {
  const { locals } = getRequestEvent();
  if (!locals.user) error(401, "Unauthorized");
  try {
    const hash = execSync("git rev-parse --short HEAD", { stdio: "pipe" }).toString().trim();
    const message = execSync("git log -1 --format=%s", { stdio: "pipe" }).toString().trim();
    return { hash, message };
  } catch {
    return { hash: "", message: "" };
  }
});
