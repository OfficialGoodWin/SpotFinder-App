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
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  verifyBeforeUpdateEmail,
  signInAnonymously,
  multiFactor,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
  getMultiFactorResolver,
  updateProfile
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
  getDoc,
  documentId,
  arrayUnion,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { validateImageDimensions, validateImageFile } from '@/lib/imageUploadValidation';
import { firebaseConfig } from './firebaseConfig';
import { getRecaptchaToken } from '@/lib/recaptcha';

let app, auth, db, functionsInstance, storage;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  functionsInstance = getFunctions(app);
  storage = getStorage(app);
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
      storage = getStorage(app);
        } catch (error) {
      console.error("Firebase re-initialization error:", error);
      return null;
    }
  }
  return { app, auth, db, functions: functionsInstance, storage };
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
 
export const ensureAccountProfile = callFn('ensureAccountProfile');
export const setAccountDateOfBirth = callFn('setAccountDateOfBirth');

export const registerWithEmail = async (email, password, dateOfBirth, displayName = '') => {
  const { auth } = getFirebaseServices();
  const user = (await createUserWithEmailAndPassword(auth, email, password)).user;
  if (displayName.trim()) await updateProfile(user, { displayName: displayName.trim().slice(0, 80) });
  await setAccountDateOfBirth({ dateOfBirth });
  // Required now that firestore.rules gates all content creation on
  // `request.auth.token.email_verified == true` — without this, every new
  // account would be silently unable to add a spot or leave a review the
  // moment those rules take effect, with no indication why.
  await sendEmailVerification(user).catch((err) => console.error('Failed to send verification email:', err));
  return user;
};

// ── Multi-factor auth (SMS) ────────────────────────────────────────────────
// Requires: Firebase project upgraded to Identity Platform, SMS MFA enabled
// in the console, and the signed-in user's email already verified (Firebase
// itself enforces that last one).
let recaptchaVerifierCache = null;
export const getMfaRecaptchaVerifier = (containerId) => {
  const { auth } = getFirebaseServices();
  if (!recaptchaVerifierCache) {
    recaptchaVerifierCache = new RecaptchaVerifier(auth, containerId, { size: 'invisible' });
  }
  return recaptchaVerifierCache;
};
export const clearMfaRecaptchaVerifier = () => {
  recaptchaVerifierCache?.clear?.();
  recaptchaVerifierCache = null;
};

// Step 1 of enrolling a NEW second factor on the currently signed-in user.
// Returns a verificationId to pass into completeMfaEnrollment along with the
// SMS code the user receives.
export const startMfaEnrollment = async (user, phoneNumber, recaptchaVerifier) => {
  const { auth } = getFirebaseServices();
  const session = await multiFactor(user).getSession();
  const phoneAuthProvider = new PhoneAuthProvider(auth);
  return phoneAuthProvider.verifyPhoneNumber({ phoneNumber, session }, recaptchaVerifier);
};

export const completeMfaEnrollment = async (user, verificationId, code, displayName = 'Phone') => {
  const cred = PhoneAuthProvider.credential(verificationId, code);
  const assertion = PhoneMultiFactorGenerator.assertion(cred);
  await multiFactor(user).enroll(assertion, displayName);
};

export const getEnrolledMfaFactors = (user) => multiFactor(user).enrolledFactors;

export const unenrollMfaFactor = async (user, factorUid) => {
  await multiFactor(user).unenroll(factorUid);
};

// Called from the login screen's catch block when signInWithEmailAndPassword
// throws 'auth/multi-factor-auth-required'. Returns a resolver describing
// which second factors this user has enrolled.
export const getMfaResolverFromError = (error) => {
  const { auth } = getFirebaseServices();
  return getMultiFactorResolver(auth, error);
};

// Step 1 of completing sign-in with a second factor: send the SMS code.
export const startMfaSignIn = async (resolver, hintIndex, recaptchaVerifier) => {
  const { auth } = getFirebaseServices();
  const phoneAuthProvider = new PhoneAuthProvider(auth);
  return phoneAuthProvider.verifyPhoneNumber(
    { multiFactorHint: resolver.hints[hintIndex], session: resolver.session },
    recaptchaVerifier
  );
};

