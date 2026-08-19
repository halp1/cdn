---
description: "Use when writing any part of the CDN application — routes, components, lib utilities, API, DB. Covers architecture, stack, patterns, and feature requirements for the rewrite of the old CDN app."
applyTo: "src/**"
---

# CDN App — Rewrite Instructions

This is a **self-hosted Cloudflare R2 file storage and CDN management dashboard** built with SvelteKit. The goal is a clean, robust, fully-typed rewrite of the app in `old/` with the same features, fewer bugs, and a new design.

Reference the old app at `old/src/` when you need to understand a feature in detail.

## Stack

| Layer      | Technology                                                               |
| ---------- | ------------------------------------------------------------------------ |
| Framework  | SvelteKit 2, Svelte 5                                                    |
| Styling    | Tailwind CSS v4                                                          |
| Language   | TypeScript (strict)                                                      |
| Database   | SQLite via `better-sqlite3`                                              |
| Storage    | Cloudflare R2 via `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` |
| Validation | Valibot                                                                  |
| Auth       | Custom HS256 JWT in httpOnly cookie                                      |

## Svelte 5 Rules

- Always use runes syntax: `$state<T>(default)`, `$derived(...)`, `$effect(...)`, `$props()`
- Never use `export let`. Declare prop types in a `Props` interface and use `let { prop }: Props = $props()`
- Use `onclick` not `on:click`. All event handlers use the DOM attribute form
- No legacy store syntax (`writable`, `readable`) — use `$state` and `$derived` instead
- Use `{@render children()}` for slot content

## TypeScript Rules

- No `as any` casts — ever. Properly type all values
- All DB prepared statements must be typed. Define a `Statements` interface and type the `statements` export
- Define TypeScript interfaces for all DB row types (`User`, `OneTimeLink`, `ApiKey`, `ExpireTime`)
- Use `satisfies` and generics over casts where possible
- Valibot schemas should colocate with their TypeScript types

## Architecture Patterns

### Remote Functions

Use SvelteKit remote functions (`$lib/api/*.remote.ts`) for all client-server communication:

- `query` functions for reads, `command` functions for writes/mutations
- Import `getRequestEvent` from `$app/server` to access `event.locals`
- Validate all inputs with Valibot schemas before processing
- Guard every remote function: check `event.locals.user` and throw if unauthenticated

### Route Structure

| Route             | Purpose                                                                 |
| ----------------- | ----------------------------------------------------------------------- |
| `/`               | Main dashboard: file explorer + storage stats + upload links sidebar    |
| `/auth`           | Login/Register (register only if zero users exist)                      |
| `/logout`         | POST action — clears token cookie, redirects to `/auth`                 |
| `/api-keys`       | API key management panel                                                |
| `/upload/[token]` | Public one-time upload page — no auth required, validates token from DB |
| `/obj/[...path]`  | Redirect to R2 public URL for file downloads                            |
| `/api/v1/`        | Legacy REST API for external tooling using API key Bearer auth          |

### Auth Flow

- JWT stored in `httpOnly` cookie named `token`
- `hooks.server.ts` verifies JWT on every request, checks DB user still exists, sets `event.locals.user`
- Delete cookie if JWT invalid or user not found in DB
- All protected routes/remote functions check `event.locals.user`

### Database

- SQLite file at `data/app.db`, created on startup
- Enable WAL mode on initialization
- All queries use prepared statements — never string interpolation
- Export a single `statements` object typed with a `Statements` interface
- Tables: `users`, `one_time_links`, `expire_times`, `api_keys`

### File Upload Flow

1. Client calls remote `getUploadUrl({ key, type })` → receives presigned PUT URL (1h expiry)
2. Client `PUT`s directly to R2 via the presigned URL using XHR (for progress tracking)
3. Client calls `confirmUpload({ token, fileKey })` to increment usage counter and auto-delete if the limit is reached

## Features to Implement

### File Explorer (main dashboard `/`)

- Hierarchical file/folder browser with breadcrumb navigation
- Folders listed before files, both sorted alphabetically
- Drag-and-drop to move objects between folders
- Multi-select with Shift/Ctrl click
- Context menu: delete, move, copy public link
- New folder creation
- Upload progress overlay
- Folder size calculation (lazy, on hover, memoized)

### File Viewer

- Text files: Monaco editor (lazy-loaded, no SSR)
- Videos: native HTML5 `<video>` player
- Images: inline display
- Binary: download prompt
- Loading progress bar, cancel support via `AbortController`

### Storage Stats

- Total bucket size and object count
- Refresh button

### Upload Links (`/upload/[token]`)

- Public unauthenticated upload page
- Validate token exists, not expired, and usage not exceeded
- Show remaining uploads and expiry
- Sanitize filename on server before generating presigned URL
- Auto-delete link when max uploads reached

### Upload Link Management (dashboard sidebar)

- Create links: path, expiration hours, max uploads
- List active links with remaining time and usage counter
- Delete links
- Copy link to clipboard

### API Keys (`/api-keys`)

- List: show only first 12 chars of key to avoid full exposure
- Create: name, permissions (`read` | `write` | `delete` | `list`), scoped paths
- Deactivate (soft) or permanently delete
- Copy newly created key immediately (show once only)

### Legacy REST API (`/api/v1/`)

- `Authorization: Bearer <key>` header auth
- `GET /list?path=&limit=` — list objects
- `POST /upload` — get presigned URL
- `POST /upload/confirm` — confirm upload
- `DELETE /delete` — delete object
- `GET /download?key=` — get presigned download URL

## Keyboard System

Global keyboard shortcuts are managed by `KeyboardManager.svelte`.

- Add keybinds by passing a `KeyBind[]` array (from `$lib/components/KeyboardManager.svelte`) to `<KeyboardManager>`
- Each `KeyBind` has: `key` (exact `e.key` value), optional modifier flags (`ctrl`, `meta`, `ctrlOrMeta`, `shift`, `alt`), `action: () => void`, and `allowInModal?: boolean`
- `isAnyModalOpen` must be passed alongside `keybinds`; binds without `allowInModal: true` are skipped while any modal is open
- Keybinds fire only when focus is NOT on an `<input>`, `<textarea>`, or `contenteditable` element
- `keybinds` is typically `$derived<KeyBind[]>([...])` so it reacts to state changes
- Current binds in `FileBrowser`: `Ctrl/Meta+K` (search), `Delete` (delete selected), `ArrowUp`/`ArrowDown` (navigate list), `Escape` (close right panel)

## Security Rules

- Sanitize all filenames: strip path traversal chars (`..`, `/`, `\`), control chars, limit length to 255
- Make filenames unique when there's a collision (append counter or suffix)
- Validate all API inputs with Valibot — reject at boundary, never trust client data
- API key paths must be validated to prevent traversal
- Browser sessions come from HALP auth (OIDC). WebDAV uses a CDN API key as the Basic password.

## Design

- Use the `frontend-design` skill for all UI work
- Follow `design.instructions.md` exactly for all visual decisions — colors, fonts, spacing, and component patterns
- Never use generic AI defaults (Inter, Roboto, purple-on-white gradients, cookie-cutter layouts)
- Tailwind CSS v4 only — no arbitrary inline styles unless unavoidable
