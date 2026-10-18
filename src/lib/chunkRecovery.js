const CHUNK_FAILURE = /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|failed to load module script/i;
let pendingIssue = null;
const vitePreloadErrors = new WeakSet();

export function isChunkLoadError(error) {
  return (error && typeof error === 'object' && vitePreloadErrors.has(error)) ||
    CHUNK_FAILURE.test(String(error?.message || error || ''));
}

export function notifyVitePreloadError(error) {
  if (error && typeof error === 'object') vitePreloadErrors.add(error);
  pendingIssue = 'chunk';
  window.dispatchEvent(new CustomEvent('spotfinder:chunk-load-error', { detail: { message: String(error?.message || error || '') } }));
}

export function notifyChunkLoadError(error) {
  if (!isChunkLoadError(error)) return false;
  pendingIssue = 'chunk';
  window.dispatchEvent(new CustomEvent('spotfinder:chunk-load-error', { detail: { message: String(error?.message || error) } }));
  return true;
}

export function notifyAppUpdate() {
  if (pendingIssue !== 'chunk') pendingIssue = 'update';
  window.dispatchEvent(new Event('spotfinder:update-available'));
}

export function takePendingRecoveryIssue() {
  const issue = pendingIssue;
  pendingIssue = null;
  return issue;
}

export function installVitePreloadRecovery() {
  const onPreloadError = event => {
    // Keep Vite's normal rejection so React.lazy boundaries can catch it.
    // An automatic reload could destroy a contribution or feedback form.
    notifyVitePreloadError(event.payload);
  };
  window.addEventListener('vite:preloadError', onPreloadError);
  return () => window.removeEventListener('vite:preloadError', onPreloadError);
}

export function hasUnsavedWork(documentObject = document) {
  return Boolean(documentObject.querySelector('[data-unsaved-work="true"]'));
}
