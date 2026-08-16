// Replaces all Capacitor imports

export const isNative = () => typeof window.NativeBridge !== 'undefined';

// Initialize callback registry
if (typeof window !== 'undefined') {
  window.NativeBridgeCallbacks = window.NativeBridgeCallbacks || {};
  window.NativeBridgeProgress  = window.NativeBridgeProgress  || {};
}

let callbackId = 0;
function nextId() { return `cb_${++callbackId}_${Date.now()}`; }

// Download a file natively — returns { ok, path, sizeMB } or { ok:false, error }
export function nativeDownloadFile(url, filename, onProgress) {
  return new Promise((resolve) => {
    if (!isNative()) {
      resolve({ ok: false, error: 'Not running on native Android' });
      return;
    }
    const id = nextId();
    window.NativeBridgeCallbacks[id] = resolve;
    if (onProgress) window.NativeBridgeProgress[id] = onProgress;
    window.NativeBridge.downloadFile(url, filename, id);
  });
}

// Read a file as base64
export function nativeReadFileAsBase64(path) {
  return new Promise((resolve) => {
    if (!isNative()) {
      resolve({ ok: false, error: 'Not running on native Android' });
      return;
    }
    const id = nextId();
    window.NativeBridgeCallbacks[id] = resolve;
    window.NativeBridge.readFileAsBase64(path, id);
  });
}

export function nativeDeleteFile(path) {
  if (isNative()) window.NativeBridge.deleteFile(path);
}

export function nativeGetCacheDir() {
  return isNative() ? window.NativeBridge.getCacheDir() : null;
}