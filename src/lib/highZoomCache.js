/**
 * highZoomCache.js
 *
 * LRU IndexedDB cache for zoom 15-19 map tiles.
 * When the user is online and browses at street level, tiles are saved here.
 * When offline, they're served from here instead of the network.
 *
 * Strategy:
 *   - Max cache size: 600 MB (configurable)
 *   - Eviction: delete oldest-accessed tiles when limit approaches
 *   - Only caches z >= HIGH_ZOOM_MIN (default 15)
 *   - Used as a read-through cache in the MapLibre offline-vt:// protocol
 */

const DB_NAME    = 'spotfinder-hztiles-v1';
const DB_VERSION = 1;
const STORE      = 'tiles';
const META_STORE = 'meta';
const MAX_BYTES  = 600 * 1024 * 1024; // 600 MB
export const HIGH_ZOOM_MIN = 15;

let _db = null;

async function getDB() {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'key' });
        store.createIndex('lastAccess', 'lastAccess', { unique: false });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }
    };
    req.onsuccess  = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror    = ()  => reject(req.error);
  });
}

function tileKey(z, x, y) { return `${z}/${x}/${y}`; }

/** Get a cached tile. Returns ArrayBuffer or null. Updates lastAccess timestamp. */
export async function getCachedTile(z, x, y) {
  if (z < HIGH_ZOOM_MIN) return null;
  try {
    const db = await getDB();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const key = tileKey(z, x, y);
    const record = await idbGet(store, key);
    if (!record) return null;
    // Update last access time (for LRU eviction)
    record.lastAccess = Date.now();
    store.put(record);
    return record.data;
  } catch (_) {
    return null;
  }
}

/** Store a tile in the cache. Triggers eviction if over budget. */
export async function setCachedTile(z, x, y, data) {
  if (z < HIGH_ZOOM_MIN) return;
  if (!data || data.byteLength === 0) return;
  try {
    const db = await getDB();
    const tx = db.transaction([STORE, META_STORE], 'readwrite');
    const store = tx.objectStore(STORE);
    const metaStore = tx.objectStore(META_STORE);

    const key = tileKey(z, x, y);
    const existing = await idbGet(store, key);
    const sizeDelta = data.byteLength - (existing?.data?.byteLength ?? 0);

    store.put({ key, data, lastAccess: Date.now(), size: data.byteLength });

    // Update total size in meta
    let totalBytes = (await idbGet(metaStore, 'totalBytes')) ?? 0;
    totalBytes = Math.max(0, totalBytes + sizeDelta);
    metaStore.put(totalBytes, 'totalBytes');

    await idbComplete(tx);

    // Evict if over budget (async, non-blocking)
    if (totalBytes > MAX_BYTES) {
      evictOldest(totalBytes - MAX_BYTES).catch(() => {});
    }
  } catch (_) {}
}

/** Evict the oldest-accessed tiles until `bytesToFree` bytes are freed. */
async function evictOldest(bytesToFree) {
  try {
    const db = await getDB();
    const tx = db.transaction([STORE, META_STORE], 'readwrite');
    const store = tx.objectStore(STORE);
    const metaStore = tx.objectStore(META_STORE);
    const idx = store.index('lastAccess');

    let freed = 0;
    const cursor = idx.openCursor(); // ascending = oldest first

    await new Promise((resolve) => {
      cursor.onsuccess = (e) => {
        const c = e.target.result;
        if (!c || freed >= bytesToFree) { resolve(); return; }
        freed += c.value.size ?? 0;
        store.delete(c.value.key);
        c.continue();
      };
      cursor.onerror = () => resolve();
    });

    let totalBytes = (await idbGet(metaStore, 'totalBytes')) ?? 0;
    metaStore.put(Math.max(0, totalBytes - freed), 'totalBytes');
    await idbComplete(tx);
  } catch (_) {}
}

/** Return current cache size in MB */
export async function getCacheSizeMB() {
  try {
    const db = await getDB();
    const tx = db.transaction(META_STORE, 'readonly');
    const total = await idbGet(tx.objectStore(META_STORE), 'totalBytes');
    return Math.round((total ?? 0) / 1048576);
  } catch (_) {
    return 0;
  }
}

/** Clear the entire high-zoom tile cache */
export async function clearHighZoomCache() {
  try {
    const db = await getDB();
    const tx = db.transaction([STORE, META_STORE], 'readwrite');
    tx.objectStore(STORE).clear();
    tx.objectStore(META_STORE).put(0, 'totalBytes');
    await idbComplete(tx);
  } catch (_) {}
}

// ─── IDB helpers ──────────────────────────────────────────────────────────────

function idbGet(store, key) {
  return new Promise((res, rej) => {
    const req = store.get(key);
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
