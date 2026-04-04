export const formatRFC1123 = (date: Date): string => date.toUTCString().replace(/GMT$/, "GMT");

export const formatISO8601 = (unixSeconds: number): string =>
  new Date(unixSeconds * 1000).toISOString();

export interface DavProp {
  displayname: string;
  contenttype?: string;
  contentlength?: number;
  creationdate?: string;
  lastmodified?: string;
  isCollection: boolean;
  etag?: string;
}

const escapeXml = (str: string): string =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const buildPropNode = (prop: DavProp): string => {
  const parts: string[] = [];
  if (prop.isCollection) {
    parts.push("<D:resourcetype><D:collection/></D:resourcetype>");
  } else {
    parts.push("<D:resourcetype/>");
  }
  parts.push(`<D:displayname>${escapeXml(prop.displayname)}</D:displayname>`);
  if (prop.contenttype != null) {
    parts.push(`<D:getcontenttype>${escapeXml(prop.contenttype)}</D:getcontenttype>`);
  }
  if (prop.contentlength != null) {
    parts.push(`<D:getcontentlength>${prop.contentlength}</D:getcontentlength>`);
  }
  if (prop.creationdate != null) {
    parts.push(`<D:creationdate>${prop.creationdate}</D:creationdate>`);
  }
  if (prop.lastmodified != null) {
    parts.push(`<D:getlastmodified>${prop.lastmodified}</D:getlastmodified>`);
  }
  if (prop.etag != null) {
    parts.push(`<D:getetag>${escapeXml(prop.etag)}</D:getetag>`);
  }
  return parts.join("");
};

export const buildResponse = (href: string, prop: DavProp): string => `
  <D:response>
    <D:href>${escapeXml(href)}</D:href>
    <D:propstat>
      <D:prop>
        ${buildPropNode(prop)}
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`;

export const buildMultiStatus = (responses: string[]): string =>
  `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
${responses.join("")}
</D:multistatus>`;

export const buildLockResponse = (
  href: string,
  token: string,
  owner: string,
  timeoutSeconds: number
): string => `<?xml version="1.0" encoding="utf-8"?>
<D:prop xmlns:D="DAV:">
  <D:lockdiscovery>
    <D:activelock>
      <D:locktype><D:write/></D:locktype>
      <D:lockscope><D:exclusive/></D:lockscope>
      <D:depth>0</D:depth>
      <D:owner><D:href>${escapeXml(owner)}</D:href></D:owner>
      <D:timeout>Second-${timeoutSeconds}</D:timeout>
      <D:locktoken><D:href>${escapeXml(token)}</D:href></D:locktoken>
      <D:lockroot><D:href>${escapeXml(href)}</D:href></D:lockroot>
    </D:activelock>
  </D:lockdiscovery>
</D:prop>`;

export const xml = (body: string): Response =>
  new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" }
  });

export const xmlWithStatus = (body: string, status: number): Response =>
  new Response(body, {
    status,
    headers: { "Content-Type": "application/xml; charset=utf-8" }
  });
