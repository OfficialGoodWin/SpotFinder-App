export const MINIMUM_ACCOUNT_AGE = 16;
export const MAXIMUM_PLAUSIBLE_AGE = 120;

function isoDate(year, month, day) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function accountBirthDateBounds(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  return {
    min: isoDate(year - MAXIMUM_PLAUSIBLE_AGE, month, day),
    max: isoDate(year - MINIMUM_ACCOUNT_AGE, month, day),
  };
}

export function isEligibleBirthDate(value, now = new Date()) {
  const raw = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const [year, month, day] = raw.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) return false;
  const bounds = accountBirthDateBounds(now);
  return raw >= bounds.min && raw <= bounds.max;
}
