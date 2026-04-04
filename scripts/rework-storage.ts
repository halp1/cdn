/**
 * Migration script: path-based R2 keys → UUID-based R2 keys with path mappings in DB.
 *
 * For each existing R2 object (e.g. `folder/photo.jpg`):
 *   1. Generates a UUID
 *   2. Copies the R2 object to `{uuid}.{ext}` (or `{uuid}` if no extension)
 *   3. Inserts a `files` row mapping `{uuid}` → `folder/photo.jpg`
 *   4. Deletes the old R2 object
 *
 * Also migrates `expire_times.object_key` from paths to UUIDs.
 *
 * Usage:
 *   npx tsx scripts/rework-storage.ts [--dry-run]
 *
 * Options:
 *   --dry-run    Print what would be done without writing anything
 */

import Database from "better-sqlite3";
import {
  S3Client,
  ListObjectsV2Command,
  CopyObjectCommand,
  DeleteObjectCommand
} from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

// ---------------------------------------------------------------------------
// Parse .env manually (no external deps needed)
// ---------------------------------------------------------------------------
const ENV_PATH = path.join(ROOT, ".env");
if (!fs.existsSync(ENV_PATH)) {
  console.error(`Error: .env file not found at ${ENV_PATH}`);
  process.exit(1);
}
const env: Record<string, string> = {};
for (const line of fs.readFileSync(ENV_PATH, "utf-8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq < 0) continue;
  const key = trimmed.slice(0, eq).trim();
  const value = trimmed.slice(eq + 1).trim();
  env[key] = value;
}

const required = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"];
for (const k of required) {
  if (!env[k]) {
    console.error(`Error: missing ${k} in .env`);
    process.exit(1);
  }
}

const BUCKET = env["R2_BUCKET_NAME"]!;

const S3 = new S3Client({
  region: "auto",
  endpoint: `https://${env["R2_ACCOUNT_ID"]}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env["R2_ACCESS_KEY_ID"]!,
    secretAccessKey: env["R2_SECRET_ACCESS_KEY"]!
  }
});

// ---------------------------------------------------------------------------
// Open DB
// ---------------------------------------------------------------------------
const DB_PATH = path.join(ROOT, "data", "app.db");
if (!fs.existsSync(DB_PATH)) {
  console.error(`Error: database not found at ${DB_PATH}. Run the app first to create the schema.`);
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Ensure files table exists (app may not have run yet against the new schema)
db.exec(`
  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    path TEXT UNIQUE NOT NULL,
    extension TEXT NOT NULL DEFAULT '',
    size INTEGER NOT NULL DEFAULT 0,
    content_type TEXT NOT NULL DEFAULT '',
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  );
  CREATE INDEX IF NOT EXISTS idx_files_path ON files (path);
`);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(\.[a-z0-9]+)?$/i;

const isAlreadyMigrated = (key: string): boolean => UUID_RE.test(key);

const extractExtension = (filename: string): string => {
  const base = filename.split("/").pop() ?? filename;
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
};

const buildR2Key = (id: string, extension: string): string =>
  extension ? `${id}.${extension}` : id;

// ---------------------------------------------------------------------------
// List all R2 objects
// ---------------------------------------------------------------------------
const listAllR2Objects = async (): Promise<{ key: string; size: number }[]> => {
  const objects: { key: string; size: number }[] = [];
  let continuationToken: string | undefined;
  do {
    const result = await S3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        ContinuationToken: continuationToken,
        MaxKeys: 1000
      })
    );
    for (const obj of result.Contents ?? []) {
      objects.push({ key: obj.Key!, size: obj.Size ?? 0 });
    }
    continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
  } while (continuationToken);
  return objects;
};

// ---------------------------------------------------------------------------
// Prepared statements
// ---------------------------------------------------------------------------
const insertFile = db.prepare<[string, string, string, number, string], void>(
  "INSERT OR IGNORE INTO files (id, path, extension, size, content_type) VALUES (?, ?, ?, ?, ?)"
);
const getFileByPath = db.prepare<[string], { id: string; extension: string } | undefined>(
  "SELECT id, extension FROM files WHERE path = ?"
);
const getExpireTimes = db.prepare<[], { id: number; object_key: string }[]>(
  "SELECT id, object_key FROM expire_times"
);
const updateExpireKey = db.prepare<[string, number], void>(
  "UPDATE expire_times SET object_key = ? WHERE id = ?"
);

// ---------------------------------------------------------------------------
// Main migration
// ---------------------------------------------------------------------------
console.log(`\n=== R2 Storage Migration ===`);
console.log(`Bucket:  ${BUCKET}`);
console.log(`DB:      ${DB_PATH}`);
console.log(`Dry run: ${DRY_RUN}\n`);

const r2Objects = await listAllR2Objects();
console.log(`Found ${r2Objects.length} object(s) in R2.\n`);

let migrated = 0;
let skippedAlreadyMigrated = 0;
let skippedAlreadyInDb = 0;
let errors = 0;

for (const obj of r2Objects) {
  const { key, size } = obj;

  if (isAlreadyMigrated(key)) {
    console.log(`  SKIP (already migrated): ${key}`);
    skippedAlreadyMigrated++;
    continue;
  }

  const existing = getFileByPath.get(key);
  if (existing) {
    console.log(`  SKIP (already in DB): ${key}`);
    skippedAlreadyInDb++;
    continue;
  }

  const id = randomUUID();
  const extension = extractExtension(key);
  const newKey = buildR2Key(id, extension);

  console.log(`  MIGRATE: ${key} → ${newKey}`);

  if (!DRY_RUN) {
    try {
      await S3.send(
        new CopyObjectCommand({
          Bucket: BUCKET,
          CopySource: `${BUCKET}/${encodeURIComponent(key)}`,
          Key: newKey
        })
      );
      insertFile.run(id, key, extension, size, "");
      await S3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
      migrated++;
    } catch (e) {
      console.error(`  ERROR migrating ${key}:`, e);
      errors++;
    }
  } else {
    migrated++;
  }
}

// ---------------------------------------------------------------------------
// Migrate expire_times.object_key from path → UUID
// ---------------------------------------------------------------------------
console.log(`\nMigrating expire_times...`);
const expireTimes = db
  .prepare<[], { id: number; object_key: string }>("SELECT id, object_key FROM expire_times")
  .all();
let expireMigrated = 0;
let expireSkipped = 0;

for (const row of expireTimes) {
  // If already a UUID (optionally with extension), skip
  if (UUID_RE.test(row.object_key)) {
    expireSkipped++;
    continue;
  }
  const file = getFileByPath.get(row.object_key);
  if (!file) {
    console.log(
      `  expire_times[${row.id}]: path "${row.object_key}" not found in files table — skipping`
    );
    expireSkipped++;
    continue;
  }
  console.log(`  expire_times[${row.id}]: "${row.object_key}" → "${file.id}"`);
  if (!DRY_RUN) {
    updateExpireKey.run(file.id, row.id);
    expireMigrated++;
  } else {
    expireMigrated++;
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n=== Summary ===`);
console.log(`Files migrated:         ${migrated}`);
console.log(`Files skipped (UUID):   ${skippedAlreadyMigrated}`);
console.log(`Files skipped (DB):     ${skippedAlreadyInDb}`);
console.log(`Errors:                 ${errors}`);
console.log(`expire_times migrated:  ${expireMigrated}`);
console.log(`expire_times skipped:   ${expireSkipped}`);
if (DRY_RUN) console.log(`\n[DRY RUN — no changes written]`);
