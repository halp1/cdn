export interface DroppedFile {
  file: File;
  relativePath: string;
}

const traverseEntry = async (
  entry: FileSystemEntry,
  pathPrefix: string,
  results: DroppedFile[]
): Promise<void> => {
  if (entry.isFile) {
    await new Promise<void>((resolve) =>
      (entry as FileSystemFileEntry).file((file) => {
        results.push({ file, relativePath: pathPrefix + file.name });
        resolve();
      })
    );
  } else if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    const reader = dirEntry.createReader();
    const readBatch = async (): Promise<void> => {
      const entries = await new Promise<FileSystemEntry[]>((resolve, reject) =>
        reader.readEntries(resolve, reject)
      );
      if (entries.length === 0) return;
      await Promise.all(
        entries.map((e) => traverseEntry(e, pathPrefix + dirEntry.name + "/", results))
      );
      await readBatch();
    };
    await readBatch();
  }
};

export const collectDroppedFiles = async (dataTransfer: DataTransfer): Promise<DroppedFile[]> => {
  const results: DroppedFile[] = [];
  if (dataTransfer.items?.length) {
    const promises: Promise<void>[] = [];
    for (let i = 0; i < dataTransfer.items.length; i++) {
      const item = dataTransfer.items[i];
      const entry = item.webkitGetAsEntry?.();
      if (entry) {
        promises.push(traverseEntry(entry, "", results));
      } else if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) results.push({ file, relativePath: file.name });
      }
    }
    await Promise.all(promises);
  } else {
    for (let i = 0; i < dataTransfer.files.length; i++) {
      const file = dataTransfer.files[i];
      results.push({ file, relativePath: file.name });
    }
  }
  return results;
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

export const formatNumber = (n: number): string => n.toLocaleString();

export const getFileExtension = (key: string): string => {
  const parts = key.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
};

export const getFileName = (key: string): string => {
  const parts = key.split("/");
  return parts[parts.length - 1];
};

export const getRelativePath = (key: string, prefix: string): string => {
  return prefix ? key.replace(new RegExp(`^${prefix}`), "") : key;
};
