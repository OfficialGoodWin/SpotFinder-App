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
  onAuthStateChanged,
  sendEmailVerification,
  signInAnonymously
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
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseConfig } from './firebaseConfig';
import { getRecaptchaToken } from '@/lib/recaptcha';

let app, auth, db, functionsInstance;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  functionsInstance = getFunctions(app);
} catch (error) {
  console.error("Firebase initialization error:", error);
}

export const getFirebaseServices = () => {
  if (!app || !auth || !db) {
    try {
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
      functionsInstance = getFunctions(app);
        } catch (error) {
      console.error("Firebase re-initialization error:", error);
      return null;
    }
  }
  return { app, auth, db, functions: functionsInstance };
};

// Shared callable wrapper. Admin helpers below use the same path so every
// privileged action stays behind the Cloud Function authorization checks.
const callFn = (name) => async (payload) => {
  const { functions } = getFirebaseServices();
  const fn = httpsCallable(functions, name);
  const { data } = await fn(payload);
  return data;
};
 
// Detect WebView / in-app browsers that block Google OAuth popup
export const isRestrictedBrowser = () => {
  const ua = navigator.userAgent || '';
  return /TikTok|BytedanceWebview|musical_ly|FBAN|FBAV|FB_IAB|Instagram/i.test(ua) ||
         (/Android/.test(ua) && /\bwv\b/.test(ua));
};
 
export const ensureAnonymousSession = async () => {
  const { auth } = getFirebaseServices();
  if (auth.currentUser) return auth.currentUser;
  return (await signInAnonymously(auth)).user;
};

export const loginWithEmail = async (email, password) => {
  const { auth } = getFirebaseServices();
  return (await signInWithEmailAndPassword(auth, email, password)).user;
};
 
export const registerWithEmail = async (email, password) => {
  const { auth } = getFirebaseServices();
  const user = (await createUserWithEmailAndPassword(auth, email, password)).user;
  // Required now that firestore.rules gates all content creation on
  // `request.auth.token.email_verified == true` — without this, every new
  // account would be silently unable to add a spot or leave a review the
  // moment those rules take effect, with no indication why.
  await sendEmailVerification(user).catch((err) => console.error('Failed to send verification email:', err));
  return user;
};

export const resendVerificationEmail = async () => {
  const { auth } = getFirebaseServices();
  if (!auth.currentUser) throw new Error('Not signed in');
  await sendEmailVerification(auth.currentUser);
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
// These now call the audited Cloud Function callables (functions/index.js)
// instead of writing Firestore directly — every ban/unban/delete/resolve is
// guaranteed to leave an admin_audit_log entry, since the logging happens
// server-side as part of the same call rather than as a separate write the
// client could skip or fail to make.
export const banIP = callFn('adminBanIP');
export const unbanIP = (ipAddress) => callFn('adminUnbanIP')({ ip: ipAddress });
export const isIPBanned = async (ipAddress) => {
  const { db } = getFirebaseServices();
  return (await getDoc(doc(db, IP_BANS_COLLECTION, ipAddress))).exists();
};
 
const SPOTS_COLLECTION = 'spots';
const RATINGS_COLLECTION = 'ratings';

// Public feedback is deliberately routed through a callable function. This
// lets the server verify reCAPTCHA and apply IP + anonymous-session limits
// before a Firestore document is created.
export const submitFeedback = async ({ email = '', message, language = 'en' }) => {
  if (!message?.trim()) throw new Error('Message is required');
  const recaptchaToken = await getRecaptchaToken('feedback');
  return callFn('submitFeedback')({
    email: String(email || '').trim().slice(0, 320),
    message: String(message).trim().slice(0, 3000),
    language: String(language || 'en').slice(0, 16),
    recaptchaToken,
  });
};
 
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
    quality_score: 0,
    upvote_count: 0,
    downvote_count: 0,
    flag_count: 0,
    created_date: new Date().toISOString(),
  };
  const docRef = await addDoc(collection(db, SPOTS_COLLECTION), data);
  return { id: docRef.id, ...data };
};

