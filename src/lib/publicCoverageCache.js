// Reuse a complete, recent public viewport only when it fully contains the
// requested rectangle. Saturated results cannot prove coverage.
export function createPublicCoverageCache({ ttlMs = 60000, maxEntries = 8, now = Date.now } = {}) {
  const entries = [];
  const valid = b => b && [b.south, b.west, b.north, b.east].every(Number.isFinite)
    && b.south >= -90 && b.north <= 90 && b.west >= -180 && b.east <= 180
    && b.south <= b.north && b.west <= b.east;
  const contained = (outer, inner) => outer.south <= inner.south && outer.north >= inner.north
    && outer.west <= inner.west && outer.east >= inner.east;
  const inside = (spot, bounds) => spot.lat >= bounds.south && spot.lat <= bounds.north
    && spot.lng >= bounds.west && spot.lng <= bounds.east;
  return {
    remember(bounds, rows, limit) {
      if (!valid(bounds) || !Array.isArray(rows)
        || !rows.every(row => row.is_public === true && ['published', 'pending_trust'].includes(row.status))
        || !Number.isInteger(limit)
        || limit < 1 || rows.length >= limit) return;
      entries.push({ bounds: { ...bounds }, rows, at: now() });
      if (entries.length > maxEntries) entries.shift();
    },
    lookup(bounds, limit) {
      if (!valid(bounds) || !Number.isInteger(limit) || limit < 1) return null;
      for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        if (now() - entry.at >= ttlMs || !contained(entry.bounds, bounds)) continue;
        const rows = entry.rows.filter(spot => inside(spot, bounds));
        if (rows.length < limit) return rows;
      }
      return null;
    },
    clear() { entries.length = 0; },
  };
}
