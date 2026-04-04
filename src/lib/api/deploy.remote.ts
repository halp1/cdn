import { command, getRequestEvent } from "$app/server";
import { error } from "@sveltejs/kit";
import { spawn } from "child_process";

export const deployCommand = command(async () => {
  const { locals } = getRequestEvent();
  if (!locals.user) error(401, "Unauthorized");
  const child = spawn("bash", ["prod.sh"], { detached: true, stdio: "ignore" });
  child.unref();
  return { success: true };
});
