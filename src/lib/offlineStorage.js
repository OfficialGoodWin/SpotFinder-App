/**
 * offlineStorage.js
 * IndexedDB wrapper for offline map tiles + POI/spot data.
 *
 * Stores:
 *   tiles   — key: "z/x/y|tplHash"  value: ArrayBuffer (raw PNG/JPG bytes)
 *   pois    — key: "cc|category"     value: JSON array of POI objects
 *   meta    — key: countryCode       value: { downloadedAt, tileCount, zoomMax, sizeMB }
 */

const DB_NAME    = 'spotfinder-offline-v2';
const DB_VERSION = 1;

let _db = null;

async function getDB() {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('tiles')) db.createObjectStore('tiles');
      if (!db.objectStoreNames.contains('pois'))  db.createObjectStore('pois');
      if (!db.objectStoreNames.contains('meta'))  db.createObjectStore('meta');
    };

    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror   = ()  => reject(req.error);
  });
}

// ─── Tiles ────────────────────────────────────────────────────────────────────

/** Returns ArrayBuffer or null */
export async function getTile(key) {
  const db  = await getDB();
  const tx  = db.transaction('tiles', 'readonly');
  const req = tx.objectStore('tiles').get(key);
  return new Promise((res, rej) => {
    req.onsuccess = () => res(req.result ?? null);
    req.onerror   = () => rej(req.error);
  });
}

export async function setTile(key, buffer) {
  const db  = await getDB();
  const tx  = db.transaction('tiles', 'readwrite');
  const req = tx.objectStore('tiles').put(buffer, key);
  return new Promise((res, rej) => {
    req.onsuccess = () => res();
    req.onerror   = () => rej(req.error);
  });
}

export async function hasTile(key) {
  const db  = await getDB();
  const tx  = db.transaction('tiles', 'readonly');
  const req = tx.objectStore('tiles').count(key);
  return new Promise((res, rej) => {
    req.onsuccess = () => res(req.result > 0);
    req.onerror   = () => rej(req.error);
  });
}

/** Delete all tiles whose key starts with `prefix` (e.g. country tile keys) */
export async function deleteTilesWithPrefix(prefix) {
  const db    = await getDB();
  const tx    = db.transaction('tiles', 'readwrite');
  const store = tx.objectStore('tiles');
  const req   = store.openKeyCursor();
  return new Promise((res, rej) => {
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (!cursor) { res(); return; }
      if (cursor.key.startsWith(prefix)) store.delete(cursor.key);
      cursor.continue();
    };
    req.onerror = () => rej(req.error);
  });
}

// ─── POI cache ────────────────────────────────────────────────────────────────

export async function getPOIs(countryCode) {
  const db  = await getDB();
  const tx  = db.transaction('pois', 'readonly');
  const req = tx.objectStore('pois').get(countryCode);
  return new Promise((res, rej) => {
    req.onsuccess = () => res(req.result ?? null);
    req.onerror   = () => rej(req.error);
  });
}

export async function setPOIs(countryCode, poiArray) {
  const db  = await getDB();
  const tx  = db.transaction('pois', 'readwrite');
  const req = tx.objectStore('pois').put(poiArray, countryCode);
  return new Promise((res, rej) => {
    req.onsuccess = () => res();
    req.onerror   = () => rej(req.error);
  });
}

export async function deletePOIs(countryCode) {
  const db  = await getDB();
  const tx  = db.transaction('pois', 'readwrite');
  const req = tx.objectStore('pois').delete(countryCode);
  return new Promise((res, rej) => {
    req.onsuccess = () => res();
    req.onerror   = () => rej(req.error);
  });
}

// ─── Meta ─────────────────────────────────────────────────────────────────────

export async function getMeta(countryCode) {
  const db  = await getDB();
  const tx  = db.transaction('meta', 'readonly');
  const req = tx.objectStore('meta').get(countryCode);
  return new Promise((res, rej) => {
    req.onsuccess = () => res(req.result ?? null);
    req.onerror   = () => rej(req.error);
  });
}

export async function setMeta(countryCode, meta) {
  const db  = await getDB();
  const tx  = db.transaction('meta', 'readwrite');
  const req = tx.objectStore('meta').put(meta, countryCode);
  return new Promise((res, rej) => {
    req.onsuccess = () => res();
    req.onerror   = () => rej(req.error);
  });
}

export async function deleteMeta(countryCode) {
  const db  = await getDB();
  const tx  = db.transaction('meta', 'readwrite');
  const req = tx.objectStore('meta').delete(countryCode);
  return new Promise((res, rej) => {
    req.onsuccess = () => res();
    req.onerror   = () => rej(req.error);
  });
}

export async function getAllMeta() {
  const db    = await getDB();
  const tx    = db.transaction('meta', 'readonly');
  const store = tx.objectStore('meta');
  const result = {};
  return new Promise((res, rej) => {
    const req = store.openCursor();
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (!cursor) { res(result); return; }
      result[cursor.key] = cursor.value;
      cursor.continue();
    };
    req.onerror = () => rej(req.error);
  });
}

// ─── Storage usage estimate ───────────────────────────────────────────────────

export async function estimateStorageUsage() {
  if (navigator.storage?.estimate) {
    const { usage, quota } = await navigator.storage.estimate();
    return { usedMB: Math.round(usage / 1024 / 1024), quotaMB: Math.round(quota / 1024 / 1024) };
  }
  return { usedMB: 0, quotaMB: 0 };
}
