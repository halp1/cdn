export const sanitizeFilename = (filename: string): string => {
  if (!filename) return "unnamed-file";

  let sanitized = filename
    .replace(/[/\\:*?"<>|]/g, "_")
    .replace(/\.\./g, "_")
    .trim();

  if (!sanitized || sanitized === "_") sanitized = "unnamed-file";

  if (sanitized.length > 255) {
    const parts = sanitized.split(".");
    const ext = parts.length > 1 ? parts.pop()! : "";
    const name = parts.join(".");
    sanitized = ext ? `${name.substring(0, 250 - ext.length - 1)}.${ext}` : name.substring(0, 255);
  }

  return sanitized;
};

export const makeUniqueFilename = (filename: string, existingFiles: string[]): string => {
  const sanitized = sanitizeFilename(filename);
  if (!existingFiles.includes(sanitized)) return sanitized;

  const dotIndex = sanitized.lastIndexOf(".");
  const name = dotIndex > 0 ? sanitized.substring(0, dotIndex) : sanitized;
  const ext = dotIndex > 0 ? sanitized.substring(dotIndex) : "";

  let counter = 1;
  let unique: string;
  do {
    unique = `${name}_${counter}${ext}`;
    counter++;
  } while (existingFiles.includes(unique));

  return unique;
};
