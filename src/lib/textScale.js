export const TEXT_SCALE_KEY = 'spotfinder_text_scale_v1';
export const TEXT_SCALE_MIN = 75;
export const TEXT_SCALE_MAX = 250;
export const TEXT_SCALE_DEFAULT = 100;

export function normalizeTextScale(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return TEXT_SCALE_DEFAULT;
  return Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, Math.round(numeric / 5) * 5));
}

export function getTextScale(storage = globalThis.localStorage) {
  try {
    return normalizeTextScale(storage?.getItem(TEXT_SCALE_KEY) ?? TEXT_SCALE_DEFAULT);
  } catch {
    return TEXT_SCALE_DEFAULT;
  }
}

export function applyTextScale(value, documentElement = globalThis.document?.documentElement) {
  const scale = normalizeTextScale(value);
  documentElement?.style.setProperty('font-size', `${scale}%`);
  if (documentElement) documentElement.dataset.sfTextScale = scale >= 175 ? 'large' : 'standard';
  return scale;
}

export function saveTextScale(value, storage = globalThis.localStorage) {
  const scale = normalizeTextScale(value);
  try { storage?.setItem(TEXT_SCALE_KEY, String(scale)); } catch { /* use in-memory value */ }
  applyTextScale(scale);
  return scale;
}
