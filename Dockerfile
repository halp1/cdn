FROM node:22-bookworm-slim AS build

WORKDIR /app

# better-sqlite3 falls back to node-gyp when no prebuild matches
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY --from=oven/bun:1 /usr/local/bin/bun /usr/local/bin/bun

COPY package.json bun.lock .npmrc ./
# bun install resolves better-sqlite3's prebuild against its own ABI, so rebuild
# it under node 22 — that is the ABI the runtime stage actually uses
RUN bun install --frozen-lockfile \
  && npm rebuild better-sqlite3

# $env/static/private is inlined by vite at build time (jwt.ts, r2-server.ts,
# webdav/r2.ts) — without these the build fails outright
ARG JWT_SECRET
ARG R2_ACCOUNT_ID
ARG R2_ACCESS_KEY_ID
ARG R2_SECRET_ACCESS_KEY
ARG R2_BUCKET_NAME
ARG R2_S3_ENDPOINT
ENV JWT_SECRET=$JWT_SECRET \
  R2_ACCOUNT_ID=$R2_ACCOUNT_ID \
  R2_ACCESS_KEY_ID=$R2_ACCESS_KEY_ID \
  R2_SECRET_ACCESS_KEY=$R2_SECRET_ACCESS_KEY \
  R2_BUCKET_NAME=$R2_BUCKET_NAME \
  R2_S3_ENDPOINT=$R2_S3_ENDPOINT

COPY . .
RUN bun run build

FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

# data/ is supplied by the persistent volume; src/lib/db/index.ts resolves the
# database relative to process.cwd(), so this WORKDIR must match the mount point
EXPOSE 3000
CMD ["node", "build"]
