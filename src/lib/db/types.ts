export interface User {
  id: number;
  username: string;
  password_hash: string;
}

export interface Folder {
  id: number;
  path: string;
  created_at: number;
  is_private: number | null;
}

export interface OneTimeLink {
  id: number;
  token: string;
  upload_path: string;
  expires_at: number;
  max_uploads: number;
  used_count: number;
  created_at: number;
}

export interface ExpireTime {
  id: number;
  object_key: string;
  timestamp: number;
}

export type ApiKeyPermission = "read" | "write" | "delete" | "list";

export interface ApiKeyRow {
  id: number;
  name: string;
  key: string;
  permissions: string;
  scoped_paths: string;
  created_at: number;
  last_used_at: number | null;
  is_active: number;
}

export interface ApiKey {
  id: number;
  name: string;
  key: string;
  permissions: ApiKeyPermission[];
  scoped_paths: string[];
  created_at: number;
  last_used_at: number | null;
  is_active: boolean;
}

export interface ApiKeyCreate {
  name: string;
  permissions: ApiKeyPermission[];
  scopedPaths: string[];
}

export interface FileRecord {
  id: string;
  path: string;
  extension: string;
  size: number;
  content_type: string;
  created_at: number;
  is_private: number | null;
}

export interface SumRow {
  size: number;
}

export interface CountRow {
  count: number;
}

export interface OAuthToken {
  provider: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: number | null;
  client_id: string | null;
  client_secret: string | null;
  redirect_uri: string | null;
  folder_id: string | null;
}

export interface BackupRow {
  id: number;
  timestamp: number;
  status: "success" | "failed";
  error_message: string | null;
  drive_file_id: string | null;
}
