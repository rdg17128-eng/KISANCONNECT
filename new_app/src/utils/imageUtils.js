/**
 * Client-Side Image Compression Utility
 * Resizes and compresses image files/data URLs to avoid localStorage quota issues
 * and optimize network/render performance.
 */

export function compressImageFile(fileOrDataUrl, maxWidth = 1000, maxHeight = 1000, quality = 0.78) {
    return new Promise((resolve) => {
        if (!fileOrDataUrl) {
            return resolve('');
        }

        const processImgSrc = (src) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                let width = img.width || 800;
                let height = img.height || 600;

                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                    resolve(compressedDataUrl);
                } catch (canvasErr) {
                    console.warn("Canvas compression fallback to raw data URL:", canvasErr);
                    resolve(src);
                }
            };

            img.onerror = () => {
                console.warn("Image load failed for compression, returning original string");
                resolve(typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '');
            };

            img.src = src;
        };

        if (typeof fileOrDataUrl === 'string') {
            processImgSrc(fileOrDataUrl);
        } else if (fileOrDataUrl instanceof Blob || fileOrDataUrl instanceof File) {
            const reader = new FileReader();
            reader.onload = (e) => processImgSrc(e.target.result);
            reader.onerror = () => resolve('');
            reader.readAsDataURL(fileOrDataUrl);
        } else {
            resolve('');
        }
    });
}
