import { toHref } from "../path";
import { xmlWithStatus } from "../xml";

export const handleProppatch = (logicalPath: string): Response => {
  const href = logicalPath ? toHref(logicalPath, false) : "/webdav/";
  const body = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>${href}</D:href>
    <D:propstat>
      <D:prop/>
      <D:status>HTTP/1.1 403 Forbidden</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>`;
  return xmlWithStatus(body, 207);
};
