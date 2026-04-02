import Database from 'better-sqlite3';
import { dev } from '$app/environment';
import path from 'path';
import fs from 'fs';

// Export types
export * from './types';

// Extend globalThis type
declare global {
	var __db: Database.Database | undefined;
}

// Database file path
const DB_PATH = path.join(process.cwd(), 'data', 'app.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
	fs.mkdirSync(dataDir, { recursive: true });
}

// Create or reuse database connection from globalThis
let db: Database.Database;
if (globalThis.__db) {
	db = globalThis.__db;
} else {
	db = new Database(DB_PATH, {});

	// Enable WAL mode for better performance
	db.pragma('journal_mode = WAL');

	// Store in globalThis for reuse
	globalThis.__db = db;
}

// Initialize database schema
const initSchema = () => {
	// Users table
	db.exec(`
		CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL
		)
	`);

	// One time links table
	db.exec(`
		CREATE TABLE IF NOT EXISTS one_time_links (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			token TEXT UNIQUE NOT NULL,
			upload_path TEXT NOT NULL,
			expires_at INTEGER NOT NULL,
			max_uploads INTEGER DEFAULT 1,
			used_count INTEGER DEFAULT 0,
			created_at INTEGER DEFAULT (strftime('%s', 'now'))
		)
	`);

	// Migration: Check if old column exists and update schema if needed
	try {
		db.exec(`SELECT target_path FROM one_time_links LIMIT 1`);
		// If we get here, old column exists, so rename it
		db.exec(`ALTER TABLE one_time_links RENAME COLUMN target_path TO upload_path`);
		// Also update used_at to used if it exists
		try {
			db.exec(`SELECT used_at FROM one_time_links LIMIT 1`);
			db.exec(`ALTER TABLE one_time_links DROP COLUMN used_at`);
			db.exec(`ALTER TABLE one_time_links ADD COLUMN used BOOLEAN DEFAULT FALSE`);
		} catch {
			// used_at column doesn't exist, which is fine
		}
	} catch {
		// target_path column doesn't exist, which means we have the correct schema
	}

	// Migration: Add max_uploads and used_count columns if they don't exist
	try {
		db.exec(`SELECT max_uploads FROM one_time_links LIMIT 1`);
	} catch {
		// max_uploads column doesn't exist, add it
		db.exec(`ALTER TABLE one_time_links ADD COLUMN max_uploads INTEGER DEFAULT 1`);
	}

	try {
		db.exec(`SELECT used_count FROM one_time_links LIMIT 1`);
	} catch {
		// used_count column doesn't exist, add it
		db.exec(`ALTER TABLE one_time_links ADD COLUMN used_count INTEGER DEFAULT 0`);
	}

	// Expire times table
	db.exec(`
		CREATE TABLE IF NOT EXISTS expire_times (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			object_key TEXT NOT NULL,
			timestamp INTEGER NOT NULL
		)
	`);

	// API keys table
	db.exec(`
		CREATE TABLE IF NOT EXISTS api_keys (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			key TEXT UNIQUE NOT NULL,
			permissions TEXT NOT NULL,
			scoped_paths TEXT NOT NULL,
			created_at INTEGER DEFAULT (strftime('%s', 'now')),
			last_used_at INTEGER,
			is_active BOOLEAN DEFAULT TRUE
		)
	`);

	// Create indexes for better performance
	db.exec(`
		CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
		CREATE INDEX IF NOT EXISTS idx_one_time_links_token ON one_time_links (token);
		CREATE INDEX IF NOT EXISTS idx_one_time_links_expires_at ON one_time_links (expires_at);
		CREATE INDEX IF NOT EXISTS idx_expire_times_object_key ON expire_times (object_key);
		CREATE INDEX IF NOT EXISTS idx_expire_times_timestamp ON expire_times (timestamp);
		CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys (key);
		CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys (is_active);
	`);
};

// Initialize schema on startup
initSchema();

// Prepared statements for common operations
export const statements = {
	// User operations
	createUser: db.prepare(`
		INSERT INTO users (username, password_hash)
		VALUES (?, ?)
	`),

	getUserById: db.prepare(`
		SELECT * FROM users WHERE id = ?
	`),

	getUserByUsername: db.prepare(`
		SELECT * FROM users WHERE username = ?
	`),

	getUserCount: db.prepare(`
		SELECT COUNT(*) as count FROM users
	`),

	// One time links operations
	createOneTimeLink: db.prepare(`
		INSERT INTO one_time_links (token, upload_path, expires_at, max_uploads)
		VALUES (?, ?, ?, ?)
	`),

	getOneTimeLink: db.prepare(`
		SELECT * FROM one_time_links WHERE token = ? AND expires_at > strftime('%s', 'now') AND used_count < max_uploads
	`),

	incrementUploadCount: db.prepare(`
		UPDATE one_time_links SET used_count = used_count + 1 WHERE token = ?
	`),

	deleteOneTimeLink: db.prepare(`
		DELETE FROM one_time_links WHERE token = ?
	`),

	deleteExpiredOneTimeLinks: db.prepare(`
		DELETE FROM one_time_links WHERE expires_at <= strftime('%s', 'now')
	`),

	getAllOneTimeLinks: db.prepare(`
		SELECT * FROM one_time_links WHERE expires_at > strftime('%s', 'now') ORDER BY created_at DESC
	`),

	// Expire times operations
	createExpireTime: db.prepare(`
		INSERT INTO expire_times (object_key, timestamp)
		VALUES (?, ?)
	`),

	getExpireTime: db.prepare(`
		SELECT * FROM expire_times WHERE object_key = ?
	`),

	deleteExpireTime: db.prepare(`
		DELETE FROM expire_times WHERE object_key = ?
	`),

	deleteExpiredEntries: db.prepare(`
		DELETE FROM expire_times WHERE timestamp <= ?
	`),

	// API key operations
	createApiKey: db.prepare(`
		INSERT INTO api_keys (name, key, permissions, scoped_paths)
		VALUES (?, ?, ?, ?)
	`),

	getApiKey: db.prepare(`
		SELECT * FROM api_keys WHERE key = ? AND is_active = TRUE
	`),

	getAllApiKeys: db.prepare(`
		SELECT * FROM api_keys WHERE is_active = TRUE ORDER BY created_at DESC
	`),

	updateApiKeyLastUsed: db.prepare(`
		UPDATE api_keys SET last_used_at = strftime('%s', 'now') WHERE key = ?
	`),

	deactivateApiKey: db.prepare(`
		UPDATE api_keys SET is_active = FALSE WHERE id = ?
	`),

	deleteApiKey: db.prepare(`
		DELETE FROM api_keys WHERE id = ?
	`)
};

// Transaction helper
export const transaction = db.transaction;

// Close database connection on process exit
process.on('exit', () => db.close());
process.on('SIGINT', () => {
	db.close();
	process.exit(0);
});
process.on('SIGTERM', () => {
	db.close();
	process.exit(0);
});

export default db;
