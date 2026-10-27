import OpeningHours from 'opening_hours';
import lookupTimeZone from '@photostructure/tz-lookup';

const DAY = 86_400_000;
const formatters = new Map();

function wallParts(instant, timeZone) {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });
    formatters.set(timeZone, formatter);
  }
  const parts = Object.fromEntries(formatter.formatToParts(instant)
    .filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
  return { year: parts.year, month: parts.month, day: parts.day,
    hour: parts.hour, minute: parts.minute, second: parts.second };
}

function localDate(parts) {
  const date = new Date(parts.year, parts.month - 1, parts.day,
    parts.hour, parts.minute, parts.second);
  return date.getFullYear() === parts.year && date.getMonth() + 1 === parts.month &&
    date.getDate() === parts.day && date.getHours() === parts.hour &&
    date.getMinutes() === parts.minute ? date : null;
}

function projectedDate(instant, timeZone) {
  return localDate(wallParts(instant, timeZone));
}

function sameWall(a, b) {
  return a.year === b.year && a.month === b.month && a.day === b.day &&
    a.hour === b.hour && a.minute === b.minute && a.second === b.second;
}

// Resolve a parser wall-clock transition to a real instant. Checking both
// offsets handles an autumn DST fold; a spring DST gap yields no candidate.
function actualInstantsForLocal(local, timeZone) {
  const target = { year: local.getFullYear(), month: local.getMonth() + 1,
    day: local.getDate(), hour: local.getHours(), minute: local.getMinutes(), second: local.getSeconds() };
  const naive = Date.UTC(target.year, target.month - 1, target.day,
    target.hour, target.minute, target.second);
  const offsets = new Set();
  for (const delta of [-36, -12, 0, 12, 36]) {
    const probe = naive + delta * 3_600_000;
    const wall = wallParts(new Date(probe), timeZone);
    offsets.add(Date.UTC(wall.year, wall.month - 1, wall.day,
      wall.hour, wall.minute, wall.second) - probe);
  }
  return [...offsets].map(offset => new Date(naive - offset))
    .filter(instant => sameWall(wallParts(instant, timeZone), target))
    .sort((a, b) => a - b);
}

function stateAt(schedule, instant, timeZone) {
  const projected = projectedDate(instant, timeZone);
  if (!projected || schedule.getUnknown(projected)) return 'unknown';
  return schedule.getState(projected) ? 'open' : 'closed';
}

function zoneOffset(instant, timeZone) {
  const wall = wallParts(instant, timeZone);
  return Math.round((Date.UTC(wall.year, wall.month - 1, wall.day,
    wall.hour, wall.minute, wall.second) - instant.getTime()) / 60_000);
}

// A repeated local hour can change the parser state even when the parser's
// next wall-clock transition is later. Check nearby zone transitions as well.
function nextZoneStateChange(schedule, now, timeZone, state) {
  let start = now.getTime();
  let offset = zoneOffset(now, timeZone);
  const end = start + 8 * DAY;
  while (start < end) {
    const probe = Math.min(start + 6 * 3_600_000, end);
    const nextOffset = zoneOffset(new Date(probe), timeZone);
    if (nextOffset !== offset) {
      let left = start;
      let right = probe;
      while (right - left > 1) {
        const middle = Math.floor((left + right) / 2);
        if (zoneOffset(new Date(middle), timeZone) === offset) left = middle;
        else right = middle;
      }
      const before = stateAt(schedule, new Date(right - 1000), timeZone);
      const after = stateAt(schedule, new Date(right + 1000), timeZone);
      if (before === state && after !== state && after !== 'unknown') return new Date(right);
      offset = nextOffset;
    }
    start = probe;
  }
  return null;
}

function nextVerifiedChange(schedule, now, timeZone, state) {
  let cursor = projectedDate(now, timeZone);
  if (!cursor) return null;
  const zoneChange = nextZoneStateChange(schedule, now, timeZone, state);
  const limit = new Date(cursor.getTime() + 370 * DAY);
  for (let attempt = 0; attempt < 24; attempt++) {
    const next = schedule.getNextChange(cursor, limit);
    if (!next) return zoneChange;
    for (const actual of actualInstantsForLocal(next, timeZone)) {
      if (actual <= now) continue;
      const before = stateAt(schedule, new Date(actual.getTime() - 1000), timeZone);
      const after = stateAt(schedule, new Date(actual.getTime() + 1000), timeZone);
      if (before === state && after !== state && after !== 'unknown')
        return zoneChange && zoneChange < actual ? zoneChange : actual;
    }
    cursor = new Date(next.getTime() + 60_000);
    if (cursor >= limit) return zoneChange;
  }
  return zoneChange;
}

function clock(date, endOfDay = false) {
  if (endOfDay) return '24:00';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function weekRows(schedule, now, timeZone, language) {
  const wall = wallParts(now, timeZone);
  const today = new Date(Date.UTC(wall.year, wall.month - 1, wall.day));
  const monday = new Date(today.getTime() - ((today.getUTCDay() + 6) % 7) * DAY);
  const locale = language?.startsWith('cs') ? 'cs-CZ' : 'en-US';
  const weekdayFormat = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'long' });
  const dateFormat = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', day: 'numeric', month: 'numeric' });
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday.getTime() + index * DAY);
    const from = new Date(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
    const to = new Date(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() + 1);
    const intervals = schedule.getOpenIntervals(from, to);
    const holiday = timeZone === 'Europe/Prague' &&
      schedule.getPublicHolidayContext(new Date(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 12)).isHoliday;
    return {
      label: weekdayFormat.format(day), date: dateFormat.format(day), holiday,
      today: day.getTime() === today.getTime(),
      periods: intervals.map(([start, end, unknown, comment]) => ({
        label: `${clock(start)}–${clock(end, end.getTime() === to.getTime())}`,
        unknown, comment: comment || null,
      })),
    };
  });
}

export function evaluatePoiOpeningHours(raw, { lat, lon, now = new Date(), language = 'cs' } = {}) {
  if (raw == null || raw === '') return { kind: 'missing', raw: '' };
  if (typeof raw !== 'string') return { kind: 'unknown', raw: String(raw) };
  if (!raw.trim()) return { kind: 'missing', raw: '' };
  const value = raw.trim();
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180)
    return { kind: 'unknown', raw: value };
  try {
    const timeZone = lookupTimeZone(lat, lon);
    const countryCode = timeZone === 'Europe/Prague' ? 'cz' : null;
    // School holidays need region-level context, and PH needs a known country.
    if (/\bSH\b/.test(value) || /\bPH\b/.test(value) && !countryCode)
      return { kind: 'unknown', raw: value, timeZone };
    const schedule = new OpeningHours(value,
      { lat, lon, address: { country_code: countryCode || '', state: '' } },
      { tag_key: 'opening_hours' });
    const state = stateAt(schedule, now, timeZone);
    if (state === 'unknown') return { kind: 'unknown', raw: value, timeZone };
    if (value === '24/7' && state === 'open')
      return { kind: 'always', raw: value, timeZone,
        rows: weekRows(schedule, now, timeZone, language) };
    return { kind: state, raw: value, timeZone,
      nextChange: nextVerifiedChange(schedule, now, timeZone, state),
      rows: weekRows(schedule, now, timeZone, language),
      variable: !schedule.isWeekStable() };
  } catch {
    return { kind: 'unknown', raw: value };
  }
}