// Step 2: finish signing in with the code the user received.
export const completeMfaSignIn = async (resolver, verificationId, code) => {
  const cred = PhoneAuthProvider.credential(verificationId, code);
  const assertion = PhoneMultiFactorGenerator.assertion(cred);
  return (await resolver.resolveSignIn(assertion)).user;
};

export const resendVerificationEmail = async () => {
  const { auth } = getFirebaseServices();
  if (!auth.currentUser) throw new Error('Not signed in');
  await sendEmailVerification(auth.currentUser);
};

const reauthenticateWithPassword = async (currentPassword) => {
  const { auth } = getFirebaseServices();
  const user = auth.currentUser;
  if (!user?.email || user.isAnonymous) throw new Error('A signed-in email account is required');
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  return user;
};

export const changeAccountPassword = async (currentPassword, nextPassword) => {
  if (String(nextPassword || '').length < 8) throw new Error('New password must be at least 8 characters');
  const user = await reauthenticateWithPassword(currentPassword);
  await updatePassword(user, nextPassword);
};

export const requestAccountEmailChange = async (currentPassword, nextEmail) => {
  const email = String(nextEmail || '').trim();
  if (!email || !email.includes('@')) throw new Error('Enter a valid email address');
  const user = await reauthenticateWithPassword(currentPassword);
  await verifyBeforeUpdateEmail(user, email);
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
 
// Compress image in-browser, then store the binary file in Firebase Storage.
// Firestore keeps only a small URL instead of a base64 payload.
export const uploadSpotImage = async (file) => {
  const { auth, storage } = getFirebaseServices();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('You must be signed in to upload a photo.');
  await validateImageFile(file);

  const blob = await new Promise((resolve, reject) => {
    const MAX_W = 1200, MAX_H = 1200, QUALITY = 0.78;
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        try {
          validateImageDimensions(width, height);
        } catch (error) {
          reject(error);
          return;
        }
        if (width > MAX_W || height > MAX_H) {
          const ratio = Math.min(MAX_W / width, MAX_H / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Image processing is unavailable in this browser.'));
          return;
        }
        context.drawImage(img, 0, 0, width, height);
        canvas.toBlob(result => result ? resolve(result) : reject(new Error('Image encoding failed')), 'image/jpeg', QUALITY);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  if (blob.size > 5 * 1024 * 1024) throw new Error('The processed image is too large to upload.');

  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `community/${uid}/${id}.jpg`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, blob, { contentType: 'image/jpeg', cacheControl: 'public,max-age=31536000,immutable' });
  return getDownloadURL(ref);
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

// Scalable viewport query: only fetch spots currently inside the map bounds.
// We sort after reading so Firestore does not need to order by a third field
// while applying multiple latitude/longitude range filters.
export const getPublicSpotsInBounds = async ({ south, west, north, east }, maxCount = 500) => {
  const { db } = getFirebaseServices();
  const clauses = [
    where('is_public', '==', true),
    where('status', 'in', ['published', 'pending_trust']),
    where('lat', '>=', Number(south)),
    where('lat', '<=', Number(north)),
  ];

  // The app is Czech-focused; still handle a world-wrapped viewport defensively.
  if (Number(east) - Number(west) < 360) {
    clauses.push(where('lng', '>=', Number(west)), where('lng', '<=', Number(east)));
  }

  const q = query(collection(db, SPOTS_COLLECTION), ...clauses, limit(maxCount));
  const rows = (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
  return rows.sort((a, b) => String(b.created_date || '').localeCompare(String(a.created_date || '')));
};

export const getPublicSpotById = async (spotId) => {
  if (!spotId) return null;
  const { db } = getFirebaseServices();
  const snapshot = await getDoc(doc(db, SPOTS_COLLECTION, String(spotId)));
  if (!snapshot.exists()) return null;
  const spot = { id: snapshot.id, ...snapshot.data() };
  return spot.is_public && ['published', 'pending_trust'].includes(spot.status) ? spot : null;
};

const distanceKm = (origin, spot) => {
  const toRad = value => value * Math.PI / 180;
  const dLat = toRad(Number(spot.lat) - origin[0]);
  const dLng = toRad(Number(spot.lng) - origin[1]);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(origin[0])) * Math.cos(toRad(Number(spot.lat))) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Nearby discovery is independent from the visible viewport. For an unlimited
// search, expand progressively and stop as soon as the nearest 20 are known.
export const getPublicSpotsNear = async (origin, maxDistance = Infinity, targetCount = 20) => {
  const lat = Number(origin?.[0]);
  const lng = Number(origin?.[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
  const radii = Number.isFinite(maxDistance) ? [Math.max(1, maxDistance)] : [25, 100, 400, 1600, 5000];
  const found = new Map();
  for (const radius of radii) {
    const latDelta = Math.min(89, radius / 111);
    const lngDelta = Math.min(180, radius / Math.max(12, 111 * Math.cos(lat * Math.PI / 180)));
    const rows = await getPublicSpotsInBounds({
      south: Math.max(-90, lat - latDelta), north: Math.min(90, lat + latDelta),
      west: lng - lngDelta, east: lng + lngDelta,
    }, 500);
    rows.forEach(row => found.set(row.id, row));
    if (Number.isFinite(maxDistance) || found.size >= targetCount) break;
  }
  return [...found.values()]
    .map(spot => ({ ...spot, _km: distanceKm([lat, lng], spot) }))
    .filter(spot => !Number.isFinite(maxDistance) || spot._km <= maxDistance)
    .sort((a, b) => a._km - b._km)
    .slice(0, targetCount);
};
 
export const getUserSpots = async (userEmail, maxCount = 50) => {
  const { db } = getFirebaseServices();
  const q = query(collection(db, SPOTS_COLLECTION), where('created_by', '==', userEmail), orderBy('created_date', 'desc'), limit(maxCount));
  return (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
};
 
export const createSpot = async (spotData) => {
  return callFn('submitSpot')(spotData);
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
 * @param {{overall:number, access:number, condition:number, safety:number, crowdedness:number}} ratings - schema v2
 */
export const submitCategoryRatings = async (spotId, currentSpot, ratings, userId) => {
  const { db } = getFirebaseServices();
  if (!userId) throw new Error('Must be signed in to rate a spot');

  const ratingId = `${spotId}_${userId}`;
  await setDoc(doc(db, 'spot_ratings', ratingId), {
    spot_id: spotId,
    user_id: userId,
    overall: ratings.overall || 0,
    access: ratings.access || 0,
    condition: ratings.condition || 0,
    safety: ratings.safety || 0,
    crowdedness: ratings.crowdedness || 0,
    schema: 2,
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


// ─── Likes + saves (verified accounts, one relation doc per user/spot) ─────
const SPOT_LIKES_COLLECTION = 'spot_likes';
const SPOT_SAVES_COLLECTION = 'spot_saves';

function requireVerifiedUser(user) {
  if (!user?.id) throw new Error('Sign in to continue');
  if (!user.emailVerified) throw new Error('Verify your email to continue');
}

export const getSpotSocialState = async (spotId, user, initialCounts = {}) => {
  const { db } = getFirebaseServices();
  let liked = false, saved = false;
  if (user?.id) {
    const [l, s] = await Promise.all([
      getDoc(doc(db, SPOT_LIKES_COLLECTION, `${spotId}_${user.id}`)),
      getDoc(doc(db, SPOT_SAVES_COLLECTION, `${spotId}_${user.id}`)),
    ]);
    liked = l.exists(); saved = s.exists();
  }
  return {
    liked,
    saved,
    likesCount: initialCounts.likesCount || 0,
    savesCount: initialCounts.savesCount || 0,
  };
};

export const toggleSpotLike = async (spotId, user, currentlyLiked) => {
  requireVerifiedUser(user);
  const { db } = getFirebaseServices();
  const ref = doc(db, SPOT_LIKES_COLLECTION, `${spotId}_${user.id}`);
  if (currentlyLiked) await deleteDoc(ref);
  else await setDoc(ref, { spot_id: spotId, user_id: user.id, created_date: new Date().toISOString() });
  return !currentlyLiked;
};

export const toggleSpotSave = async (spotId, user, currentlySaved) => {
  requireVerifiedUser(user);
  const { db } = getFirebaseServices();
  const ref = doc(db, SPOT_SAVES_COLLECTION, `${spotId}_${user.id}`);
  if (currentlySaved) await deleteDoc(ref);
  else await setDoc(ref, { spot_id: spotId, user_id: user.id, created_date: new Date().toISOString() });
  return !currentlySaved;
};

async function getSpotsForRelations(collectionName, uid, maxCount = 100) {
  const { db } = getFirebaseServices();
  if (!uid) return [];
  const relQ = query(collection(db, collectionName), where('user_id', '==', uid), limit(maxCount));
  const rels = (await getDocs(relQ)).docs.map(d => d.data()).sort((a,b) => String(b.created_date || '').localeCompare(String(a.created_date || '')));
  const ids = [...new Set(rels.map(r => r.spot_id).filter(Boolean))];
  const spotsById = new Map();
  // Firestore supports up to 30 values for an `in` query. Batching avoids the
  // previous burst of as many as 100 independent document requests.
  for (let offset = 0; offset < ids.length; offset += 30) {
    const batchIds = ids.slice(offset, offset + 30);
    const batch = await getDocs(query(collection(db, SPOTS_COLLECTION), where(documentId(), 'in', batchIds)));
    batch.docs.forEach(snap => spotsById.set(snap.id, { id: snap.id, ...snap.data() }));
  }
  return ids.map(id => spotsById.get(id)).filter(Boolean);
}

export const getSavedSpots = (uid, maxCount = 100) => getSpotsForRelations(SPOT_SAVES_COLLECTION, uid, maxCount);
export const getLikedSpots = (uid, maxCount = 100) => getSpotsForRelations(SPOT_LIKES_COLLECTION, uid, maxCount);

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

  // The public banner deliberately supports plain text only. Its Status Page
  // link is hard-coded in StatusBanner.jsx, so admins never provide a URL.
  // Sanitise here as well as at render time for defence in depth.
  const safeMessage = String(message || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/(?:https?:\/\/|www\.)\S+/gi, '')
    .replace(/\b(?:[a-z0-9-]+\.)+[a-z]{2,63}(?:\/\S*)?/gi, '')
    .replace(/\b(?:see|read|view)\s+(?:more\s+)?(?:on|in|at)?\s*(?:the\s+)?status\s+page\.?\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);

  await setDoc(doc(db, ...MAINTENANCE_DOC_PATH), {
    status,
    message: safeMessage,
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

export const addPOIPhoto = async (poiId, imageUrl, userEmail) => {
  const { db } = getFirebaseServices();
  const docRef = await addDoc(collection(db, POI_PHOTOS_COLLECTION), {
    poi_id: poiId,
    image: imageUrl,
    created_by: userEmail || 'anonymous',
    created_date: new Date().toISOString(),
  });
  return { id: docRef.id, poi_id: poiId, image: imageUrl };
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
  if (!user) throw new Error('Unauthorized');
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

// ── Status page admin helpers (superadmin-only, enforced by firestore.rules) ──
// Dates/timestamps below are always computed here (never passed in by the
// caller) so the admin UI never has to think about formatting.
const todayStr = () => new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'

export const getStatusServices = async () => {
  const { db } = getFirebaseServices();
  const snap = await getDocs(query(collection(db, 'status_services'), orderBy('order', 'asc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const createStatusService = async (name, order) => {
  const { db } = getFirebaseServices();
  return addDoc(collection(db, 'status_services'), {
    name, order: Number(order) || 0, days: Array(90).fill('up'), lastUpdatedDate: todayStr(),
  });
};

// Sets TODAY's status for a service. If the service hasn't been touched yet
// today, the 90-day window rolls forward by one (oldest day drops off);
// if it's already been updated today, today's entry is just overwritten so
// re-clicking a status a few times in one day doesn't skew the history.
export const publishServiceStatus = async (service, status) => {
  const { db } = getFirebaseServices();
  const ref = doc(db, 'status_services', service.id);
  const days = [...(service.days?.length ? service.days : Array(90).fill('up'))];
  const isNewDay = service.lastUpdatedDate !== todayStr();
  if (isNewDay) {
    days.push(status);
    if (days.length > 90) days.shift();
  } else {
    days[days.length - 1] = status;
  }
  await updateDoc(ref, { days, lastUpdatedDate: todayStr() });
};

export const getOpenIncidents = async () => {
  const { db } = getFirebaseServices();
  const snap = await getDocs(query(collection(db, 'status_incidents'), where('resolved', '==', false), orderBy('date', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const getRecentIncidents = async (n = 10) => {
  const { db } = getFirebaseServices();
  const snap = await getDocs(query(collection(db, 'status_incidents'), orderBy('date', 'desc'), limit(n)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// type: 'investigating' | 'identified' | 'monitoring' | 'resolved'
export const startIncident = async (title, type, message, impact = 'degraded') => {
  const { db } = getFirebaseServices();
  // `impact` controls the public status banner while the incident is open.
  // Old incidents without this field are treated as degraded by Status.jsx,
  // so publishing this update also fixes already-open incidents.
  const safeImpact = impact === 'down' ? 'down' : 'degraded';
  return addDoc(collection(db, 'status_incidents'), {
    title,
    date: todayStr(),
    resolved: type === 'resolved',
    impact: safeImpact,
    updates: [{ type, message, at: new Date().toISOString() }],
  });
};

export const addIncidentUpdate = async (incidentId, type, message) => {
  const { db } = getFirebaseServices();
  const ref = doc(db, 'status_incidents', incidentId);
  await updateDoc(ref, {
    updates: arrayUnion({ type, message, at: new Date().toISOString() }),
    ...(type === 'resolved' ? { resolved: true } : {}),
  });
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
// ─── Central moderation/admin panel ──────────────────────────────────────────
export const getAdminAccess = async () => {
  const { auth } = getFirebaseServices();
  const u = auth.currentUser;
  if (!u || u.isAnonymous) return false;
  const token = await u.getIdTokenResult();
  return token.claims?.admin === true;
};

// One-time bootstrap for the original SpotFinder superadmin account.
// The callable function performs the real authorization check server-side;
// this client helper cannot grant a claim by itself.
export const activateBootstrapAdmin = (targetEmail) =>
  callFn('setAdminClaim')({ targetEmail });

export const submitGeneralReport = async ({ category, subject, message, targetType = 'other', targetId = '', deviceId = '', targetSnapshot = {} }) => {
  const recaptchaToken = await getRecaptchaToken('report');
  return callFn('submitReport')({ category, subject, message, targetType, targetId, deviceId, targetSnapshot, recaptchaToken });
};

export const getAdminReports = async (maxCount = 200) => {
  const { db } = getFirebaseServices();
  const snap = await getDocs(query(collection(db, 'reports'), orderBy('created_at', 'desc'), limit(maxCount)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};
export const adminResolveReport = (reportId, resolution = 'resolved') => callFn('adminResolveReport')({ reportId, resolution });
export const adminDeleteReport = (reportId) => callFn('adminDeleteReport')({ reportId });
export const adminBlockReporter = (reportId, reason = 'Report spam') => callFn('adminBlockReporter')({ reportId, reason });

export const getAdminSpots = async (maxCount = 300) => {
  const { db } = getFirebaseServices();
  const snap = await getDocs(query(collection(db, 'spots'), orderBy('created_date', 'desc'), limit(maxCount)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};
export const adminUpdateSpot = (spotId, patch) => callFn('adminUpdateSpot')({ spotId, patch });

export const getAdminPOIPhotos = async (maxCount = 300) => {
  const { db } = getFirebaseServices();
  const snap = await getDocs(query(collection(db, 'poi_photos'), orderBy('created_date', 'desc'), limit(maxCount)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};
export const adminDeletePOIPhoto = (photoId) => callFn('adminDeletePOIPhoto')({ photoId });

export const getSocialPosts = async (targetType, targetId, includeModerated = false) => {
  const { db } = getFirebaseServices();
  const constraints = [where('target_key', '==', `${targetType}:${targetId}`), limit(20)];
  if (!includeModerated) constraints.splice(1, 0, where('status', '==', 'active'));
  const snap = await getDocs(query(collection(db, 'social_posts'), ...constraints));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
};

export const addSocialPost = async ({ url, targetType, targetId, targetName }) => {
  const recaptchaToken = await getRecaptchaToken('social_post');
  return callFn('addSocialPost')({ url, targetType, targetId, targetName, recaptchaToken });
};

export const getAdminSocialPosts = async (maxCount = 300) => {
  const { db } = getFirebaseServices();
  const snap = await getDocs(query(collection(db, 'social_posts'), orderBy('created_at', 'desc'), limit(maxCount)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const adminSetSocialPostStatus = (socialPostId, status) =>
  callFn('adminSetSocialPostStatus')({ socialPostId, status });
