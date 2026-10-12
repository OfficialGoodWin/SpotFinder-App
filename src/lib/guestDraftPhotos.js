const DB_NAME = 'spotfinder-private-drafts';
const STORE_NAME = 'photos';
const DB_VERSION = 1;

function openDatabase(indexedDBImpl = globalThis.indexedDB) {
  if (!indexedDBImpl) return Promise.reject(new Error('This browser cannot store guest draft photos offline.'));
  return new Promise((resolve, reject) => {
    const request = indexedDBImpl.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Guest photo storage could not be opened.'));
  });
}

const keyPrefix = (ownerKey, draftId) => `${ownerKey}:${draftId}:`;

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('Guest photo storage failed.'));
    transaction.onabort = () => reject(transaction.error || new Error('Guest photo storage was interrupted.'));
  });
}

export async function persistGuestDraftPhotos(ownerKey, draftId, files, indexedDBImpl) {
  const db = await openDatabase(indexedDBImpl);
  try {
    const prefix = keyPrefix(ownerKey, draftId);
    const generation = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const refs = files.slice(0, 3).map((file, index) => {
      const id = `${prefix}${generation}:${index}`;
      store.put({ id, ownerKey, draftId, blob: file, name: file.name || `photo-${index + 1}`, type: file.type, size: file.size, updatedAt: Date.now() });
      return { local_id: id, name: file.name || `photo-${index + 1}`, type: file.type, size: file.size };
    });
    await transactionDone(transaction);
    return refs;
  } catch (error) {
    if (error?.name === 'QuotaExceededError') throw new Error('This device has no space for the draft photos. Free browser storage or sign in for cloud storage.');
    throw new Error(error?.message || 'Guest draft photos could not be saved on this device.');
  } finally {
    db.close();
  }
}

export async function pruneGuestDraftPhotos(ownerKey, draftId, keepRefs, indexedDBImpl) {
  const keepIds = new Set((keepRefs || []).map(ref => ref.local_id));
  const db = await openDatabase(indexedDBImpl);
  try {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const request = transaction.objectStore(STORE_NAME).openCursor();
    const prefix = keyPrefix(ownerKey, draftId);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if (String(cursor.key).startsWith(prefix) && !keepIds.has(String(cursor.key))) cursor.delete();
      cursor.continue();
    };
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

export async function loadGuestDraftPhoto(photoRef, ownerKey, indexedDBImpl) {
  if (!photoRef?.local_id || !photoRef.local_id.startsWith(`${ownerKey}:`)) throw new Error('This guest photo belongs to another browser profile.');
  const db = await openDatabase(indexedDBImpl);
  try {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(photoRef.local_id);
    const row = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (!row?.blob || row.ownerKey !== ownerKey) throw new Error('A saved guest draft photo is missing from this device.');
    return new File([row.blob], row.name || photoRef.name || 'draft-photo', { type: row.type || photoRef.type || row.blob.type });
  } finally {
    db.close();
  }
}

export async function deleteGuestDraftPhotos(ownerKey, draftId, indexedDBImpl) {
  const db = await openDatabase(indexedDBImpl);
  try {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const prefix = keyPrefix(ownerKey, draftId);
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if (String(cursor.key).startsWith(prefix)) cursor.delete();
      cursor.continue();
    };
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}
