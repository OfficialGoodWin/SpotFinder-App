const ZOOM_CONTROLS_KEY = 'spotfinder_new_zoom_controls_v1';

export function getNewZoomControlsPreference() {
  try { return localStorage.getItem(ZOOM_CONTROLS_KEY) === 'true'; }
  catch { return false; }
}

export function saveNewZoomControlsPreference(enabled) {
  try { localStorage.setItem(ZOOM_CONTROLS_KEY, enabled ? 'true' : 'false'); }
  catch { /* Keep the current session choice when storage is unavailable. */ }
  return enabled;
}
