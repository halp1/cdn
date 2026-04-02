import {
	faFile,
	faFileImage,
	faFileVideo,
	faFileAudio,
	faFileArchive,
	faFileCode,
	faFilePdf,
	faFileWord,
	faFileExcel,
	faFilePowerpoint,
	faFileText,
	faCog,
	faTerminal
} from '@fortawesome/free-solid-svg-icons';

export interface FileIconData {
	icon: typeof faFile;
	color: string;
}

/**
 * Get appropriate icon and color based on file extension
 */
export function getFileIcon(fileName: string): FileIconData {
	const extension = fileName.toLowerCase().split('.').pop() || '';
	
	// Image files
	if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tiff', 'tif'].includes(extension)) {
		return { icon: faFileImage, color: 'text-purple-400' };
	}
	
	// Video files
	if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', 'm4v', '3gp', 'ogv'].includes(extension)) {
		return { icon: faFileVideo, color: 'text-red-400' };
	}
	
	// Audio files
	if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'opus'].includes(extension)) {
		return { icon: faFileAudio, color: 'text-pink-400' };
	}
	
	// Archive files
	if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'z', 'lz', 'lzma'].includes(extension)) {
		return { icon: faFileArchive, color: 'text-orange-400' };
	}
	
	// Code files
	if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'scala', 'r', 'matlab', 'm'].includes(extension)) {
		return { icon: faFileCode, color: 'text-blue-400' };
	}
	
	// Web files
	if (['html', 'htm', 'css', 'scss', 'sass', 'less', 'xml', 'json', 'yaml', 'yml'].includes(extension)) {
		return { icon: faFileCode, color: 'text-green-400' };
	}
	
	// Document files
	if (['pdf'].includes(extension)) {
		return { icon: faFilePdf, color: 'text-red-500' };
	}
	
	if (['doc', 'docx'].includes(extension)) {
		return { icon: faFileWord, color: 'text-blue-600' };
	}
	
	if (['xls', 'xlsx'].includes(extension)) {
		return { icon: faFileExcel, color: 'text-green-600' };
	}
	
	if (['ppt', 'pptx'].includes(extension)) {
		return { icon: faFilePowerpoint, color: 'text-orange-600' };
	}
	
	// Text files
	if (['txt', 'md', 'log', 'cfg', 'conf', 'ini', 'readme'].includes(extension)) {
		return { icon: faFileText, color: 'text-gray-400' };
	}
	
	// Executable/binary files
	if (['exe', 'msi', 'deb', 'rpm', 'dmg', 'app', 'bin', 'run'].includes(extension)) {
		return { icon: faCog, color: 'text-yellow-400' };
	}
	
	// Shell/script files
	if (['sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd'].includes(extension)) {
		return { icon: faTerminal, color: 'text-cyan-400' };
	}
	
	// Default file icon
	return { icon: faFile, color: 'text-gray-300' };
}
