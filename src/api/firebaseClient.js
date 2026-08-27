import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig';
import { encodeGeohash, boundingBox, geohashPrecisionForRadius, haversineDistanceM } from '../utils/geohash';
 
let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error("Firebase initialization error:", error);
}
 
export const getFirebaseServices = () => {
  if (!app || !auth || !db) {
    try {
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
        } catch (error) {
      console.error("Firebase re-initialization error:", error);
      return null;
    }
  }
  return { app, auth, db };
};
 
// Detect WebView / in-app browsers that block Google OAuth popup
export const isRestrictedBrowser = () => {
  const ua = navigator.userAgent || '';
  return /TikTok|BytedanceWebview|musical_ly|FBAN|FBAV|FB_IAB|Instagram/i.test(ua) ||
         (/Android/.test(ua) && /\bwv\b/.test(ua));
};
 
export const loginWithEmail = async (email, password) => {
  const { auth } = getFirebaseServices();
  return (await signInWithEmailAndPassword(auth, email, password)).user;
};
 
export const registerWithEmail = async (email, password) => {
  const { auth } = getFirebaseServices();
  return (await createUserWithEmailAndPassword(auth, email, password)).user;
};
 
export const loginWithGoogle = async () => {
  const { auth } = getFirebaseServices();
  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  if (isRestrictedBrowser()) {
    await signInWithRedirect(auth, provider);
    return null;
  }
  return (await signInWithPopup(auth, provider)).user;
};
 
export const handleGoogleRedirectResult = async () => {
  try {
    const { auth } = getFirebaseServices();
    const result = await getRedirectResult(auth);
    return result?.user || null;
  } catch (err) {
    console.warn('Redirect result error:', err);
    return null;
  }
};
 
export const logout = async () => {
  const { auth } = getFirebaseServices();
  await firebaseSignOut(auth);
};
 
export const onAuthChange = (callback) => {
  const { auth } = getFirebaseServices();
  return onAuthStateChanged(auth, callback);
};

// ── POI Error Handler ─────────────────────────────────────────────────────────
export const handlePOIError = (error, poiData) => {
  console.warn('[Firebase POI] Access blocked or service unavailable:', error.message);
  console.warn('Falling back to:', poiData?.length || 0, 'cached/local POIs');
  return { blocked: true, fallback: poiData || [] };
};
 
