import { buildLockResponse, xmlWithStatus } from "../xml";
import { DAV_PREFIX } from "../path";

interface LockEntry {
  token: string;
  owner: string;
  expires: number;
}

const lockStore = new Map<string, LockEntry>();

const LOCK_TIMEOUT_SECONDS = 3600;

const cleanExpiredLocks = () => {
  const now = Date.now();
  for (const [key, entry] of lockStore) {
    if (entry.expires < now) lockStore.delete(key);
  }
};

const parseOwner = (body: string): string => {
  const match = body.match(/<[^>]*:?owner[^>]*>[\s\S]*?<[^>]*:?href[^>]*>([\s\S]*?)<\/[^>]*>/i);
  return match ? match[1].trim() : "";
};

export const handleLock = async (logicalPath: string, request: Request): Promise<Response> => {
  cleanExpiredLocks();

  const ifHeader = request.headers.get("if");
  if (ifHeader) {
    const existing = lockStore.get(logicalPath);
    if (existing && existing.expires > Date.now()) {
      const href = `${DAV_PREFIX}/${logicalPath}`;
      return xmlWithStatus(
        buildLockResponse(href, existing.token, existing.owner, LOCK_TIMEOUT_SECONDS),
        200
      );
    }
  }

  let bodyText = "";
  try {
    bodyText = await request.text();
  } catch {
    /* ignore */
  }

  const owner = parseOwner(bodyText);
  const token = `urn:uuid:${crypto.randomUUID()}`;
  const expires = Date.now() + LOCK_TIMEOUT_SECONDS * 1000;

  lockStore.set(logicalPath, { token, owner, expires });

  const href = `${DAV_PREFIX}/${logicalPath}`;
  const body = buildLockResponse(href, token, owner, LOCK_TIMEOUT_SECONDS);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Lock-Token": `<${token}>`
    }
  });
};

export const handleUnlock = (logicalPath: string, request: Request): Response => {
  const lockTokenHeader = request.headers.get("lock-token");
  if (!lockTokenHeader) return new Response("Bad Request", { status: 400 });

  const token = lockTokenHeader.replace(/^<|>$/g, "");
  const entry = lockStore.get(logicalPath);

  if (!entry || entry.token !== token) {
    return new Response("Conflict", { status: 409 });
  }

  lockStore.delete(logicalPath);
  return new Response(null, { status: 204 });
};
