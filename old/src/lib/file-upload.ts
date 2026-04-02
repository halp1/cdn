import { toast } from '$lib/toast';
import { getUploadUrl } from '$lib/r2';
import { sanitizeFilename } from '$lib/filename-utils';

export type UploadFile = {
	file: File;
	progress: number;
	isUploading: boolean;
	abort: () => void;
};

export function uploadFile(
	uploadFile: UploadFile,
	prefix: string,
	uploadFiles: UploadFile[],
	onUploadComplete: () => Promise<void>,
	onProgress?: (files: UploadFile[]) => void
): Promise<UploadFile[]> {
	return new Promise(async (resolve) => {
		if (!uploadFile.file || uploadFile.isUploading) {
			return resolve(uploadFiles);
		}

		const sanitizedName = sanitizeFilename(uploadFile.file.name);
		const key = prefix + sanitizedName;

		uploadFile.isUploading = true;
		uploadFile.progress = 0;
		try {
			const signedUrl = await getUploadUrl(key, uploadFile.file.type);
			const xhr = new XMLHttpRequest();
			xhr.open('PUT', signedUrl);
			xhr.upload.onprogress = (event) => {
				if (event.lengthComputable) {
					const progressValue = Math.round((event.loaded / event.total) * 100);
					// prepare updated array with new progress
					const newUploadFiles = uploadFiles.map((f) =>
						f.file === uploadFile.file ? { ...f, progress: progressValue } : f
					);
					// callback for intermediate progress updates
					onProgress && onProgress(newUploadFiles);
				}
			};
			xhr.onload = async () => {
				uploadFile.isUploading = false;
				if (xhr.status === 200) {
					// Show different message if filename was sanitized
					if (sanitizedName !== uploadFile.file.name) {
						toast.success(`${uploadFile.file.name} uploaded as "${sanitizedName}"`);
					} else {
						toast.success(`${uploadFile.file.name} uploaded successfully!`);
					}
					await onUploadComplete();
					return resolve(uploadFiles.filter((f) => f.file !== uploadFile.file));
				} else {
					toast.error(`Upload failed for ${uploadFile.file.name}`);
					return resolve(uploadFiles);
				}
			};
			xhr.onerror = () => {
				toast.error(`Upload failed for ${uploadFile.file.name}`);
				uploadFile.isUploading = false;
				return resolve(uploadFiles);
			};
			xhr.send(uploadFile.file);
			uploadFile.abort = () => {
				xhr.abort();
				uploadFile.isUploading = false;
				resolve(uploadFiles.filter((f) => f.file !== uploadFile.file));
			};
		} catch (err) {
			toast.error(`Failed to get upload URL for ${uploadFile.file.name}`);
			uploadFile.isUploading = false;
			console.error(err);
			resolve(uploadFiles);
		}
	});
}

export function processDirectoryEntry(
	directoryEntry: FileSystemDirectoryEntry,
	basePrefix: string,
	uploadFiles: UploadFile[],
	onFileProcessed: (file: File, dirPath: string) => void
) {
	const dirReader = directoryEntry.createReader();
	const dirPath = basePrefix + directoryEntry.name + '/';

	const readEntries = () => {
		dirReader.readEntries(
			(entries) => {
				if (entries.length > 0) {
					for (const entry of entries) {
						if (entry.isDirectory) {
							processDirectoryEntry(
								entry as FileSystemDirectoryEntry,
								dirPath,
								uploadFiles,
								onFileProcessed
							);
						} else if (entry.isFile) {
							processFileEntry(entry as FileSystemFileEntry, dirPath, onFileProcessed);
						}
					}
					// Continue reading (readEntries is limited to batches)
					readEntries();
				}
			},
			(error) => {
				console.error('Error reading directory entries:', error);
			}
		);
	};

	readEntries();
}

export function processFileEntry(
	fileEntry: FileSystemFileEntry,
	prefix: string,
	onFileProcessed: (file: File, dirPath: string) => void
) {
	fileEntry.file(
		(file) => {
			// Create a new file object with sanitized name
			const sanitizedName = sanitizeFilename(file.name);
			const sanitizedFile = new File([file], sanitizedName, { type: file.type });
			onFileProcessed(sanitizedFile, prefix);
		},
		(error) => {
			console.error('Error getting file:', error);
		}
	);
}
