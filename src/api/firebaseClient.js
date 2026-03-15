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
 
let app, auth, db, storage;
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
 
export const getPublicSpots = async (maxCount = 200) => {
  const { db } = getFirebaseServices();
  const q = query(collection(db, SPOTS_COLLECTION), where('is_public', '==', true), orderBy('created_date', 'desc'), limit(maxCount));
  return (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
};
 
export const getUserSpots = async (userEmail, maxCount = 50) => {
  const { db } = getFirebaseServices();
  const q = query(collection(db, SPOTS_COLLECTION), where('created_by', '==', userEmail), orderBy('created_date', 'desc'), limit(maxCount));
  return (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
};
 
export const createSpot = async (spotData) => {
  const { db } = getFirebaseServices();
  const data = { ...spotData, created_date: new Date().toISOString() };
  const docRef = await addDoc(collection(db, SPOTS_COLLECTION), data);
  return { id: docRef.id, ...data };
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
 
  const p = recalc('parking_rating', 'parking_rating_count', ratings.parking);
  const b = recalc('beauty_rating',  'beauty_rating_count',  ratings.beauty);
  const v = recalc('privacy_rating', 'privacy_rating_count', ratings.privacy);
 
  // Recalculate overall as average of all three updated categories
  const cats = [
    p ?? (currentSpot.parking_rating || 0),
    b ?? (currentSpot.beauty_rating  || 0),
    v ?? (currentSpot.privacy_rating || 0),
  ].filter(x => x > 0);
 
  if (cats.length > 0) {
    const newOverall = Math.round(cats.reduce((s, x) => s + x, 0) / cats.length * 10) / 10;
    // overall_count = sum of all category counts
    const totalCount = (updates.parking_rating_count ?? (currentSpot.parking_rating_count || 0))
                     + (updates.beauty_rating_count  ?? (currentSpot.beauty_rating_count  || 0))
                     + (updates.privacy_rating_count ?? (currentSpot.privacy_rating_count || 0));
    updates.rating       = newOverall;
    updates.rating_count = totalCount;
  }
 
  if (Object.keys(updates).length > 0) {
    await updateDoc(doc(db, SPOTS_COLLECTION, spotId), updates);
  }
 
  return { ...currentSpot, ...updates };
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
 