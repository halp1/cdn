import { statements } from "$lib/db";
import type { FileRecord, Folder } from "$lib/db/types";
import {
  buildMultiStatus,
  buildResponse,
  formatISO8601,
  formatRFC1123,
  xmlWithStatus,
  type DavProp
} from "../xml";
import { isDirectChild, isDirectChildFolder, rootHref, toHref } from "../path";

const now = (): Date => new Date();

const deriveVirtualFolders = (allFiles: FileRecord[], parentLogical: string): string[] => {
  const seen = new Set<string>();
  for (const file of allFiles) {
    let relative: string;
    if (parentLogical === "") {
      relative = file.path;
    } else {
      if (!file.path.startsWith(parentLogical + "/")) continue;
      relative = file.path.slice(parentLogical.length + 1);
    }
    const slashIdx = relative.indexOf("/");
    if (slashIdx !== -1) {
      const segment = relative.slice(0, slashIdx);
      const folderPath = parentLogical === "" ? segment : `${parentLogical}/${segment}`;
      seen.add(folderPath);
    }
  }
  return [...seen];
};

const fileToProp = (file: FileRecord): DavProp => ({
  displayname: file.path.split("/").pop() ?? file.path,
  contenttype: file.content_type || "application/octet-stream",
  contentlength: file.size,
  creationdate: formatISO8601(file.created_at),
  lastmodified: formatRFC1123(new Date(file.created_at * 1000)),
  isCollection: false,
  etag: `"${file.id}"`
});

const folderToProp = (folderPath: string, createdAt?: number): DavProp => ({
  displayname: folderPath.split("/").pop() ?? folderPath,
  creationdate: createdAt ? formatISO8601(createdAt) : formatISO8601(Math.floor(Date.now() / 1000)),
  lastmodified: createdAt ? formatRFC1123(new Date(createdAt * 1000)) : formatRFC1123(now()),
  isCollection: true
});

const rootProp = (): DavProp => ({
  displayname: "",
  creationdate: formatISO8601(0),
  lastmodified: formatRFC1123(now()),
  isCollection: true
});

export const handlePropfind = (logicalPath: string, depthHeader: string | null): Response => {
  const depth = depthHeader === "0" ? 0 : 1;

  if (logicalPath === "") {
    const responses: string[] = [buildResponse(rootHref(), rootProp())];

    if (depth === 1) {
      const allFiles = statements.getAllFiles.all() as FileRecord[];
      const allFolders = statements.getAllFolders.all() as Folder[];

      for (const file of allFiles) {
        if (isDirectChild("", file.path)) {
          responses.push(buildResponse(toHref(file.path, false), fileToProp(file)));
        }
      }

      const explicitFolderPaths = new Set(allFolders.map((f) => f.path));
      const folderMap = new Map(allFolders.map((f) => [f.path, f]));

      const virtualFolders = deriveVirtualFolders(allFiles, "");
      const allFolderPaths = new Set([...explicitFolderPaths, ...virtualFolders]);

      for (const fp of allFolderPaths) {
        if (isDirectChildFolder("", fp)) {
          const explicit = folderMap.get(fp);
          responses.push(buildResponse(toHref(fp, true), folderToProp(fp, explicit?.created_at)));
        }
      }
    }

    return xmlWithStatus(buildMultiStatus(responses), 207);
  }

  const file = statements.getFileByPath.get(logicalPath);
  if (file) {
    const responses = [buildResponse(toHref(file.path, false), fileToProp(file))];
    return xmlWithStatus(buildMultiStatus(responses), 207);
  }

  const folders = statements.getFoldersByPrefix.all(logicalPath + "%") as Folder[];
  const exactFolder = folders.find((f) => f.path === logicalPath);

  const allFilesForFolder = statements.getAllFiles.all() as FileRecord[];
  const hasFilesUnder = allFilesForFolder.some(
    (f) => f.path === logicalPath || f.path.startsWith(logicalPath + "/")
  );

  if (!exactFolder && !hasFilesUnder) {
    return new Response("Not Found", { status: 404 });
  }

  const responses: string[] = [
    buildResponse(toHref(logicalPath, true), folderToProp(logicalPath, exactFolder?.created_at))
  ];

  if (depth === 1) {
    for (const f of allFilesForFolder) {
      if (isDirectChild(logicalPath, f.path)) {
        responses.push(buildResponse(toHref(f.path, false), fileToProp(f)));
      }
    }

    const explicitFolderPaths = new Set(folders.map((f) => f.path));
    const folderMap = new Map(folders.map((f) => [f.path, f]));
    const virtualFolders = deriveVirtualFolders(allFilesForFolder, logicalPath);
    const allFolderPaths = new Set([...explicitFolderPaths, ...virtualFolders]);

    for (const fp of allFolderPaths) {
      if (fp !== logicalPath && isDirectChildFolder(logicalPath, fp)) {
        const explicit = folderMap.get(fp);
        responses.push(buildResponse(toHref(fp, true), folderToProp(fp, explicit?.created_at)));
      }
    }
  }

  return xmlWithStatus(buildMultiStatus(responses), 207);
};
