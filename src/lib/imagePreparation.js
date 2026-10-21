import { readImageDimensions, validateImageDimensions, validateImageFile } from './imageUploadValidation.js';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_PREPARED_EDGE = 4096;
export const MAX_PREPARED_PIXELS = 16_000_000;
const preparedFiles = new WeakSet();

export const isPreparedImage = file => preparedFiles.has(file);
export const markPreparedImage = file => { preparedFiles.add(file); return file; };

export function uploadImageError(error) {
  const code = String(error?.code || '');
  if (code.includes('unauthorized') || code.includes('unauthenticated')) return new Error('Storage permission denied. Sign in again and retry.');
  if (code.includes('canceled') || error?.name === 'AbortError') return new Error('Upload interrupted. Choose Retry when ready.');
  if (code.includes('retry-limit') || code.includes('unknown') || globalThis.navigator?.onLine === false) return new Error('Upload interrupted by the connection. Check your network and retry.');
  return error instanceof Error ? error : new Error('The photo could not be uploaded. Try again.');
}

const decodeError = type => new Error(type === 'image/heic' || type === 'image/heif'
  ? 'This device cannot open this HEIC photo. Convert a copy to JPEG with your device’s Convert Image action or another trusted tool, then retry.'
  : 'This photo could not be opened. Try a JPEG copy or choose another image.');

function loadImage(file, type = file.type) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(decodeError(type)); };
    image.src = url;
  });
}

export async function inspectImageFile(file) {
  const type = await validateImageFile(file);
  let dimensions = await readImageDimensions(file, type);
  if (!dimensions) {
    const image = await loadImage(file, type);
    dimensions = { width: image.naturalWidth, height: image.naturalHeight };
  }
  validateImageDimensions(dimensions.width, dimensions.height);
  const { width, height } = dimensions;
  return {
    type, width, height,
    needsPreparation: type === 'image/heic' || type === 'image/heif' || file.size > MAX_UPLOAD_BYTES
      || Math.max(width, height) > MAX_PREPARED_EDGE || width * height > MAX_PREPARED_PIXELS
      || Math.max(width, height) / Math.min(width, height) >= 2.5,
  };
}

async function decodeForCanvas(file, dimensions) {
  const ratio = Math.min(1, MAX_PREPARED_EDGE / Math.max(dimensions.width, dimensions.height),
    Math.sqrt(MAX_PREPARED_PIXELS / (dimensions.width * dimensions.height)));
  if (typeof createImageBitmap === 'function') {
    let bitmap = null;
    try {
      const options = { imageOrientation: 'from-image' };
      if (ratio < 1) {
        options.resizeWidth = Math.max(1, Math.round(dimensions.width * ratio));
        options.resizeHeight = Math.max(1, Math.round(dimensions.height * ratio));
        options.resizeQuality = 'high';
      }
      bitmap = await createImageBitmap(file, options);
    } catch (error) {
      if (/memory|allocation/i.test(String(error?.message || ''))) throw new Error('Image processing ran out of memory. Try a smaller resize.');
      // Safari may not support bitmap resize or this format.
    }
    if (bitmap) {
      if (bitmap.width * bitmap.height > MAX_PREPARED_PIXELS || Math.max(bitmap.width, bitmap.height) > MAX_PREPARED_EDGE) {
        bitmap.close();
        throw new Error('This browser could not downscale the panorama while decoding. Export a smaller JPEG copy and try again.');
      }
      return bitmap;
    }
  }
  // Object URLs avoid the large base64 copy made by FileReader. The canvas
  // remains bounded even where the browser must decode the source itself.
  try { return await loadImage(file, dimensions.type); }
  catch (error) {
    if (dimensions.type !== 'image/heic' && dimensions.type !== 'image/heif'
      && dimensions.width * dimensions.height > 20_000_000) {
      throw new Error('This device could not decode the large photo. Export a smaller JPEG copy and retry.');
    }
    throw error;
  }
}

function canvasBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Image processing ran out of memory. Try a smaller resize.')), 'image/jpeg', quality);
    } catch { reject(new Error('Image processing ran out of memory. Try a smaller resize.')); }
  });
}

export async function prepareImageFile(file, { info, mode = 'resize', maxEdge = 2048, crop = null } = {}) {
  const inspected = info || await inspectImageFile(file);
  const edge = mode === 'full' ? MAX_PREPARED_EDGE : Math.min(MAX_PREPARED_EDGE, Math.max(640, Number(maxEdge) || 2048));
  let source;
  try {
    source = await decodeForCanvas(file, inspected);
    const sourceWidth = source.width || source.naturalWidth;
    const sourceHeight = source.height || source.naturalHeight;
    if (!sourceWidth || !sourceHeight) throw decodeError(inspected.type);
    const region = mode === 'crop' ? {
      x: Math.max(0, Math.min(0.99, Number(crop?.x) || 0)),
      y: Math.max(0, Math.min(0.99, Number(crop?.y) || 0)),
      width: Math.max(0.01, Math.min(1, Number(crop?.width) || 1)),
      height: Math.max(0.01, Math.min(1, Number(crop?.height) || 1)),
    } : { x: 0, y: 0, width: 1, height: 1 };
    region.width = Math.min(region.width, 1 - region.x);
    region.height = Math.min(region.height, 1 - region.y);
    const cropWidth = Math.max(1, Math.round(sourceWidth * region.width));
    const cropHeight = Math.max(1, Math.round(sourceHeight * region.height));
    const scale = Math.min(1, edge / Math.max(cropWidth, cropHeight), Math.sqrt(MAX_PREPARED_PIXELS / (cropWidth * cropHeight)));
    let width = Math.max(1, Math.round(cropWidth * scale));
    let height = Math.max(1, Math.round(cropHeight * scale));
    const canvas = document.createElement('canvas');
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try { canvas.width = width; canvas.height = height; }
      catch { throw new Error('Image processing ran out of memory. Try a smaller resize.'); }
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('Image processing ran out of memory. Try a smaller resize.');
      try {
        context.drawImage(source, Math.round(sourceWidth * region.x), Math.round(sourceHeight * region.y), cropWidth, cropHeight, 0, 0, width, height);
      } catch { throw new Error('Image processing ran out of memory. Try a smaller resize.'); }
      for (const quality of [0.84, 0.74, 0.64]) {
        const blob = await canvasBlob(canvas, quality);
        if (blob.size > 0 && blob.size <= MAX_UPLOAD_BYTES) {
          const result = new File([blob], 'spotfinder-photo.jpg', { type: 'image/jpeg', lastModified: Date.now() });
          return { file: markPreparedImage(result), width, height, bytes: result.size };
        }
      }
      width = Math.max(1, Math.round(width * 0.8));
      height = Math.max(1, Math.round(height * 0.8));
    }
    throw new Error('The prepared photo is still over 5 MB. Choose a smaller resize or crop.');
  } finally {
    if (typeof source?.close === 'function') source.close();
  }
}
