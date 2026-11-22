export const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PROFILE_PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp';
export const PROFILE_PHOTO_MAX_DIMENSION = 1280;

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const ALLOWED_EXTENSIONS = /\.(jpe?g|png|webp)$/i;

export function validateProfilePhoto(file: File): string | null {
  const typeOk = ALLOWED_TYPES.has(file.type) || ALLOWED_EXTENSIONS.test(file.name);
  if (!typeOk) {
    return 'Unsupported file type. Please choose a JPG, JPEG, PNG, or WEBP image.';
  }
  if (file.size > PROFILE_PHOTO_MAX_BYTES) {
    return 'Photo is too large. Please choose an image under 5 MB.';
  }
  if (file.size === 0) {
    return 'That file is empty. Please choose another image.';
  }
  return null;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image. Please choose another file.'));
    };
    image.src = url;
  });
}

/**
 * Resizes and compresses a profile photo in the browser. Falls back to the
 * original file if the browser cannot encode WebP or the result is larger.
 */
export async function prepareProfilePhoto(file: File): Promise<File> {
  const validationError = validateProfilePhoto(file);
  if (validationError) throw new Error(validationError);

  let image: HTMLImageElement;
  try {
    image = await loadImage(file);
  } catch {
    return file;
  }

  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = Math.min(1, PROFILE_PHOTO_MAX_DIMENSION / longestSide);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return file;

  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/webp', 0.85);
  });

  if (!blob || (blob.size >= file.size && scale === 1)) {
    return file;
  }

  const extension = blob.type === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], `profile-photo.${extension}`, {
    type: blob.type || 'image/webp',
    lastModified: Date.now(),
  });
}
