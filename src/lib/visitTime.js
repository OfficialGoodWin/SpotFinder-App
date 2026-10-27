// Sunrise and Sunset are now one visitor-facing option. Legacy spots may still
// store either (or both) values, so collapse them exactly once on read without
// rewriting the original Firestore document.
const LEGACY_SUN_VALUES = new Set(['sunrise', 'sunset']);

export const VISIT_TIME_SUNRISE_SUNSET = 'sunrise_sunset';

export function normalizeBestTimeValues(values) {
  const input = Array.isArray(values) ? values : [];
  const result = [];
  let hasSun = false;
  for (const raw of input) {
    if (typeof raw !== 'string' || !raw) continue;
    const value = raw === 'after_dark' ? 'night' : raw;
    if (LEGACY_SUN_VALUES.has(value) || value === VISIT_TIME_SUNRISE_SUNSET) {
      if (!hasSun) {
        result.push(VISIT_TIME_SUNRISE_SUNSET);
        hasSun = true;
      }
      continue;
    }
    if (!result.includes(value)) result.push(value);
  }
  return result;
}

export function visitTimeLabelKey(value) {
  return `addSpot.bestTime${String(value || '').split('_').map(word => word[0]?.toUpperCase() + word.slice(1)).join('')}`;
}
