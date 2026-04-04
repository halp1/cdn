export const DAV_PREFIX = "/webdav";

export const stripDavPrefix = (pathname: string): string => {
  if (pathname.startsWith(DAV_PREFIX)) {
    return pathname.slice(DAV_PREFIX.length) || "/";
  }
  return pathname;
};

export const toLogicalPath = (davPath: string): string => {
  const stripped = davPath.startsWith("/") ? davPath.slice(1) : davPath;
  return stripped.endsWith("/") && stripped.length > 0 ? stripped.slice(0, -1) : stripped;
};

export const toHref = (logicalPath: string, isFolder: boolean): string => {
  const base = `${DAV_PREFIX}/${logicalPath}`;
  return isFolder ? base.replace(/\/?$/, "/") : base;
};

export const rootHref = (): string => `${DAV_PREFIX}/`;

export const getParentPath = (logicalPath: string): string => {
  const parts = logicalPath.split("/");
  parts.pop();
  return parts.join("/");
};

export const getDirectParent = (logicalPath: string): string => {
  const idx = logicalPath.lastIndexOf("/");
  return idx === -1 ? "" : logicalPath.slice(0, idx);
};

export const isDirectChild = (parentLogical: string, childPath: string): boolean => {
  if (parentLogical === "") {
    return !childPath.includes("/");
  }
  const prefix = parentLogical + "/";
  if (!childPath.startsWith(prefix)) return false;
  const remainder = childPath.slice(prefix.length);
  return !remainder.includes("/") && remainder.length > 0;
};

export const isDirectChildFolder = (parentLogical: string, folderPath: string): boolean => {
  if (parentLogical === "") {
    return !folderPath.includes("/");
  }
  const prefix = parentLogical + "/";
  if (!folderPath.startsWith(prefix)) return false;
  const remainder = folderPath.slice(prefix.length);
  return !remainder.includes("/") && remainder.length > 0;
};

export const parseDestinationHeader = (destination: string, origin: string): string | null => {
  let path: string;
  try {
    const url = new URL(destination);
    path = url.pathname;
  } catch {
    path = destination;
  }

  if (path.startsWith(DAV_PREFIX)) {
    path = path.slice(DAV_PREFIX.length);
  }

  try {
    path = decodeURIComponent(path);
  } catch {
    return null;
  }

  return toLogicalPath(path);
};
