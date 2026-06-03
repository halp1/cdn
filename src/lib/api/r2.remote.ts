import { query, command, getRequestEvent } from "$app/server";
import { error } from "@sveltejs/kit";
import * as v from "valibot";
import {
  generateUploadUrl,
  generateDownloadUrl,
  deleteObject,
  getStorageStats
} from "$lib/r2-server";
import type { R2Object } from "$lib/r2-server";
import { statements, isPathPrivate } from "$lib/db";
import { sanitizeFilename } from "$lib/filename-utils";

const extractExtension = (filename: string): string => {
  const base = filename.split("/").pop() ?? filename;
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
};

export const listObjectsQuery = query(
  v.object({ prefix: v.optional(v.string(), "") }),
  async ({ prefix }) => {
    const { locals } = getRequestEvent();
    if (!locals.user) error(401, "Unauthorized");

    const pattern = prefix ? `${prefix}%` : "%";
    const files = statements.getFilesInFolder.all(prefix);
    const dbFolders = statements.getFoldersByPrefix.all(pattern);

    const fileObjects: R2Object[] = files
      .filter((f) => {
        const rel = f.path.slice(prefix.length);
        return rel.length > 0 && !rel.includes("/");
      })
      .map((f) => ({
        key: f.path,
        size: f.size,
        lastModified: new Date(f.created_at * 1000),
        isFolder: false as const,
        isPrivate: isPathPrivate(f.path),
        explicitPrivate: f.is_private
      }));

    const r2FilePaths = new Set(files.map((f) => f.path));

    const virtualFolders: R2Object[] = dbFolders
      .filter((f) => {
        if (r2FilePaths.has(f.path)) return false;
        const rel = f.path.slice(prefix.length).replace(/\/$/, "");
        return rel.length > 0 && !rel.includes("/");
      })
      .map((f) => ({
        key: f.path,
        isFolder: true as const,
        isPrivate: isPathPrivate(f.path),
        explicitPrivate: f.is_private
      }));

    const subfolderPrefixes = new Set<string>();
    for (const f of files) {
      const rel = f.path.slice(prefix.length);
      const slash = rel.indexOf("/");
      if (slash > 0) {
        subfolderPrefixes.add(prefix + rel.slice(0, slash + 1));
      }
    }
    const implicitFolders: R2Object[] = [...subfolderPrefixes]
      .filter((p) => !dbFolders.some((f) => f.path === p))
      .map((p) => ({
        key: p,
        isFolder: true as const,
        isPrivate: isPathPrivate(p),
        explicitPrivate: null
      }));

    return {
      objects: [...virtualFolders, ...implicitFolders, ...fileObjects],
      prefix
    };
  }
);

export const listAllObjectsQuery = query(async () => {
  const { locals } = getRequestEvent();
  if (!locals.user) error(401, "Unauthorized");

  const allFiles = statements.getAllFiles.all();
  const allFolders = statements.getAllFolders.all();
  const filePaths = new Set(allFiles.map((f) => f.path));

  const fileObjects: R2Object[] = allFiles.map((f) => ({
    key: f.path,
    size: f.size,
    lastModified: new Date(f.created_at * 1000),
    isFolder: false as const,
    isPrivate: isPathPrivate(f.path),
    explicitPrivate: f.is_private
  }));

  const folderObjects: R2Object[] = allFolders
    .filter((f) => !filePaths.has(f.path))
    .map((f) => ({
      key: f.path,
      isFolder: true as const,
      isPrivate: isPathPrivate(f.path),
      explicitPrivate: f.is_private
    }));

  return { objects: [...folderObjects, ...fileObjects] };
});

export const getUploadUrl = command(
  v.object({
    path: v.string(),
    contentType: v.optional(v.string(), "application/octet-stream"),
    size: v.optional(v.number(), 0)
  }),
  async ({ path, contentType, size }) => {
    const { locals } = getRequestEvent();
    if (!locals.user) error(401, "Unauthorized");

    const sanitized = sanitizeFilename(path.split("/").pop() ?? path);
    const dirPrefix = path.includes("/") ? path.slice(0, path.lastIndexOf("/") + 1) : "";
    const storedPath = dirPrefix + sanitized;

    const existing = statements.getFileByPath.get(storedPath);
    if (existing) {
      await deleteObject(existing.id, existing.extension);
      statements.deleteFileByPath.run(storedPath);
    }

    const id = crypto.randomUUID();
    const extension = extractExtension(storedPath);
    statements.createFile.run(id, storedPath, extension, size, contentType);
    const url = await generateUploadUrl(id, extension, contentType);
    return { url, storedPath };
  }
);

