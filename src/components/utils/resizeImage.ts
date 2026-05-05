export const resizeImage = (file: File, maxSize: number): Promise<File> => {
	return new Promise((resolve, reject) => {
		const img = new Image();
		const reader = new FileReader();

		reader.onload = (e) => {
			img.src = e.target?.result as string;
		};

		img.onload = () => {
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');

			let width = img.width;
			let height = img.height;

			if (width <= maxSize && height <= maxSize) {
				resolve(file);
				return;
			}

			if (width > height) {
				if (width > maxSize) {
					height = Math.round((height *= maxSize / width));
					width = maxSize;
				}
			} else {
				if (height > maxSize) {
					width = Math.round((width *= maxSize / height));
					height = maxSize;
				}
			}

			canvas.width = width;
			canvas.height = height;
			ctx?.drawImage(img, 0, 0, width, height);

			canvas.toBlob((blob) => {
				if (blob) {
					resolve(new File([blob], file.name, { type: file.type }));
				} else {
					reject(new Error('Canvas is empty'));
				}
			}, file.type);
		};

		reader.readAsDataURL(file);
	});
};
