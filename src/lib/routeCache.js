/**
 * routeCache.js
 *
 * Persists calculated routes to IndexedDB so navigation works offline.
 *
 * Key strategy:
 *   - Routes are stored by a fuzzy key derived from origin + destination
 *     (rounded to 4 decimal places ≈ 11m precision) + profile.
 *   - When offline and no exact key found, we also search by destination alone
 *     so a route calculated from anywhere to "home" is still usable.
 *   - Routes expire after MAX_AGE_DAYS (default 30 days).
 *   - Maximum ROUTE_LIMIT routes stored (evict oldest on overflow).
 */

const DB_NAME    = 'spotfinder-routes-v1';
const DB_VERSION = 1;
const STORE      = 'routes';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const ROUTE_LIMIT = 100;

let _db = null;

async function getDB() {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'key' });
        store.createIndex('savedAt', 'savedAt', { unique: false });
        store.createIndex('destKey', 'destKey', { unique: false });
      }
    };
    req.onsuccess  = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror    = ()  => reject(req.error);
  });
}

/** Round a coordinate to 4 decimal places (~11m) */
function roundCoord(n) { return Math.round(n * 10000) / 10000; }

/** Build a cache key from from/to/profile */
function buildKey(from, to, profile) {
  const f = `${roundCoord(from.lat)},${roundCoord(from.lng)}`;
  const t = `${roundCoord(to.lat)},${roundCoord(to.lng)}`;
  return `${f}|${t}|${profile}`;
}

/** Build a destination-only key (for fuzzy matching) */
function buildDestKey(to, profile) {
  return `${roundCoord(to.lat)},${roundCoord(to.lng)}|${profile}`;
}

/**
 * Save a route to the cache.
 * @param {Object} from    - { lat, lng }
 * @param {Object} to      - { lat, lng }
 * @param {string} profile - e.g. 'driving-car'
 * @param {Object} route   - normalized route object from osrmServiceClient
 * @param {string} [label] - human-readable destination label (for UI display)
 */
export async function saveRoute(from, to, profile, route, label = '') {
  const key     = buildKey(from, to, profile);
  const destKey = buildDestKey(to, profile);
  const db = await getDB();

  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);

  store.put({
    key,
    destKey,
    from,
    to,
    profile,
    label,
    route,
    savedAt: Date.now(),
  });

  await idbComplete(tx);
  await pruneOld();
}

/**
 * Look up a cached route.
 * First tries exact key (same origin), then falls back to destination-only match.
 * Returns the route object or null.
 */
export async function getCachedRoute(from, to, profile) {
  const db = await getDB();
  const now = Date.now();

  // Try exact match first
  const exact = await idbGet(db, buildKey(from, to, profile));
  if (exact && now - exact.savedAt < MAX_AGE_MS) return exact.route;

  // Fuzzy match: same destination + profile, any origin
  const destKey = buildDestKey(to, profile);
  const fuzzy   = await idbGetByIndex(db, 'destKey', destKey);
  if (fuzzy && now - fuzzy.savedAt < MAX_AGE_MS) return fuzzy.route;

  return null;
}

/**
 * Get all cached routes for display in the offline UI.
 * Returns [{key, from, to, profile, label, savedAt}]
 */
export async function listCachedRoutes() {
  const db    = await getDB();
  const tx    = db.transaction(STORE, 'readonly');
  const store = tx.objectStore(STORE);
  const now   = Date.now();
  const all   = [];

  return new Promise((resolve) => {
    const req = store.openCursor();
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (!cursor) { resolve(all); return; }
      if (now - cursor.value.savedAt < MAX_AGE_MS) {
        const { key, from, to, profile, label, savedAt } = cursor.value;
        all.push({ key, from, to, profile, label, savedAt });
      }
      cursor.continue();
    };
    req.onerror = () => resolve(all);
  });
}

/**
 * Delete a single cached route by key.
 */
export async function deleteCachedRoute(key) {
  const db = await getDB();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).delete(key);
  await idbComplete(tx);
}

/**
 * Clear all cached routes.
 */
export async function clearRouteCache() {
  const db = await getDB();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).clear();
  await idbComplete(tx);
}

/** Prune expired routes and enforce ROUTE_LIMIT */
async function pruneOld() {
  try {
    const db    = await getDB();
    const tx    = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const idx   = store.index('savedAt');
    const cutoff = Date.now() - MAX_AGE_MS;
    const all = [];

    await new Promise((resolve) => {
      const req = idx.openCursor();
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (!cursor) { resolve(); return; }
        if (cursor.value.savedAt < cutoff) {
          store.delete(cursor.value.key);
        } else {
          all.push({ key: cursor.value.key, savedAt: cursor.value.savedAt });
        }
        cursor.continue();
      };
      req.onerror = () => resolve();
    });

    // Enforce limit: delete oldest over the limit
    all.sort((a, b) => a.savedAt - b.savedAt);
    const toDelete = all.slice(0, Math.max(0, all.length - ROUTE_LIMIT));
    for (const r of toDelete) store.delete(r.key);

    await idbComplete(tx);
  } catch (_) {}
}

// ─── IDB helpers ──────────────────────────────────────────────────────────────

function idbGet(db, key) {
  return new Promise((res, rej) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    req.onsuccess = () => res(req.result ?? null);
    req.onerror   = () => rej(req.error);
  });
}

function idbGetByIndex(db, indexName, value) {
  return new Promise((res, rej) => {
    const req = db
      .transaction(STORE, 'readonly')
      .objectStore(STORE)
      .index(indexName)
      .get(value);
    req.onsuccess = () => res(req.result ?? null);
    req.onerror   = () => rej(req.error);
  });
}

function idbComplete(tx) {
  return new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror    = () => rej(tx.error);
  });
}