export const getDownloadUrl = command(v.object({ path: v.string() }), async ({ path }) => {
  const { locals } = getRequestEvent();
  if (!locals.user) error(401, "Unauthorized");

  const file = statements.getFileByPath.get(path);
  if (!file) error(404, "File not found");
  const url = await generateDownloadUrl(file.id, file.extension);
  return { url };
});

export const deleteObjectCommand = command(v.object({ path: v.string() }), async ({ path }) => {
  const { locals } = getRequestEvent();
  if (!locals.user) error(401, "Unauthorized");

  const file = statements.getFileByPath.get(path);
  if (!file) error(404, "File not found");
  await deleteObject(file.id, file.extension);
  statements.deleteExpireTime.run(file.id);
  statements.deleteFileByPath.run(path);
  return { success: true };
});

export const moveObjectCommand = command(
  v.object({ sourcePath: v.string(), destPath: v.string() }),
  async ({ sourcePath, destPath }) => {
    const { locals } = getRequestEvent();
    if (!locals.user) error(401, "Unauthorized");

    statements.moveFile.run(destPath, sourcePath);
    return { success: true };
  }
);

export const moveFolderCommand = command(
  v.object({ sourcePrefix: v.string(), destPrefix: v.string() }),
  async ({ sourcePrefix, destPrefix }) => {
    const { locals } = getRequestEvent();
    if (!locals.user) error(401, "Unauthorized");

    statements.moveFilesInFolder.run(destPrefix, sourcePrefix, sourcePrefix);

    const pattern = sourcePrefix + "%";
    const folders = statements.getFoldersByPrefix.all(pattern);
    for (const folder of folders) {
      const relativePath = folder.path.slice(sourcePrefix.length);
      const newPath = destPrefix + relativePath;
      statements.deleteFolder.run(folder.path);
      statements.createFolder.run(newPath);
    }
    return { success: true };
  }
);

export const getFolderSizeQuery = query(v.object({ prefix: v.string() }), async ({ prefix }) => {
  const { locals } = getRequestEvent();
  if (!locals.user) error(401, "Unauthorized");

  const row = statements.getFolderSizeByPrefix.get(prefix);
  return { size: row?.size ?? 0 };
});

export const getStorageStatsQuery = query(async () => {
  const { locals } = getRequestEvent();
  if (!locals.user) error(401, "Unauthorized");
  return getStorageStats();
});

export const createFolderCommand = command(v.object({ path: v.string() }), async ({ path }) => {
  const { locals } = getRequestEvent();
  if (!locals.user) error(401, "Unauthorized");
  const normalizedPath = path.endsWith("/") ? path : path + "/";
  statements.createFolder.run(normalizedPath);
  return { success: true, path: normalizedPath };
});

export const deleteFolderCommand = command(v.object({ path: v.string() }), async ({ path }) => {
  const { locals } = getRequestEvent();
  if (!locals.user) error(401, "Unauthorized");
  const normalizedPath = path.endsWith("/") ? path : path + "/";

  const filesInFolder = statements.getFilesInFolder.all(normalizedPath);
  for (const file of filesInFolder) {
    await deleteObject(file.id, file.extension);
    statements.deleteExpireTime.run(file.id);
    statements.deleteFileById.run(file.id);
  }
  const pattern = normalizedPath + "%";
  const subFolders = statements.getFoldersByPrefix.all(pattern);
  for (const sub of subFolders) {
    statements.deleteFolder.run(sub.path);
  }
  statements.deleteFolder.run(normalizedPath);
  return { success: true };
});

export const getVirtualFolders = query(
  v.object({ prefix: v.optional(v.string(), "") }),
  async ({ prefix }) => {
    const { locals } = getRequestEvent();
    if (!locals.user) error(401, "Unauthorized");
    const pattern = prefix ? `${prefix}%` : "%";
    const folders = statements.getFoldersByPrefix.all(pattern);
    return { folders };
  }
);

export const togglePrivateCommand = command(
  v.object({
    path: v.string(),
    isFolder: v.boolean(),
    isPrivate: v.nullable(v.number())
  }),
  async ({ path, isFolder, isPrivate }) => {
    const { locals } = getRequestEvent();
    if (!locals.user) error(401, "Unauthorized");

    if (isFolder) {
      const normalizedPath = path.endsWith("/") ? path : path + "/";
      statements.createFolder.run(normalizedPath);
      statements.updateFolderPrivate.run(isPrivate, normalizedPath);
    } else {
      statements.updateFilePrivate.run(isPrivate, path);
    }
    return { success: true };
  }
);
