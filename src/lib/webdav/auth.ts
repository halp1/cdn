import { getApiKey, validateApiKeyAccess } from "$lib/api-keys";
import type { ApiKeyPermission } from "$lib/db/types";

export const parseBasicAuth = (
  authHeader: string | null
): { username: string; password: string } | null => {
  if (!authHeader?.startsWith("Basic ")) return null;
  const encoded = authHeader.slice(6).trim();
  let decoded: string;
  try {
    decoded = Buffer.from(encoded, "base64").toString("utf-8");
  } catch {
    return null;
  }
  const colonIdx = decoded.indexOf(":");
  if (colonIdx === -1) return null;
  return {
    username: decoded.slice(0, colonIdx),
    password: decoded.slice(colonIdx + 1)
  };
};

const extractApiKey = (creds: { username: string; password: string }): string => {
  if (creds.password.startsWith("HALP/CDN_")) return creds.password;
  if (creds.username.startsWith("HALP/CDN_")) return creds.username;
  return creds.password;
};

const permissionsFor = (method: string): ApiKeyPermission[] => {
  switch (method) {
    case "GET":
    case "HEAD":
      return ["read"];
    case "PROPFIND":
      return ["list", "read"];
    case "DELETE":
      return ["delete"];
    case "PUT":
    case "MKCOL":
    case "COPY":
    case "MOVE":
    case "LOCK":
    case "UNLOCK":
    case "PROPPATCH":
      return ["write"];
    default:
      return [];
  }
};

const pathAllowed = (key: string, permissions: ApiKeyPermission[], requestPath: string) =>
  permissions.some((permission) => validateApiKeyAccess(key, permission, requestPath).valid);

export const authenticateWebDav = (
  authHeader: string | null,
  method: string,
  logicalPath: string,
  destPath: string | null
): { ok: true } | { ok: false; status: 401 | 403 } => {
  const creds = parseBasicAuth(authHeader);
  if (!creds) return { ok: false, status: 401 };

  const key = extractApiKey(creds);
  if (!getApiKey(key)) return { ok: false, status: 401 };

  const permissions = permissionsFor(method);
  if (permissions.length === 0) return { ok: false, status: 403 };

  const requestPath = logicalPath ? `/${logicalPath}` : "/";
  if (!pathAllowed(key, permissions, requestPath)) return { ok: false, status: 403 };

  if ((method === "MOVE" || method === "COPY") && destPath !== null) {
    const dest = destPath ? `/${destPath}` : "/";
    if (!pathAllowed(key, ["write"], dest)) return { ok: false, status: 403 };
  }

  return { ok: true };
};

export const unauthorizedResponse = (): Response =>
  new Response("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="WebDAV"',
      "Content-Type": "text/plain"
    }
  });
