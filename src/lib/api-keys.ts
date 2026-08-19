import { randomBytes } from "crypto";
import { statements } from "./db";
import type { ApiKey, ApiKeyCreate, ApiKeyPermission, ApiKeyRow } from "./db/types";

const API_KEY_PREFIX = "HALP/CDN_";
const KEY_LENGTH = 32;

const VALID_PERMISSIONS: ApiKeyPermission[] = ["read", "write", "delete", "list"];

const parseApiKeyRow = (row: ApiKeyRow): ApiKey => ({
  ...row,
  permissions: JSON.parse(row.permissions) as ApiKeyPermission[],
  scoped_paths: JSON.parse(row.scoped_paths) as string[],
  is_active: row.is_active === 1
});

export const generateApiKey = (): string =>
  `${API_KEY_PREFIX}${randomBytes(KEY_LENGTH).toString("hex")}`;

export const createApiKey = (
  data: ApiKeyCreate
): { success: boolean; key?: string; error?: string } => {
  const invalid = data.permissions.filter((p) => !VALID_PERMISSIONS.includes(p));
  if (invalid.length > 0)
    return { success: false, error: `Invalid permissions: ${invalid.join(", ")}` };
  if (data.scopedPaths.length === 0)
    return { success: false, error: "At least one scoped path is required" };

  const normalizedPaths = data.scopedPaths.map((p) => {
    if (!p.startsWith("/")) p = "/" + p;
    if (p !== "/" && p.endsWith("/")) p = p.slice(0, -1);
    return p;
  });

  const key = generateApiKey();
  try {
    statements.createApiKey.run(
      data.name,
      key,
      JSON.stringify(data.permissions),
      JSON.stringify(normalizedPaths)
    );
    return { success: true, key };
  } catch {
    return { success: false, error: "Failed to create API key" };
  }
};

export const getApiKey = (key: string): ApiKey | null => {
  const row = statements.getApiKey.get(key);
  if (!row) return null;
  return parseApiKeyRow(row);
};

export const getAllApiKeys = (): ApiKey[] => statements.getAllApiKeys.all().map(parseApiKeyRow);

export const deactivateApiKey = (id: number): boolean => {
  statements.deactivateApiKey.run(id);
  return true;
};

export const deleteApiKey = (id: number): boolean => {
  statements.deleteApiKey.run(id);
  return true;
};

export const extractApiKeyFromHeader = (authHeader: string | null): string | null => {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim() || null;
};

export const validateApiKeyAccess = (
  keyStr: string,
  permission: ApiKeyPermission,
  requestPath: string
): { valid: boolean; error?: string; apiKey?: ApiKey } => {
  const apiKey = getApiKey(keyStr);
  if (!apiKey) return { valid: false, error: "Invalid or inactive API key" };

  if (!apiKey.permissions.includes(permission)) {
    return { valid: false, error: `Missing permission: ${permission}` };
  }

  const normalizedPath = requestPath.startsWith("/") ? requestPath : "/" + requestPath;
  const hasAccess = apiKey.scoped_paths.some((scopedPath) => {
    if (scopedPath === "/") return true;
    return normalizedPath === scopedPath || normalizedPath.startsWith(scopedPath + "/");
  });

  if (!hasAccess) return { valid: false, error: "Access denied for this path" };

  statements.updateApiKeyLastUsed.run(apiKey.id);
  return { valid: true, apiKey };
};

export const seedWebDavKeyIfNeeded = (): string | null => {
  if (getAllApiKeys().length > 0) return null;
  const result = createApiKey({
    name: "webdav",
    permissions: ["read", "write", "delete", "list"],
    scopedPaths: ["/"]
  });
  return result.key ?? null;
};
