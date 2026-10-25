import { inspectImageFile, prepareImageFile } from './imagePreparation.js';

// The same prepared File is used for the visible preview, drafts, and publishing.
export async function prepareContributionPhoto(file) {
  let info;
  try {
    info = await inspectImageFile(file);
    const result = await prepareImageFile(file, {
      info,
      mode: 'resize',
      maxEdge: Math.max(info.width, info.height) / Math.min(info.width, info.height) >= 2.5 ? 4096 : 3072,
    });
    return { ...result, original: { type: info.type, size: file.size, width: info.width, height: info.height } };
  } catch (error) {
    console.error('Spot photo preparation failed', {
      stage: info ? 'conversion' : 'inspection', mimeType: file.type || 'unknown',
      size: file.size, dimensions: info ? { width: info.width, height: info.height } : null,
      conversion: 'failed', code: error?.code || error?.name || 'unknown',
    });
    throw error;
  }
}