// Duplicate detection disabled for now (requires geohash utils)

 
export const updateSpot = async (spotId, data) => {
  const { db } = getFirebaseServices();
  await updateDoc(doc(db, SPOTS_COLLECTION, spotId), data);
};
 
export const deleteSpot = async (spotId) => {
  const { db } = getFirebaseServices();
  await deleteDoc(doc(db, SPOTS_COLLECTION, spotId));
};
 
// Routed through the audited Cloud Function callable (functions/index.js)
// so deletion always leaves an admin_audit_log entry.
export const deleteSpotAsSuperAdmin = (spotId) => callFn('adminDeleteSpot')({ spotId });
 
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
 * Submit a user's category ratings for a spot.
 *
 * Rewritten to write one document per user per spot to `spot_ratings`
 * (doc id `${spotId}_${uid}`) instead of averaging client-side and pushing
 * the result into `spots/{id}`. That old approach let any authenticated
 * user rate the same spot unlimited times (no server-side de-dupe) and,
 * combined with the ownership-only update rule on `spots`, would actually
 * have been rejected by Firestore for anyone rating someone else's spot --
 * see SECURITY_REVIEW.md section 0. The new firestore.rules validate this
 * shape directly, and a Cloud Function (onSpotRatingWritten) recomputes the
 * trusted averages on spots/{id} server-side after every write.
 *
 * @param {{parking:number, beauty:number, privacy:number}} ratings - 0 = not rated
 */
export const submitCategoryRatings = async (spotId, currentSpot, ratings, userId) => {
  const { db } = getFirebaseServices();
  if (!userId) throw new Error('Must be signed in to rate a spot');

  const ratingId = `${spotId}_${userId}`;
  await setDoc(doc(db, 'spot_ratings', ratingId), {
    spot_id: spotId,
    user_id: userId,
    parking: ratings.parking || 0,
    beauty: ratings.beauty || 0,
    privacy: ratings.privacy || 0,
    updated_date: new Date().toISOString(),
  });

  // The Cloud Function trigger updates spots/{id} asynchronously (usually
  // within a second or two); return the current spot so the UI can proceed
  // without claiming these are the final server-computed numbers.
  return currentSpot;
};

// ─── Flags (community moderation) ─────────────────────────────────────────────
const FLAGS_COLLECTION = 'flags';
const FLAG_AUTO_HIDE_THRESHOLD = 3; // distinct users flagging → auto-hide pending admin review

// reason: 'private_property' | 'dangerous' | 'duplicate' | 'spam' | 'inaccurate_location'
export const flagSpot = async (spotId, reporterEmail, reason, note = '') => {
  const { db } = getFirebaseServices();
  if (!reporterEmail || reporterEmail === 'anonymous') throw new Error('Must be signed in to flag a spot');

  // One flag per user per spot — composite doc id prevents duplicate flags,
  // and is now also enforced server-side by firestore.rules.
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

  // flag_count / auto-hide (status: 'flagged') on the spot are now computed
  // by the onFlagCreated Cloud Function (functions/index.js) using the
  // Admin SDK — a normal client is no longer allowed to write those fields
  // directly (see firestore.rules `unchanged([...])` lock on /spots update),
  // so we don't attempt it here anymore. The UI can optimistically show
  // "reported" without waiting on the recount.
  return { alreadyFlagged: false };
};

export const getOpenFlagsForAdmin = async (maxCount = 100) => {
  const { db } = getFirebaseServices();
  const q = query(collection(db, FLAGS_COLLECTION), where('status', '==', 'open'), orderBy('created_date', 'desc'), limit(maxCount));
  return (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
};

// Routed through the audited Cloud Function callable (functions/index.js)
// so every flag resolution leaves an admin_audit_log entry.
export const resolveFlag = (flagId, resolution /* 'upheld' | 'dismissed' */) =>
  callFn('adminResolveFlag')({ flagId, resolution });

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
 
export default base44;