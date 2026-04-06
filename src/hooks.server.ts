import { jwt } from "$lib/jwt";
import { statements } from "$lib/db";
import { handleWebDAV } from "$lib/webdav/handler";
import type { Handle } from "@sveltejs/kit";

const CORS_PATHS = ["/api", "/obj"];

const addCors = (response: Response) => {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "*");
  response.headers.set("Access-Control-Allow-Headers", "*");
  return response;
};

export const handle: Handle = async ({ event, resolve }) => {
  if (event.url.pathname.startsWith("/webdav")) {
    return handleWebDAV(event.request, event.url);
  }

  const isCors = CORS_PATHS.some((p) => event.url.pathname.startsWith(p));

  if (isCors && event.request.method === "OPTIONS") {
    return addCors(new Response(null, { status: 204 }));
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
  const response = await resolve(event);
  if (isCors) addCors(response);
  return response;
};
