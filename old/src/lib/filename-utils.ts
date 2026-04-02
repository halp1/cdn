/**
 * Sanitize filename to prevent path traversal and other security issues
 */
export function sanitizeFilename(filename: string): string {
	if (!filename) return 'unnamed-file';

	// Remove path separators and dangerous characters
	let sanitized = filename
		.replace(/[/\\:*?"<>|]/g, '_') // Replace dangerous characters with underscore
		.replace(/\.\./g, '_'); // Remove path traversal attempts

	// Ensure the filename isn't empty after sanitization
	if (!sanitized || sanitized === '_') {
		sanitized = 'unnamed-file';
	}

	// Limit length to prevent issues
	if (sanitized.length > 255) {
		const ext = sanitized.split('.').pop();
		const name = sanitized.substring(0, 250 - (ext ? ext.length + 1 : 0));
		sanitized = ext ? `${name}.${ext}` : name;
	}

	return sanitized;
}

/**
 * Generate a unique filename if one already exists
 */
export function makeUniqueFilename(filename: string, existingFiles: string[]): string {
	const sanitized = sanitizeFilename(filename);

	if (!existingFiles.includes(sanitized)) {
		return sanitized;
	}

	const parts = sanitized.split('.');
	const ext = parts.length > 1 ? parts.pop() : '';
	const name = parts.join('.');

	let counter = 1;
	let uniqueName: string;

	do {
		uniqueName = ext ? `${name}_${counter}.${ext}` : `${name}_${counter}`;
		counter++;
	} while (existingFiles.includes(uniqueName));

	return uniqueName;
}
