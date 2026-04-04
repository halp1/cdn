import bcrypt from "bcryptjs";
import { statements } from "$lib/db";
import type { User } from "$lib/db/types";

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

export const authenticateBasic = async (authHeader: string | null): Promise<User | null> => {
  const creds = parseBasicAuth(authHeader);
  if (!creds) return null;
  const user = statements.getUserByUsername.get(creds.username);
  if (!user) return null;
  const valid = await bcrypt.compare(creds.password, user.password_hash);
  return valid ? user : null;
};

export const unauthorizedResponse = (): Response =>
  new Response("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="WebDAV"',
      "Content-Type": "text/plain"
    }
  });
