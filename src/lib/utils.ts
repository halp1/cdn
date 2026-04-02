export const formatFileSize = (bytes: number): string => {
	if (bytes === 0) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

export const formatNumber = (n: number): string => n.toLocaleString();

export const getFileExtension = (key: string): string => {
	const parts = key.split('.');
	return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
};

export const getFileName = (key: string): string => {
	const parts = key.split('/');
	return parts[parts.length - 1];
};

export const getRelativePath = (key: string, prefix: string): string => {
	return prefix ? key.replace(new RegExp(`^${prefix}`), '') : key;
};
