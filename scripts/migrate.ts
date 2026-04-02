/**
 * Migration script: old CDN database → new CDN database
 *
 * The old database uses SHA-256(username:password) for password hashes.
 * bcrypt hashes cannot be derived from SHA-256 hashes, so all user passwords
 * are reset to a temporary password (passed via --temp-password flag).
 *
 * Usage:
 *   npx tsx scripts/migrate.ts [options]
 *
 * Options:
 *   --old-db <path>       Path to old database (default: old/data/app.db)
 *   --new-db <path>       Path to new database (default: data/app.db)
 *   --temp-password <pw>  Temporary password for all migrated users (required)
 *   --dry-run             Print what would be done without writing
 */

import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const getArg = (flag: string): string | undefined => {
	const i = args.indexOf(flag);
	return i !== -1 ? args[i + 1] : undefined;
};
const hasFlag = (flag: string) => args.includes(flag);

const OLD_DB_PATH = getArg('--old-db') ?? path.join(ROOT, 'old', 'data', 'app.db');
const NEW_DB_PATH = getArg('--new-db') ?? path.join(ROOT, 'data', 'app.db');
const TEMP_PASSWORD = getArg('--temp-password');
const DRY_RUN = hasFlag('--dry-run');

if (!TEMP_PASSWORD) {
	console.error(
		'Error: --temp-password is required (all old password hashes are SHA-256 and cannot be migrated to bcrypt)'
	);
	process.exit(1);
}

if (!fs.existsSync(OLD_DB_PATH)) {
	console.error(`Error: old database not found at ${OLD_DB_PATH}`);
	process.exit(1);
}

if (!DRY_RUN) {
	const newDbDir = path.dirname(NEW_DB_PATH);
	if (!fs.existsSync(newDbDir)) fs.mkdirSync(newDbDir, { recursive: true });
}

console.log(`\nMigration plan:`);
console.log(`  Old DB: ${OLD_DB_PATH}`);
console.log(`  New DB: ${NEW_DB_PATH}`);
console.log(`  Dry run: ${DRY_RUN}`);
console.log(`  Temp password: ${'*'.repeat(TEMP_PASSWORD.length)}\n`);

const oldDb = new Database(OLD_DB_PATH, { readonly: true });

interface OldUser {
	id: number;
	username: string;
	password_hash: string;
}
interface OldLink {
	id: number;
	token: string;
	upload_path?: string;
	target_path?: string;
	expires_at: number;
	max_uploads: number;
	used_count: number;
	created_at: number;
}
interface OldExpireTime {
	id: number;
	object_key: string;
	timestamp: number;
}
interface OldApiKey {
	id: number;
	name: string;
	key: string;
	permissions: string;
	scoped_paths: string;
	created_at: number;
	last_used_at: number | null;
	is_active: number;
}

const oldUsers = oldDb.prepare('SELECT * FROM users').all() as OldUser[];
const oldExpireTimes = (() => {
	try {
		return oldDb.prepare('SELECT * FROM expire_times').all() as OldExpireTime[];
	} catch {
		return [] as OldExpireTime[];
	}
})();
const oldApiKeys = (() => {
	try {
		return oldDb.prepare('SELECT * FROM api_keys').all() as OldApiKey[];
	} catch {
		return [] as OldApiKey[];
	}
})();
const oldLinks = (() => {
	try {
		return oldDb.prepare('SELECT * FROM one_time_links').all() as OldLink[];
	} catch {
		return [] as OldLink[];
	}
})();

oldDb.close();

console.log(`Found:`);
console.log(`  Users:        ${oldUsers.length}`);
console.log(`  Upload links: ${oldLinks.length}`);
console.log(`  Expire times: ${oldExpireTimes.length}`);
console.log(`  API keys:     ${oldApiKeys.length}\n`);

if (DRY_RUN) {
	console.log('Dry run complete. No changes written.');
	process.exit(0);
}

if (fs.existsSync(NEW_DB_PATH)) {
	const backup = NEW_DB_PATH + '.bak.' + Date.now();
	fs.copyFileSync(NEW_DB_PATH, backup);
	console.log(`Backed up existing new DB to: ${backup}`);
}

