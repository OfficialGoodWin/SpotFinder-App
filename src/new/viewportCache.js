const MAX_VIEWS = 4;
const MAX_AGE_MS = 120000;

export function cachedViewport(cache, key, now = Date.now()) {
  const entry = cache?.history?.get(key);
  return entry && now - entry.at < MAX_AGE_MS ? entry.rows : null;
}

export function rememberViewport(cache, key, rows, now = Date.now()) {
  const history = new Map(cache?.history || []);
  for (const [oldKey, entry] of history) {
    if (now - entry.at >= MAX_AGE_MS) history.delete(oldKey);
  }
  history.delete(key);
  history.set(key, { rows, at: now });
  while (history.size > MAX_VIEWS) history.delete(history.keys().next().value);
  return { key, rows, at: now, history };
}
