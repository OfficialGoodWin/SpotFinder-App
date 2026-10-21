export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
export const IMAGE_ACCEPT = `${ALLOWED_IMAGE_TYPES.join(',')},.heic,.heif`;
export const MAX_SOURCE_IMAGE_BYTES = 40 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 100_000_000;
export const MAX_IMAGE_DIMENSION = 32_768;

export function validateImageFileMetadata(file) {
  if (!file) throw new Error('Choose an image to upload.');
  const type = String(file.type || '').toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.includes(type) && !(type === '' && /\.(?:heic|heif)$/i.test(file.name || ''))) {
    throw new Error('Choose a JPEG, PNG, WebP, or HEIC/HEIF photo.');
  }
  if (!Number.isFinite(file.size) || file.size <= 0) throw new Error('The image is empty.');
  if (file.size > MAX_SOURCE_IMAGE_BYTES) throw new Error('This photo is over 40 MB. Export a smaller copy and try again.');
}

export function detectImageType(bytes) {
  if (!bytes || bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
      && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
      && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(...bytes.slice(8, 12));
    if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis'].includes(brand)) return 'image/heic';
    if (['mif1', 'msf1'].includes(brand)) return 'image/heif';
  }
  return null;
}

export async function validateImageFile(file) {
  validateImageFileMetadata(file);
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const detectedType = detectImageType(header);
  const declared = String(file.type || '').toLowerCase();
  if (!detectedType || (declared && detectedType !== declared && !(detectedType === 'image/heic' && declared === 'image/heif') && !(detectedType === 'image/heif' && declared === 'image/heic'))) {
    throw new Error('The file contents do not match a supported image format.');
  }
  return detectedType;
}

export function validateImageDimensions(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error('The image has invalid dimensions.');
  }
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION || width * height > MAX_IMAGE_PIXELS) {
    throw new Error('This photo exceeds the safe decoding limit. Export a smaller copy and try again.');
  }
}

export async function readImageDimensions(file, type) {
  const bytes = new Uint8Array(await file.slice(0, 262_144).arrayBuffer());
  const view = new DataView(bytes.buffer);
  if (type === 'image/png' && bytes.length >= 24) return { width: view.getUint32(16), height: view.getUint32(20) };
  if (type === 'image/jpeg') {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0xff || marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue; }
      const length = view.getUint16(offset + 2);
      if (length < 2 || offset + 2 + length > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { width: view.getUint16(offset + 7), height: view.getUint16(offset + 5) };
      }
      offset += 2 + length;
    }
  }
  if (type === 'image/webp' && bytes.length >= 30) {
    const chunk = String.fromCharCode(...bytes.slice(12, 16));
    if (chunk === 'VP8X') return { width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16), height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16) };
    if (chunk === 'VP8 ' && bytes.length >= 30) return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
    if (chunk === 'VP8L' && bytes.length >= 25) return { width: 1 + (((bytes[22] & 0x3f) << 8) | bytes[21]), height: 1 + (((bytes[24] & 0x0f) << 10) | (bytes[23] << 2) | ((bytes[22] & 0xc0) >> 6)) };
  }
  return null;
}
