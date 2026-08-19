import { authenticateWebDav, unauthorizedResponse } from "./auth";
import { parseDestinationHeader, stripDavPrefix, toLogicalPath } from "./path";
import { handleOptions } from "./methods/options";
import { handlePropfind } from "./methods/propfind";
import { handleGet } from "./methods/get";
import { handlePut } from "./methods/put";
import { handleDelete } from "./methods/delete";
import { handleMkcol } from "./methods/mkcol";
import { handleMove } from "./methods/move";
import { handleCopy } from "./methods/copy";
import { handleLock, handleUnlock } from "./methods/lock";
import { handleProppatch } from "./methods/proppatch";

const DAV_HEADERS = {
  DAV: "1, 2",
  "MS-Author-Via": "DAV"
};

const addDavHeaders = (response: Response): Response => {
  for (const [key, value] of Object.entries(DAV_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
};

export const handleWebDAV = async (request: Request, url: URL): Promise<Response> => {
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") {
    return addDavHeaders(handleOptions());
  }

  const davPath = stripDavPrefix(url.pathname);
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(davPath);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }
  const logicalPath = toLogicalPath(decodedPath);

  const destHeader = request.headers.get("destination");
  const destPath =
    (method === "MOVE" || method === "COPY") && destHeader
      ? parseDestinationHeader(destHeader, "")
      : null;

  const auth = authenticateWebDav(
    request.headers.get("authorization"),
    method,
    logicalPath,
    destPath
  );
  if (!auth.ok) {
    return auth.status === 401
      ? unauthorizedResponse()
      : new Response("Forbidden", { status: 403 });
  }

  let response: Response;

  switch (method) {
    case "PROPFIND":
      response = handlePropfind(logicalPath, request.headers.get("depth"));
      break;
    case "GET":
      response = await handleGet(logicalPath, false);
      break;
    case "HEAD":
      response = await handleGet(logicalPath, true);
      break;
    case "PUT":
      response = await handlePut(logicalPath, request);
      break;
    case "DELETE":
      response = await handleDelete(logicalPath);
      break;
    case "MKCOL":
      response = handleMkcol(logicalPath);
      break;
    case "MOVE":
      response = handleMove(logicalPath, request);
      break;
    case "COPY":
      response = await handleCopy(logicalPath, request);
      break;
    case "LOCK":
      response = await handleLock(logicalPath, request);
      break;
    case "UNLOCK":
      response = handleUnlock(logicalPath, request);
      break;
    case "PROPPATCH":
      response = handleProppatch(logicalPath);
      break;
    default:
      response = new Response("Method Not Allowed", {
        status: 405,
        headers: {
          Allow:
            "OPTIONS, GET, HEAD, PUT, DELETE, MKCOL, MOVE, COPY, PROPFIND, PROPPATCH, LOCK, UNLOCK"
        }
      });
  }

  return addDavHeaders(response);
};
