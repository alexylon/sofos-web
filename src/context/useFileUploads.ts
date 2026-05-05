import { useCallback, useState } from 'react';
import { IMAGE_MAX_DIMENSION, MAX_FILES, MAX_IMAGES } from '@/components/utils/constants';
import { resizeImage } from '@/components/utils/resizeImage';

export interface FileUploadsApi {
	images: File[];
	files: File[];
	hasImages: boolean;
	hasFiles: boolean;
	setImages: React.Dispatch<React.SetStateAction<File[]>>;
	setFiles: React.Dispatch<React.SetStateAction<File[]>>;
	handleFilesChange: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
	handleRemoveImage: (index: number) => void;
	handleRemoveFile: (index: number) => void;
}

export const useFileUploads = (): FileUploadsApi => {
	const [images, setImages] = useState<File[]>([]);
	const [files, setFiles] = useState<File[]>([]);

	const handleFilesChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
		if (!event.target.files) return;

		const fileArray = Array.from(event.target.files);
		const newImages = fileArray.filter(file => file.type.startsWith('image/'));
		const newFiles = fileArray.filter(file => !file.type.startsWith('image/'));
		const resizedImages: File[] = [];

		for (const image of newImages) {
			try {
				resizedImages.push(await resizeImage(image, IMAGE_MAX_DIMENSION));
			} catch (error) {
				console.error(`Error resizing image ${image.name}:`, error);
			}
		}

		setImages(prev => {
			if (resizedImages.length > MAX_IMAGES) {
				console.warn(`You can only upload up to ${MAX_IMAGES} images.`);
			}
			return [...prev, ...resizedImages].slice(0, MAX_IMAGES);
		});

		setFiles(prev => {
			if (newFiles.length > MAX_FILES) {
				console.warn(`You can only upload up to ${MAX_FILES} files.`);
			}
			return [...prev, ...newFiles].slice(0, MAX_FILES);
		});
	}, []);

	const handleRemoveImage = useCallback((index: number) => {
		setImages(prev => prev.filter((_, i) => i !== index));
	}, []);

	const handleRemoveFile = useCallback((index: number) => {
		setFiles(prev => prev.filter((_, i) => i !== index));
	}, []);

	return {
		images,
		files,
		hasImages: images.length > 0,
		hasFiles: files.length > 0,
		setImages,
		setFiles,
		handleFilesChange,
		handleRemoveImage,
		handleRemoveFile,
	};
};
