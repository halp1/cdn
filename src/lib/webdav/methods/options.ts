export const handleOptions = (): Response =>
  new Response(null, {
    status: 200,
    headers: {
      DAV: "1, 2",
      Allow:
        "OPTIONS, GET, HEAD, PUT, DELETE, MKCOL, MOVE, COPY, PROPFIND, PROPPATCH, LOCK, UNLOCK",
      "MS-Author-Via": "DAV",
      "Accept-Ranges": "bytes"
    }
  });
