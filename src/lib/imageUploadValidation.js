export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const IMAGE_ACCEPT = ALLOWED_IMAGE_TYPES.join(',');
export const MAX_SOURCE_IMAGE_BYTES = 12 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 20_000_000;
export const MAX_IMAGE_DIMENSION = 10_000;

export function validateImageFileMetadata(file) {
  if (!file) throw new Error('Choose an image to upload.');
  if (!ALLOWED_IMAGE_TYPES.includes(String(file.type || '').toLowerCase())) {
    throw new Error('Use a JPEG, PNG, or WebP image.');
  }
  if (!Number.isFinite(file.size) || file.size <= 0) throw new Error('The image is empty.');
  if (file.size > MAX_SOURCE_IMAGE_BYTES) throw new Error('Images must be 12 MB or smaller.');
}

export function detectImageType(bytes) {
  if (!bytes || bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
      && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
      && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  return null;
}

export async function validateImageFile(file) {
  validateImageFileMetadata(file);
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const detectedType = detectImageType(header);
  if (!detectedType || detectedType !== file.type.toLowerCase()) {
    throw new Error('The file contents do not match a supported image format.');
  }
  return detectedType;
}

export function validateImageDimensions(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error('The image has invalid dimensions.');
  }
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION || width * height > MAX_IMAGE_PIXELS) {
    throw new Error('The image dimensions are too large.');
  }
}
