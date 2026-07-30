/**
 * Diagnostic script: inspect the stored Google Drive OAuth token and test it live.
 *
 * Google returns a bare `invalid_grant` / "Bad Request" for every reason a refresh
 * token can be rejected, so the response alone never says which one it was. This
 * prints the stored state and (unless --no-network) performs a real refresh against
 * Google so you get an immediate answer instead of waiting for the 4-hour scheduler.
 *
 * Secrets are never printed in full — only lengths and short prefixes.
 *
 * Usage:
 *   npx tsx scripts/check-drive-auth.ts [options]
 *
 * Options:
 *   --db <path>     Path to the database (default: data/app.db)
 *   --no-network    Only inspect stored values; do not contact Google
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const getArg = (flag: string): string | undefined => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
};
const hasFlag = (flag: string) => args.includes(flag);

const DB_PATH = getArg("--db") ?? path.join(ROOT, "data", "app.db");
const NO_NETWORK = hasFlag("--no-network");

if (!fs.existsSync(DB_PATH)) {
  console.error(`Error: database not found at ${DB_PATH}`);
  process.exit(1);
}

interface OAuthRow {
  provider: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: number | null;
  client_id: string | null;
  client_secret: string | null;
  redirect_uri: string | null;
  folder_id: string | null;
}

const db = new Database(DB_PATH, { readonly: true });
const row = db.prepare("SELECT * FROM oauth_tokens WHERE provider = ?").get("google") as
  | OAuthRow
  | undefined;

if (!row) {
  console.error("No Google OAuth row in the database — Drive was never connected.");
  process.exit(1);
}

const describe = (value: string | null, keepPrefix = 0): string => {
  if (value === null) return "NULL";
  if (value === "") return "empty string";
  const prefix = keepPrefix > 0 ? ` "${value.slice(0, keepPrefix)}…"` : "";
  return `${value.length} chars${prefix}`;
};

console.log("Stored configuration");
console.log(`  client_id      ${describe(row.client_id, 24)}`);
console.log(`  client_secret  ${describe(row.client_secret, 7)}`);
console.log(`  redirect_uri   ${row.redirect_uri ?? "NULL"}`);
console.log(`  folder_id      ${row.folder_id ?? "NULL (root)"}`);
console.log("");
console.log("Stored tokens");
console.log(`  access_token   ${describe(row.access_token)}`);
console.log(`  refresh_token  ${describe(row.refresh_token, 12)}`);
console.log(
  `  expires_at     ${
    row.expires_at ? `${row.expires_at} (${new Date(row.expires_at * 1000).toISOString()})` : "NULL"
  }`
);

// Copy-paste from the Cloud Console is the usual source of stray whitespace, and a
// padded secret fails in a way that looks identical to a dead refresh token.
for (const [name, value] of [
  ["client_id", row.client_id],
  ["client_secret", row.client_secret],
  ["refresh_token", row.refresh_token]
] as const) {
  if (value && value !== value.trim()) {
    console.log(
      `\n  WARNING: ${name} has leading/trailing whitespace — this alone breaks refresh.`
    );
  }
}

// A Google refresh token is "1//" followed by an opaque blob. An access token
// ("ya29.…") sitting in this column means the wrong value was persisted.
if (row.refresh_token && !row.refresh_token.startsWith("1//")) {
  console.log(
    `\n  WARNING: refresh_token does not look like a Google refresh token (expected it to start with "1//").`
  );
}

const lastBackup = db.prepare("SELECT * FROM backups ORDER BY timestamp DESC LIMIT 1").get() as
  | { timestamp: number; status: string; error_message: string | null }
  | undefined;

if (lastBackup) {
  console.log("");
  console.log("Most recent backup");
  console.log(`  ${new Date(lastBackup.timestamp * 1000).toISOString()}  ${lastBackup.status}`);
  if (lastBackup.error_message) console.log(`  ${lastBackup.error_message}`);
}

db.close();

if (NO_NETWORK) process.exit(0);

if (!row.refresh_token || !row.client_id || !row.client_secret) {
  console.log("\nSkipping live test: refresh token or credentials missing.");
  process.exit(1);
}

console.log("\nTesting refresh against Google…");

const response = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: row.client_id,
    client_secret: row.client_secret,
    refresh_token: row.refresh_token,
    grant_type: "refresh_token"
  })
});

const body = await response.text();

if (response.ok) {
  console.log("  OK — Google accepted the refresh token. Backups should work.");
  process.exit(0);
}

let code = "";
try {
  code = JSON.parse(body).error || "";
} catch {
  // Non-JSON body; the raw text below is all we have.
}

console.log(`  FAILED (HTTP ${response.status}): ${body}`);

if (code === "invalid_client") {
  console.log(
    "\n  invalid_client means the Client ID/Secret above are wrong or belong to a\n" +
      "  deleted OAuth client. Re-copy them from the Google Cloud Console."
  );
} else if (code === "invalid_grant") {
  console.log(
    "\n  invalid_grant means Google will never accept this refresh token again.\n" +
      "  In order of likelihood:\n" +
      "    1. The token was issued while the OAuth app was in 'Testing' status.\n" +
      "       Those expire after 7 days, and publishing to production afterwards\n" +
      "       does NOT revive them — you must reconnect once after publishing.\n" +
      "    2. The Client ID/Secret were changed after connecting. A refresh token\n" +
      "       is only valid for the client it was issued to.\n" +
      "    3. Access was revoked at https://myaccount.google.com/permissions, or\n" +
      "       the Google account's password was changed.\n" +
      "  All three are fixed the same way: reconnect Google Drive in the UI."
  );
}

process.exit(1);
