import { jwt } from "$lib/jwt";
import { statements } from "$lib/db";
import { handleWebDAV } from "$lib/webdav/handler";
import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
  if (event.url.pathname.startsWith("/webdav")) {
    return handleWebDAV(event.request, event.url);
  }

  event.locals.user = null;
  const token = event.cookies.get("token");
  if (token) {
    const user = jwt.verify(token);
    if (user) {
      const dbUser = statements.getUserByUsername.get(user.username);
      if (dbUser) {
        event.locals.user = user;
      } else {
        event.cookies.delete("token", { path: "/" });
      }
    } else {
      event.cookies.delete("token", { path: "/" });
    }
  }
  return resolve(event);
};