// Compress image with canvas and return base64 data URL (stored in Firestore)
// Max output size ~600KB — well within Firestore 1MB document limit
export const uploadSpotImage = async (file) => {
  return new Promise((resolve, reject) => {
    const MAX_W = 1200;
    const MAX_H = 1200;
    const QUALITY = 0.75;
 
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        // Scale down if larger than max
        if (width > MAX_W || height > MAX_H) {
          const ratio = Math.min(MAX_W / width, MAX_H / height);
          width  = Math.round(width  * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

 
const IP_BANS_COLLECTION = 'ip_bans';
export const banIP = async (ipAddress, reason = 'Violation of terms') => {
  const { db, auth } = getFirebaseServices();
  const user = auth.currentUser;
  if (!user || user.email !== 'superadmin@spotfinder.cz') throw new Error('Unauthorized');
  await setDoc(doc(db, IP_BANS_COLLECTION, ipAddress), { ip: ipAddress, reason, banned_by: user.email, banned_at: new Date().toISOString() });
};
export const unbanIP = async (ipAddress) => {
  const { db, auth } = getFirebaseServices();
  const user = auth.currentUser;
  if (!user || user.email !== 'superadmin@spotfinder.cz') throw new Error('Unauthorized');
  await deleteDoc(doc(db, IP_BANS_COLLECTION, ipAddress));
};
export const isIPBanned = async (ipAddress) => {
  const { db } = getFirebaseServices();
  return (await getDoc(doc(db, IP_BANS_COLLECTION, ipAddress))).exists();
};
 
const SPOTS_COLLECTION = 'spots';
const RATINGS_COLLECTION = 'ratings';
 
// Visible statuses: published spots + pending_trust spots (shown immediately with
// a "new" badge in the UI per spec — flagged/hidden/rejected are excluded).
export const getPublicSpots = async (maxCount = 200) => {
  const { db } = getFirebaseServices();
  const q = query(
    collection(db, SPOTS_COLLECTION),
    where('is_public', '==', true),
    where('status', 'in', ['published', 'pending_trust']),
    orderBy('created_date', 'desc'),
    limit(maxCount)
  );
  return (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
};
 
export const getUserSpots = async (userEmail, maxCount = 50) => {
  const { db } = getFirebaseServices();
  const q = query(collection(db, SPOTS_COLLECTION), where('created_by', '==', userEmail), orderBy('created_date', 'desc'), limit(maxCount));
  return (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
};
 
// A submitter needs this many previously-published spots before new submissions
// skip the pending_trust review tier (see spec: moderation & quality control).
const TRUSTED_SUBMITTER_THRESHOLD = 3;

export const getApprovedSpotCount = async (userEmail) => {
  if (!userEmail || userEmail === 'anonymous') return 0;
  const { db } = getFirebaseServices();
  const q = query(
    collection(db, SPOTS_COLLECTION),
    where('created_by', '==', userEmail),
    where('status', '==', 'published')
  );
  return (await getDocs(q)).size;
};

export const createSpot = async (spotData) => {
  const { db } = getFirebaseServices();
  const approvedCount = await getApprovedSpotCount(spotData.created_by);
  const status = approvedCount >= TRUSTED_SUBMITTER_THRESHOLD ? 'published' : 'pending_trust';

  const data = {
    ...spotData,
    status,                       // 'pending_trust' | 'published' | 'flagged' | 'hidden' | 'rejected'
    geohash: encodeGeohash(spotData.lat, spotData.lng, 9),
    quality_score: 0,
    upvote_count: 0,
    downvote_count: 0,
    flag_count: 0,
    created_date: new Date().toISOString(),
  };
  const docRef = await addDoc(collection(db, SPOTS_COLLECTION), data);
  return { id: docRef.id, ...data };
};

// ── Duplicate detection ───────────────────────────────────────────────────────
// Finds published/pending spots within `radiusM` of (lat, lng) using a geohash
// prefix-range query (cheap, index-friendly), then filters precisely with
// haversine distance. Used by the submission form to prompt "is this the same spot?"
export const findNearbySpots = async (lat, lng, radiusM = 50) => {
  const { db } = getFirebaseServices();
  const precision = geohashPrecisionForRadius(radiusM);
  const centerHash = encodeGeohash(lat, lng, precision);
  const { south, north, west, east } = boundingBox(lat, lng, radiusM);

  const q = query(
    collection(db, SPOTS_COLLECTION),
    where('geohash', '>=', centerHash),
    where('geohash', '<=', centerHash + '~'),
    limit(50)
  );
  const candidates = (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
  return candidates.filter(s =>
    typeof s.lat === 'number' && typeof s.lng === 'number' &&
    s.lat >= south && s.lat <= north && s.lng >= west && s.lng <= east &&
    haversineDistanceM(lat, lng, s.lat, s.lng) <= radiusM &&
    s.status !== 'rejected' && s.status !== 'hidden'
  );
};

// Merge a newly-flagged duplicate submission into an existing spot instead of
// keeping two pins for the same place.
export const markSpotAsDuplicate = async (newSpotId, canonicalSpotId) => {
  const { db } = getFirebaseServices();
  await updateDoc(doc(db, SPOTS_COLLECTION, newSpotId), {
    status: 'rejected',
    duplicate_of_spot_id: canonicalSpotId,
  });
};
 
export const updateSpot = async (spotId, data) => {
  const { db } = getFirebaseServices();
  await updateDoc(doc(db, SPOTS_COLLECTION, spotId), data);
};
 
export const deleteSpot = async (spotId) => {
  const { db } = getFirebaseServices();
  await deleteDoc(doc(db, SPOTS_COLLECTION, spotId));
};
 
export const deleteSpotAsSuperAdmin = async (spotId) => {
  const { db, auth } = getFirebaseServices();
  const user = auth.currentUser;
  if (!user || user.email !== 'superadmin@spotfinder.cz') throw new Error('Unauthorized');
  await deleteDoc(doc(db, SPOTS_COLLECTION, spotId));
};
 
export const rateSpot = async (spotId, rating) => {
  const { db } = getFirebaseServices();
  await addDoc(collection(db, RATINGS_COLLECTION), { spot_id: spotId, rating, created_date: new Date().toISOString() });
};
 
export const updateSpotRating = async (spotId, newRating, newCount) => {
  const { db } = getFirebaseServices();
  await updateDoc(doc(db, SPOTS_COLLECTION, spotId), { rating: newRating, rating_count: newCount });
};
 
// Update a specific category rating (parking_rating, beauty_rating, privacy_rating)
export const updateSpotDetailRating = async (spotId, field, newVal, count) => {
  const { db } = getFirebaseServices();
  await updateDoc(doc(db, SPOTS_COLLECTION, spotId), { [field]: newVal, [`${field}_count`]: count });
};
 
/**
 * Submit all three category ratings at once and recalculate overall rating.
 * This is the ONLY rating entry point from SpotDetailModal.
 * @param {string} spotId
 * @param {object} currentSpot - existing spot data (for running averages)
 * @param {{parking:number, beauty:number, privacy:number}} ratings - 0 = not rated
 */
export const submitCategoryRatings = async (spotId, currentSpot, ratings) => {
  const { db } = getFirebaseServices();
  const updates = {};

  const recalc = (field, countField, newVal) => {
    if (!newVal) return null;
    const oldCount = currentSpot[countField] || 0;
    const oldVal   = currentSpot[field]     || 0;
    const newCount = oldCount + 1;
    const newAvg   = Math.round(((oldVal * oldCount) + newVal) / newCount * 10) / 10;
    updates[field]      = newAvg;
    updates[countField] = newCount;
    return newAvg;
  };

  recalc('parking_rating', 'parking_rating_count', ratings.parking);
  recalc('beauty_rating',  'beauty_rating_count',  ratings.beauty);
  recalc('privacy_rating', 'privacy_rating_count', ratings.privacy);

  // This review's overall = average of the categories rated in THIS submission only
  const submittedValues = [
    ratings.parking > 0 ? ratings.parking : null,
    ratings.beauty  > 0 ? ratings.beauty  : null,
    ratings.privacy > 0 ? ratings.privacy : null,
  ].filter(x => x !== null);

  if (submittedValues.length > 0) {
    const reviewOverall   = submittedValues.reduce((s, x) => s + x, 0) / submittedValues.length;
    const oldOverallCount = currentSpot.rating_count || 0;
    const oldOverall      = currentSpot.rating       || 0;
    const newOverallCount = oldOverallCount + 1;
    const newOverall      = Math.round(((oldOverall * oldOverallCount) + reviewOverall) / newOverallCount * 10) / 10;
    updates.rating        = newOverall;
    updates.rating_count  = newOverallCount;
  }

  if (Object.keys(updates).length > 0) {
    await updateDoc(doc(db, SPOTS_COLLECTION, spotId), updates);
  }

  return { ...currentSpot, ...updates };
};

// ─── Flags (community moderation) ─────────────────────────────────────────────
const FLAGS_COLLECTION = 'flags';
const FLAG_AUTO_HIDE_THRESHOLD = 3; // distinct users flagging → auto-hide pending admin review

// reason: 'private_property' | 'dangerous' | 'duplicate' | 'spam' | 'inaccurate_location'
export const flagSpot = async (spotId, reporterEmail, reason, note = '') => {
  const { db } = getFirebaseServices();
  if (!reporterEmail || reporterEmail === 'anonymous') throw new Error('Must be signed in to flag a spot');

  // One flag per user per spot — composite doc id prevents duplicate flags.
  const flagId = `${spotId}_${reporterEmail}`;
  const flagRef = doc(db, FLAGS_COLLECTION, flagId);
  const existing = await getDoc(flagRef);
  if (existing.exists()) return { alreadyFlagged: true };

  await setDoc(flagRef, {
    spot_id: spotId,
    reporter_email: reporterEmail,
    reason,
    note,
    status: 'open',
    created_date: new Date().toISOString(),
  });

  const q = query(collection(db, FLAGS_COLLECTION), where('spot_id', '==', spotId), where('status', '==', 'open'));
  const flagCount = (await getDocs(q)).size;
  await updateDoc(doc(db, SPOTS_COLLECTION, spotId), { flag_count: flagCount });

  if (flagCount >= FLAG_AUTO_HIDE_THRESHOLD) {
    await updateDoc(doc(db, SPOTS_COLLECTION, spotId), { status: 'flagged' });
  }
  return { alreadyFlagged: false, flagCount };
};

export const getOpenFlagsForAdmin = async (maxCount = 100) => {
  const { db } = getFirebaseServices();
  const q = query(collection(db, FLAGS_COLLECTION), where('status', '==', 'open'), orderBy('created_date', 'desc'), limit(maxCount));
  return (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
};

export const resolveFlag = async (flagId, resolution /* 'upheld' | 'dismissed' */) => {
  const { db } = getFirebaseServices();
  await updateDoc(doc(db, FLAGS_COLLECTION, flagId), { status: 'resolved', resolution, resolved_date: new Date().toISOString() });
};

// ─── Votes (up/down, feeds quality_score/ranking — not visibility) ───────────
const VOTES_COLLECTION = 'votes';

export const voteSpot = async (spotId, userEmail, type /* 'up' | 'down' */) => {
  const { db } = getFirebaseServices();
  if (!userEmail || userEmail === 'anonymous') throw new Error('Must be signed in to vote');

  const voteId = `${userEmail}_${spotId}`;
  const voteRef = doc(db, VOTES_COLLECTION, voteId);
  const existing = await getDoc(voteRef);
  const prevType = existing.exists() ? existing.data().type : null;
  if (prevType === type) return; // no-op, already voted this way

  await setDoc(voteRef, { user_email: userEmail, spot_id: spotId, type, created_date: new Date().toISOString() });

  const upDelta = (type === 'up' ? 1 : 0) - (prevType === 'up' ? 1 : 0);
  const downDelta = (type === 'down' ? 1 : 0) - (prevType === 'down' ? 1 : 0);
  const spotSnap = await getDoc(doc(db, SPOTS_COLLECTION, spotId));
  const spot = spotSnap.data() || {};
  const upvote_count = Math.max(0, (spot.upvote_count || 0) + upDelta);
  const downvote_count = Math.max(0, (spot.downvote_count || 0) + downDelta);
  await updateDoc(doc(db, SPOTS_COLLECTION, spotId), {
    upvote_count,
    downvote_count,
    quality_score: upvote_count - downvote_count,
  });
};

// ─── Bookmarks ─────────────────────────────────────────────────────────────────
const BOOKMARKS_COLLECTION = 'bookmarks';

export const bookmarkSpot = async (spotId, userEmail) => {
  const { db } = getFirebaseServices();
  if (!userEmail || userEmail === 'anonymous') throw new Error('Must be signed in to bookmark');
  await setDoc(doc(db, BOOKMARKS_COLLECTION, `${userEmail}_${spotId}`), {
    user_email: userEmail, spot_id: spotId, created_date: new Date().toISOString(),
  });
};

export const removeBookmark = async (spotId, userEmail) => {
  const { db } = getFirebaseServices();
  await deleteDoc(doc(db, BOOKMARKS_COLLECTION, `${userEmail}_${spotId}`));
};

export const getUserBookmarks = async (userEmail) => {
  const { db } = getFirebaseServices();
  const q = query(collection(db, BOOKMARKS_COLLECTION), where('user_email', '==', userEmail));
  return (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
};

// ─── Site status / kill switch ─────────────────────────────────────────────────
// Single doc: config/maintenance. Read is public (no auth needed) so the
// banner/lockout screen works for signed-out visitors too. Writes are
// restricted to the superadmin account by firestore.rules — this function
// enforces nothing client-side; the security lives entirely in the rules.
const MAINTENANCE_DOC_PATH = ['config', 'maintenance'];

export const getMaintenanceStatus = async () => {
  const { db } = getFirebaseServices();
  const snap = await getDoc(doc(db, ...MAINTENANCE_DOC_PATH));
  if (!snap.exists()) return { status: 'ok', message: '', showBanner: false };
  return snap.data();
};

// status: 'ok' | 'warning' | 'down'. Will throw/reject if the signed-in user
// isn't the superadmin — that's firestore.rules doing its job, not a bug.
export const setMaintenanceStatus = async ({ status, message = '', showBanner = false }) => {
  const { db } = getFirebaseServices();
  await setDoc(doc(db, ...MAINTENANCE_DOC_PATH), {
    status,
    message,
    showBanner,
    updated_date: new Date().toISOString(),
  });
};

// ─── POI Community Data ───────────────────────────────────────────────────────
// Stable ID for any OSM POI: "lat4_lon4_slug"
export const makePOIId = (lat, lon, name) =>
  `${lat.toFixed(4)}_${lon.toFixed(4)}_${(name || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)}`;

const POI_PHOTOS_COLLECTION  = 'poi_photos';
const POI_RATINGS_COLLECTION = 'poi_ratings';

// Photos
export const getPOIPhotos = async (poiId) => {
  const { db } = getFirebaseServices();
  const q = query(
    collection(db, POI_PHOTOS_COLLECTION),
    where('poi_id', '==', poiId),
    orderBy('created_date', 'desc'),
    limit(20)
  );
  return (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
};

export const addPOIPhoto = async (poiId, imageDataUrl, userEmail) => {
  const { db } = getFirebaseServices();
  const docRef = await addDoc(collection(db, POI_PHOTOS_COLLECTION), {
    poi_id: poiId,
    image: imageDataUrl,
    created_by: userEmail || 'anonymous',
    created_date: new Date().toISOString(),
  });
  return { id: docRef.id, poi_id: poiId, image: imageDataUrl };
};

// Ratings
export const getPOIRatings = async (poiId) => {
  const { db } = getFirebaseServices();
  const q = query(
    collection(db, POI_RATINGS_COLLECTION),
    where('poi_id', '==', poiId),
    orderBy('created_date', 'desc'),
    limit(100)
  );
  return (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
};

export const addPOIRating = async (poiId, rating, reviewText, userEmail) => {
  const { db } = getFirebaseServices();
  const docRef = await addDoc(collection(db, POI_RATINGS_COLLECTION), {
    poi_id: poiId,
    rating,
    review: reviewText || '',
    created_by: userEmail || 'anonymous',
    created_date: new Date().toISOString(),
  });
  return { id: docRef.id };
};

// ─── Superadmin map editor ────────────────────────────────────────────────────
const requireSuperAdmin = (user) => {
  if (!user || user.email !== 'superadmin@spotfinder.cz') throw new Error('Unauthorized');
};

// Custom POIs
export const getAdminPOIs = async () => {
  const { db } = getFirebaseServices();
  try {
    const q = query(collection(db, 'admin_pois'), orderBy('created_at', 'desc'), limit(500));
    return (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
};
export const addAdminPOI = async (user, data) => {
  requireSuperAdmin(user);
  const { db } = getFirebaseServices();
  const payload = { ...data, created_at: new Date().toISOString(), created_by: user.email };
  const ref = await addDoc(collection(db, 'admin_pois'), payload);
  return { id: ref.id, ...payload };
};
export const updateAdminPOI = async (user, id, data) => {
  requireSuperAdmin(user);
  const { db } = getFirebaseServices();
  const payload = { ...data, updated_at: new Date().toISOString() };
  await updateDoc(doc(db, 'admin_pois', id), payload);
  return { id, ...payload };
};
export const deleteAdminPOI = async (user, id) => {
  requireSuperAdmin(user);
  const { db } = getFirebaseServices();
  await deleteDoc(doc(db, 'admin_pois', id));
};

// Road closures
export const getAdminClosures = async () => {
  const { db } = getFirebaseServices();
  try {
    const q = query(collection(db, 'admin_closures'), orderBy('created_at', 'desc'), limit(500));
    return (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
};
export const addAdminClosure = async (user, data) => {
  requireSuperAdmin(user);
  const { db } = getFirebaseServices();
  const payload = { ...data, created_at: new Date().toISOString(), created_by: user.email };
  const ref = await addDoc(collection(db, 'admin_closures'), payload);
  return { id: ref.id, ...payload };
};
export const deleteAdminClosure = async (user, id) => {
  requireSuperAdmin(user);
  const { db } = getFirebaseServices();
  await deleteDoc(doc(db, 'admin_closures', id));
};

// Navigation overrides
export const getAdminNavOverrides = async () => {
  const { db } = getFirebaseServices();
  try {
    const q = query(collection(db, 'admin_nav_overrides'), orderBy('created_at', 'desc'), limit(500));
    return (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
};
export const addAdminNavOverride = async (user, data) => {
  requireSuperAdmin(user);
  const { db } = getFirebaseServices();
  const payload = { ...data, created_at: new Date().toISOString(), created_by: user.email };
  const ref = await addDoc(collection(db, 'admin_nav_overrides'), payload);
  return { id: ref.id, ...payload };
};
export const deleteAdminNavOverride = async (user, id) => {
  requireSuperAdmin(user);
  const { db } = getFirebaseServices();
  await deleteDoc(doc(db, 'admin_nav_overrides', id));
};

// Road number overrides
export const getAdminRoadOverrides = async () => {
  const { db } = getFirebaseServices();
  try {
    const q = query(collection(db, 'admin_road_overrides'), orderBy('created_at', 'desc'), limit(500));
    return (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
};
export const addAdminRoadOverride = async (user, data) => {
  requireSuperAdmin(user);
  const { db } = getFirebaseServices();
  const payload = { ...data, created_at: new Date().toISOString(), created_by: user.email };
  const ref = await addDoc(collection(db, 'admin_road_overrides'), payload);
  return { id: ref.id, ...payload };
};
export const deleteAdminRoadOverride = async (user, id) => {
  requireSuperAdmin(user);
  const { db } = getFirebaseServices();
  await deleteDoc(doc(db, 'admin_road_overrides', id));
};

// E-route overrides
export const getAdminERouteOverrides = async () => {
  const { db } = getFirebaseServices();
  try {
    const q = query(collection(db, 'admin_eroute_overrides'), orderBy('created_at', 'desc'), limit(500));
    return (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
};
export const addAdminERouteOverride = async (user, data) => {
  requireSuperAdmin(user);
  const { db } = getFirebaseServices();
  const payload = { ...data, created_at: new Date().toISOString(), created_by: user.email };
  const ref = await addDoc(collection(db, 'admin_eroute_overrides'), payload);
  return { id: ref.id, ...payload };
};
export const deleteAdminERouteOverride = async (user, id) => {
  requireSuperAdmin(user);
  const { db } = getFirebaseServices();
  await deleteDoc(doc(db, 'admin_eroute_overrides', id));
};

// ── Deleted Ambient POIs (superadmin blocklist) ───────────────────────────────
// Stores a blocklist of ambient POI IDs (lat+lon+name hash) that should never
// be shown again. Loaded once on app start and cached client-side.
export const getDeletedAmbientPOIs = async () => {
  const { db } = getFirebaseServices();
  try {
    const q = query(collection(db, 'admin_deleted_pois'), orderBy('created_at', 'desc'), limit(1000));
    return (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
};
export const addDeletedAmbientPOI = async (user, data) => {
  requireSuperAdmin(user);
  const { db } = getFirebaseServices();
  const payload = { ...data, created_at: new Date().toISOString(), created_by: user.email };
  const ref = await addDoc(collection(db, 'admin_deleted_pois'), payload);
  return { id: ref.id, ...payload };
};
export const removeDeletedAmbientPOI = async (user, id) => {
  requireSuperAdmin(user);
  const { db } = getFirebaseServices();
  await deleteDoc(doc(db, 'admin_deleted_pois', id));
};

export const base44 = {
  auth: {
    me: async () => {
      const { auth } = getFirebaseServices();
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      return { email: user.email, id: user.uid, displayName: user.displayName || user.email?.split('@')[0], photoURL: user.photoURL };
    },
    logout: async () => { await logout(); },
    redirectToLogin: () => {}
  },
  entities: {
    Spot: {
      create: async (data) => createSpot(data),
      filter: async (q, s, l) => getPublicSpots(l || 200),
      update: async (id, data) => updateSpot(id, data),
      delete: async (id) => deleteSpot(id)
    },
    SpotRating: { create: async (data) => rateSpot(data.spot_id, data.rating) }
  },
  integrations: {
    Core: {
      UploadFile: async ({ file }) => {
        const url = await uploadSpotImage(file);
        return { file_url: url };
      }
    }
  },
  appLogs: { logUserInApp: async (p) => console.log('User in app:', p) }
};
 
export const getDeletedAmbientPOIs = async () => [];
export const addDeletedAmbientPOI = async () => {};

export default base44;