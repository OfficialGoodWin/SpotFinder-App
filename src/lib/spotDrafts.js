const LOCAL_PREFIX = 'spotfinder:guest-spot-drafts:v1:';
const DEVICE_OWNER_KEY = 'spotfinder:guest-draft-owner:v1';
export const DRAFT_SCHEMA_VERSION = 1;

const cleanText = (value, max) => String(value || '').trim().slice(0, max);
const validArray = (value, max = 20) => Array.isArray(value) ? value.filter(item => typeof item === 'string').slice(0, max) : [];

export function createDraftId() {
  return globalThis.crypto?.randomUUID?.() || `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function normalizeSpotDraft(value = {}) {
  const lat = Number(value.lat);
  const lng = Number(value.lng);
  return {
    id: cleanText(value.id, 100) || createDraftId(),
    schema_version: DRAFT_SCHEMA_VERSION,
    title: cleanText(value.title, 100),
    description: cleanText(value.description, 2000),
    lat: Number.isFinite(lat) && lat >= -90 && lat <= 90 ? lat : null,
    lng: Number.isFinite(lng) && lng >= -180 && lng <= 180 ? lng : null,
    tags: validArray(value.tags, 20),
    cost: cleanText(value.cost, 20),
    accessDifficulty: cleanText(value.accessDifficulty, 20),
    parking: cleanText(value.parking, 20),
    bestTime: validArray(value.bestTime, 10),
    directions: cleanText(value.directions, 1000),
    socialUrl: cleanText(value.socialUrl, 500),
    overallRating: Math.min(5, Math.max(0, Number(value.overallRating) || 0)),
    accessRating: Math.min(5, Math.max(0, Number(value.accessRating) || 0)),
    conditionRating: Math.min(5, Math.max(0, Number(value.conditionRating) || 0)),
    safetyRating: Math.min(5, Math.max(0, Number(value.safetyRating) || 0)),
    crowdednessRating: Math.min(5, Math.max(0, Number(value.crowdednessRating) || 0)),
    photo_refs: Array.isArray(value.photo_refs) ? value.photo_refs.filter(ref => ref && (typeof ref.path === 'string' || typeof ref.local_id === 'string')).slice(0, 5).map(ref => ({
      ...(ref.path ? { path: cleanText(ref.path, 500) } : {}),
      ...(ref.local_id ? { local_id: cleanText(ref.local_id, 500) } : {}),
      name: cleanText(ref.name, 150), type: cleanText(ref.type, 100), size: Number(ref.size) || 0,
    })) : [],
    created_at: cleanText(value.created_at, 40) || new Date().toISOString(),
    updated_at: cleanText(value.updated_at, 40) || new Date().toISOString(),
  };
}

export function guestDraftStorageKey(ownerKey) {
  const safeOwner = cleanText(ownerKey, 128).replace(/[^A-Za-z0-9_-]/g, '');
  if (!safeOwner) throw new Error('Guest drafts are unavailable until the private guest session is ready.');
  return `${LOCAL_PREFIX}${safeOwner}`;
}

export function getGuestDraftOwnerKey(storage) {
  const existing = storage.getItem(DEVICE_OWNER_KEY);
  if (existing) return existing;
  const created = createDraftId();
  storage.setItem(DEVICE_OWNER_KEY, created);
  return created;
}

export function listGuestDrafts(storage, ownerKey) {
  try {
    const parsed = JSON.parse(storage.getItem(guestDraftStorageKey(ownerKey)) || '[]');
    return (Array.isArray(parsed) ? parsed : []).map(normalizeSpotDraft)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  } catch (error) {
    if (error instanceof SyntaxError) return [];
    throw error;
  }
}

export function saveGuestDraft(storage, ownerKey, value) {
  const localPhotoRefs = Array.isArray(value.photo_refs) ? value.photo_refs.filter(ref => ref?.local_id) : [];
  const draft = normalizeSpotDraft({ ...value, photo_refs: localPhotoRefs, updated_at: new Date().toISOString() });
  const drafts = listGuestDrafts(storage, ownerKey);
  const next = [draft, ...drafts.filter(item => item.id !== draft.id)].slice(0, 25);
  try {
    storage.setItem(guestDraftStorageKey(ownerKey), JSON.stringify(next));
  } catch (error) {
    const wrapped = new Error(error?.name === 'QuotaExceededError'
      ? 'This device has no space available for the draft. Free browser storage or sign in for cloud drafts.'
      : 'The draft could not be saved on this device. Browser storage may be disabled.');
    wrapped.cause = error;
    throw wrapped;
  }
  return draft;
}

export function deleteGuestDraft(storage, ownerKey, draftId) {
  const remaining = listGuestDrafts(storage, ownerKey).filter(item => item.id !== draftId);
  storage.setItem(guestDraftStorageKey(ownerKey), JSON.stringify(remaining));
  return remaining;
}

export function draftDisplayName(draft) {
  return draft?.title?.trim() || 'Untitled spot draft';
}

export function markDraftPublished(publishedIds, draftId) {
  if (!draftId || publishedIds.has(draftId)) throw new Error('This draft is already being published.');
  return new Set([...publishedIds, draftId]);
}
