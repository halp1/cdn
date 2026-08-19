import { getOidc } from "$lib/oidc-client";
import { handleWebDAV } from "$lib/webdav/handler";
import { seedWebDavKeyIfNeeded } from "$lib/api-keys";
import type { Handle } from "@sveltejs/kit";
import { startBackupScheduler } from "$lib/backup-server";
import { building } from "$app/environment";

if (!import.meta.env.DEV) startBackupScheduler();

const seededKey = seedWebDavKeyIfNeeded();
if (seededKey) {
  console.log(`[cdn] seeded WebDAV API key (save this): ${seededKey}`);
}

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

  if (building) {
    event.locals.user = null;
  } else {
    const oidc = await getOidc();
    event.locals.user = oidc.readSession(event);
    if (!event.locals.user) {
      event.cookies.delete("token", { path: "/" });
    }
  }
  const response = await resolve(event);
  if (isCors) addCors(response);
  return response;
};
