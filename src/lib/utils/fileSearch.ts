/**
 * Case-insensitive file search/filter utility
 */

export interface FileSearchResult {
  key: string;
  isFolder: boolean;
  parentPath: string;
}

/**
 * Filter files by case-insensitive substring matching
 * @param files Array of all file objects
 * @param query Search query string
 * @returns Filtered array of files matching the query
 */
export function filterFiles(
  files: { key: string; isFolder: boolean }[],
  query: string
): FileSearchResult[] {
  if (!query) return [];

  const lowerQuery = query.toLowerCase();

  return files
    .filter((file) => file.key.toLowerCase().includes(lowerQuery))
    .map((file) => {
      // Extract parent path (everything before the last slash)
      const lastSlashIndex = file.key.lastIndexOf("/");
      const parentPath = lastSlashIndex > 0 ? file.key.slice(0, lastSlashIndex) : "";

      return {
        key: file.key,
        isFolder: file.isFolder,
        parentPath
      };
    });
}

/**
 * Get the display name for a file (filename without the full path)
 */
export function getDisplayName(key: string): string {
  const lastSlashIndex = key.lastIndexOf("/");
  return lastSlashIndex >= 0 ? key.slice(lastSlashIndex + 1) : key;
}
