import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type {
  User,
  Folder,
  OneTimeLink,
  ExpireTime,
  ApiKeyRow,
  FileRecord,
  CountRow,
  SumRow
} from "./types";

export * from "./types";

declare global {
  var __db: Database.Database | undefined;
}

const DB_PATH = path.join(process.cwd(), "data", "app.db");

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db: Database.Database;
if (globalThis.__db) {
  db = globalThis.__db;
} else {
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  globalThis.__db = db;
}

// Safe migrations to add is_private columns to existing tables
try {
  db.exec("ALTER TABLE folders ADD COLUMN is_private INTEGER DEFAULT NULL;");
} catch (_) {
  // column already exists
}
try {
  db.exec("ALTER TABLE files ADD COLUMN is_private INTEGER DEFAULT NULL;");
} catch (_) {
  // column already exists
}

db.exec(`
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
		is_active INTEGER DEFAULT 1
	);

	CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
	CREATE INDEX IF NOT EXISTS idx_folders_path ON folders (path);
	CREATE INDEX IF NOT EXISTS idx_one_time_links_token ON one_time_links (token);
	CREATE INDEX IF NOT EXISTS idx_one_time_links_expires_at ON one_time_links (expires_at);
	CREATE INDEX IF NOT EXISTS idx_expire_times_object_key ON expire_times (object_key);
	CREATE INDEX IF NOT EXISTS idx_expire_times_timestamp ON expire_times (timestamp);
	CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys (key);
	CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys (is_active);

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

export interface Statements {
  createUser: Database.Statement<[string, string], void>;
  getUserById: Database.Statement<[number], User | undefined>;
  getUserByUsername: Database.Statement<[string], User | undefined>;
  getUserCount: Database.Statement<[], CountRow>;

  createFolder: Database.Statement<[string], void>;
  deleteFolder: Database.Statement<[string], void>;
  getFoldersByPrefix: Database.Statement<[string], Folder>;
  getAllFolders: Database.Statement<[], Folder>;
  folderExists: Database.Statement<[string], CountRow>;
  getFolderByPath: Database.Statement<[string], Folder | undefined>;
  updateFolderPrivate: Database.Statement<[number | null, string], void>;

  createOneTimeLink: Database.Statement<[string, string, number, number], void>;
  getOneTimeLink: Database.Statement<[string], OneTimeLink | undefined>;
  incrementUploadCount: Database.Statement<[string], void>;
  deleteOneTimeLink: Database.Statement<[string], void>;
  deleteExpiredOneTimeLinks: Database.Statement<[], void>;
  getAllOneTimeLinks: Database.Statement<[], OneTimeLink>;

  createExpireTime: Database.Statement<[string, number], void>;
  getExpireTime: Database.Statement<[string], ExpireTime | undefined>;
  deleteExpireTime: Database.Statement<[string], void>;
  deleteExpiredEntries: Database.Statement<[number], void>;

  createApiKey: Database.Statement<[string, string, string, string], void>;
  getApiKey: Database.Statement<[string], ApiKeyRow | undefined>;
  getAllApiKeys: Database.Statement<[], ApiKeyRow>;
  updateApiKeyLastUsed: Database.Statement<[number], void>;
  deactivateApiKey: Database.Statement<[number], void>;
  deleteApiKey: Database.Statement<[number], void>;

  createFile: Database.Statement<[string, string, string, number, string], void>;
  getFileByPath: Database.Statement<[string], FileRecord | undefined>;
  getFileById: Database.Statement<[string], FileRecord | undefined>;
  deleteFileByPath: Database.Statement<[string], void>;
  deleteFileById: Database.Statement<[string], void>;
  moveFile: Database.Statement<[string, string], void>;
  moveFilesInFolder: Database.Statement<[string, string, string], void>;
  getFilesInFolder: Database.Statement<[string], FileRecord>;
  getAllFiles: Database.Statement<[], FileRecord>;
  getFolderSizeByPrefix: Database.Statement<[string], SumRow>;
  updateExpireTimeKey: Database.Statement<[string, string], void>;
  updateFilePrivate: Database.Statement<[number | null, string], void>;
}

export const statements = {
  createUser: db.prepare<[string, string], void>(
    "INSERT INTO users (username, password_hash) VALUES (?, ?)"
  ),
  getUserById: db.prepare<[number], User>("SELECT * FROM users WHERE id = ?"),
  getUserByUsername: db.prepare<[string], User>("SELECT * FROM users WHERE username = ?"),
  getUserCount: db.prepare<[], CountRow>("SELECT COUNT(*) as count FROM users"),

  createFolder: db.prepare<[string], void>("INSERT OR IGNORE INTO folders (path) VALUES (?)"),
  deleteFolder: db.prepare<[string], void>("DELETE FROM folders WHERE path = ?"),
  getFoldersByPrefix: db.prepare<[string], Folder>(
    "SELECT * FROM folders WHERE path LIKE ? ORDER BY path"
  ),
  getAllFolders: db.prepare<[], Folder>("SELECT * FROM folders ORDER BY path"),
  folderExists: db.prepare<[string], CountRow>(
    "SELECT COUNT(*) as count FROM folders WHERE path = ?"
  ),
  getFolderByPath: db.prepare<[string], Folder>("SELECT * FROM folders WHERE path = ?"),
  updateFolderPrivate: db.prepare<[number | null, string], void>(
    "UPDATE folders SET is_private = ? WHERE path = ?"
  ),

  createOneTimeLink: db.prepare<[string, string, number, number], void>(
    "INSERT INTO one_time_links (token, upload_path, expires_at, max_uploads) VALUES (?, ?, ?, ?)"
  ),
  getOneTimeLink: db.prepare<[string], OneTimeLink>(
    "SELECT * FROM one_time_links WHERE token = ? AND expires_at > strftime('%s', 'now')"
  ),
  incrementUploadCount: db.prepare<[string], void>(
    "UPDATE one_time_links SET used_count = used_count + 1 WHERE token = ?"
  ),
  deleteOneTimeLink: db.prepare<[string], void>("DELETE FROM one_time_links WHERE token = ?"),
  deleteExpiredOneTimeLinks: db.prepare<[], void>(
    "DELETE FROM one_time_links WHERE expires_at <= strftime('%s', 'now')"
  ),
  getAllOneTimeLinks: db.prepare<[], OneTimeLink>(
    "SELECT * FROM one_time_links WHERE expires_at > strftime('%s', 'now') ORDER BY created_at DESC"
  ),

  createExpireTime: db.prepare<[string, number], void>(
    "INSERT INTO expire_times (object_key, timestamp) VALUES (?, ?)"
  ),
  getExpireTime: db.prepare<[string], ExpireTime>(
    "SELECT * FROM expire_times WHERE object_key = ?"
  ),
  deleteExpireTime: db.prepare<[string], void>("DELETE FROM expire_times WHERE object_key = ?"),
  deleteExpiredEntries: db.prepare<[number], void>("DELETE FROM expire_times WHERE timestamp <= ?"),

  createApiKey: db.prepare<[string, string, string, string], void>(
    "INSERT INTO api_keys (name, key, permissions, scoped_paths) VALUES (?, ?, ?, ?)"
  ),
  getApiKey: db.prepare<[string], ApiKeyRow>(
    "SELECT * FROM api_keys WHERE key = ? AND is_active = 1"
  ),
  getAllApiKeys: db.prepare<[], ApiKeyRow>(
    "SELECT * FROM api_keys WHERE is_active = 1 ORDER BY created_at DESC"
  ),
  updateApiKeyLastUsed: db.prepare<[number], void>(
    "UPDATE api_keys SET last_used_at = strftime('%s', 'now') WHERE id = ?"
  ),
  deactivateApiKey: db.prepare<[number], void>("UPDATE api_keys SET is_active = 0 WHERE id = ?"),
  deleteApiKey: db.prepare<[number], void>("DELETE FROM api_keys WHERE id = ?"),

  createFile: db.prepare<[string, string, string, number, string], void>(
    "INSERT INTO files (id, path, extension, size, content_type) VALUES (?, ?, ?, ?, ?)"
  ),
  getFileByPath: db.prepare<[string], FileRecord>("SELECT * FROM files WHERE path = ?"),
  getFileById: db.prepare<[string], FileRecord>("SELECT * FROM files WHERE id = ?"),
  deleteFileByPath: db.prepare<[string], void>("DELETE FROM files WHERE path = ?"),
  deleteFileById: db.prepare<[string], void>("DELETE FROM files WHERE id = ?"),
  moveFile: db.prepare<[string, string], void>("UPDATE files SET path = ? WHERE path = ?"),
  moveFilesInFolder: db.prepare<[string, string, string], void>(
    "UPDATE files SET path = ? || substr(path, length(?) + 1) WHERE path LIKE ? || '%'"
  ),
  getFilesInFolder: db.prepare<[string], FileRecord>(
    "SELECT * FROM files WHERE path LIKE ? || '%' ORDER BY path"
  ),
  getAllFiles: db.prepare<[], FileRecord>("SELECT * FROM files ORDER BY path"),
  getFolderSizeByPrefix: db.prepare<[string], SumRow>(
    "SELECT COALESCE(SUM(size), 0) as size FROM files WHERE path LIKE ? || '%'"
  ),
  updateExpireTimeKey: db.prepare<[string, string], void>(
    "UPDATE expire_times SET object_key = ? WHERE object_key = ?"
  ),
  updateFilePrivate: db.prepare<[number | null, string], void>(
    "UPDATE files SET is_private = ? WHERE path = ?"
  )
} satisfies Statements;

export function isPathPrivate(pathStr: string): boolean {
  // 1. Check file itself
  const file = statements.getFileByPath.get(pathStr);
  if (file && file.is_private !== null) {
    return file.is_private === 1;
  }

  // 2. Traversal of parent folders from deepest outward
  const parts = pathStr.split("/");
  for (let i = parts.length - 1; i > 0; i--) {
    const folderPath = parts.slice(0, i).join("/") + "/";
    const folder = statements.getFolderByPath.get(folderPath);
    if (folder && folder.is_private !== null) {
      return folder.is_private === 1;
    }
  }

  return false;
}