const newDb = new Database(NEW_DB_PATH);
newDb.pragma('journal_mode = WAL');

newDb.exec(`
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS folders (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		path TEXT UNIQUE NOT NULL,
		created_at INTEGER DEFAULT (strftime('%s', 'now'))
	);

	CREATE TABLE IF NOT EXISTS one_time_links (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		token TEXT UNIQUE NOT NULL,
		upload_path TEXT NOT NULL,
		expires_at INTEGER NOT NULL,
		max_uploads INTEGER DEFAULT 1,
		used_count INTEGER DEFAULT 0,
		created_at INTEGER DEFAULT (strftime('%s', 'now'))
	);

	CREATE TABLE IF NOT EXISTS expire_times (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		object_key TEXT NOT NULL,
		timestamp INTEGER NOT NULL
	);

	CREATE TABLE IF NOT EXISTS api_keys (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		key TEXT UNIQUE NOT NULL,
		permissions TEXT NOT NULL,
		scoped_paths TEXT NOT NULL,
		created_at INTEGER DEFAULT (strftime('%s', 'now')),
		last_used_at INTEGER,
		is_active BOOLEAN DEFAULT TRUE
	);

	CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
	CREATE INDEX IF NOT EXISTS idx_folders_path ON folders (path);
	CREATE INDEX IF NOT EXISTS idx_one_time_links_token ON one_time_links (token);
	CREATE INDEX IF NOT EXISTS idx_one_time_links_expires_at ON one_time_links (expires_at);
	CREATE INDEX IF NOT EXISTS idx_expire_times_object_key ON expire_times (object_key);
	CREATE INDEX IF NOT EXISTS idx_expire_times_timestamp ON expire_times (timestamp);
	CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys (key);
	CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys (is_active);
`);

const insertUser = newDb.prepare(
	'INSERT OR IGNORE INTO users (id, username, password_hash) VALUES (?, ?, ?)'
);
const insertLink = newDb.prepare(`
	INSERT OR IGNORE INTO one_time_links (id, token, upload_path, expires_at, max_uploads, used_count, created_at)
	VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const insertExpire = newDb.prepare(
	'INSERT OR IGNORE INTO expire_times (id, object_key, timestamp) VALUES (?, ?, ?)'
);
const insertApiKey = newDb.prepare(`
	INSERT OR IGNORE INTO api_keys (id, name, key, permissions, scoped_paths, created_at, last_used_at, is_active)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

console.log('Hashing passwords (bcrypt cost 12)…');
const migrate = newDb.transaction(() => {
	for (const user of oldUsers) {
		const hash = bcrypt.hashSync(TEMP_PASSWORD, 12);
		insertUser.run(user.id, user.username, hash);
		console.log(`  Migrated user: ${user.username}`);
	}

	const now = Math.floor(Date.now() / 1000);
	let linkCount = 0;
	for (const link of oldLinks) {
		const uploadPath = link.upload_path ?? link.target_path ?? '';
		if (link.expires_at <= now) continue;
		insertLink.run(
			link.id,
			link.token,
			uploadPath,
			link.expires_at,
			link.max_uploads ?? 1,
			link.used_count ?? 0,
			link.created_at ?? now
		);
		linkCount++;
	}
	console.log(
		`  Migrated ${linkCount} active upload links (${oldLinks.length - linkCount} expired, skipped)`
	);

	for (const et of oldExpireTimes) {
		insertExpire.run(et.id, et.object_key, et.timestamp);
	}
	console.log(`  Migrated ${oldExpireTimes.length} expire times`);

	for (const ak of oldApiKeys) {
		insertApiKey.run(
			ak.id,
			ak.name,
			ak.key,
			ak.permissions,
			ak.scoped_paths,
			ak.created_at ?? now,
			ak.last_used_at,
			ak.is_active
		);
	}
	console.log(`  Migrated ${oldApiKeys.length} API keys`);
});

migrate();
newDb.close();

console.log(`\nMigration complete.`);
console.log(`\nIMPORTANT: All user passwords have been reset to the provided temporary password.`);
console.log(`Users must log in with the temporary password and change it via the auth page.\n`);
