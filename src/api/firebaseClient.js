import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
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

// Initialize Firebase
let app;
let auth;
let db;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error("Firebase initialization error:", error);
}

// Export Firebase services getter
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

// Auth functions
export const loginWithEmail = async (email, password) => {
  const { auth } = getFirebaseServices();
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
};

export const registerWithEmail = async (email, password) => {
  const { auth } = getFirebaseServices();
  const result = await createUserWithEmailAndPassword(auth, email, password);
  return result.user;
};

export const loginWithGoogle = async () => {
  const { auth } = getFirebaseServices();
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
};

export const logout = async () => {
  const { auth } = getFirebaseServices();
  await firebaseSignOut(auth);
};

export const onAuthChange = (callback) => {
  const { auth } = getFirebaseServices();
  return onAuthStateChanged(auth, callback);
};

// IP Ban functions (superadmin only)
const IP_BANS_COLLECTION = 'ip_bans';

export const banIP = async (ipAddress, reason = 'Violation of terms') => {
  const { db, auth } = getFirebaseServices();
  const user = auth.currentUser;
  
  // Check if user is superadmin
  if (!user || user.email !== 'superadmin@spotfinder.cz') {
    throw new Error('Unauthorized: Only superadmin can ban IPs');
  }
  
  const banRef = doc(db, IP_BANS_COLLECTION, ipAddress);
  await setDoc(banRef, {
    ip: ipAddress,
    reason,
    banned_by: user.email,
    banned_at: new Date().toISOString()
  });
};

export const unbanIP = async (ipAddress) => {
  const { db, auth } = getFirebaseServices();
  const user = auth.currentUser;
  
  if (!user || user.email !== 'superadmin@spotfinder.cz') {
    throw new Error('Unauthorized: Only superadmin can unban IPs');
  }
  
  const banRef = doc(db, IP_BANS_COLLECTION, ipAddress);
  await deleteDoc(banRef);
};

export const isIPBanned = async (ipAddress) => {
  const { db } = getFirebaseServices();
  const banRef = doc(db, IP_BANS_COLLECTION, ipAddress);
  const banDoc = await getDoc(banRef);
  return banDoc.exists();
};

// Spot functions - using Firestore
const SPOTS_COLLECTION = 'spots';
const RATINGS_COLLECTION = 'ratings';

export const getPublicSpots = async (maxCount = 200) => {
  const { db } = getFirebaseServices();
  const spotsRef = collection(db, SPOTS_COLLECTION);
  const q = query(
    spotsRef, 
    where('is_public', '==', true),
    orderBy('created_date', 'desc'),
    limit(maxCount)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

export const getUserSpots = async (userEmail, maxCount = 50) => {
  const { db } = getFirebaseServices();
  const spotsRef = collection(db, SPOTS_COLLECTION);
  const q = query(
    spotsRef,
    where('created_by', '==', userEmail),
    orderBy('created_date', 'desc'),
    limit(maxCount)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

export const createSpot = async (spotData) => {
  const { db } = getFirebaseServices();
  const spotsRef = collection(db, SPOTS_COLLECTION);
  
  const spotWithTimestamp = {
    ...spotData,
    created_date: new Date().toISOString()
  };
  
  const docRef = await addDoc(spotsRef, spotWithTimestamp);
  return { id: docRef.id, ...spotWithTimestamp };
};

export const updateSpot = async (spotId, data) => {
  const { db } = getFirebaseServices();
  const spotRef = doc(db, SPOTS_COLLECTION, spotId);
  await updateDoc(spotRef, data);
};

export const deleteSpot = async (spotId) => {
  const { db } = getFirebaseServices();
  const spotRef = doc(db, SPOTS_COLLECTION, spotId);
  await deleteDoc(spotRef);
};

// Superadmin can delete any spot
export const deleteSpotAsSuperAdmin = async (spotId) => {
  const { db, auth } = getFirebaseServices();
  const user = auth.currentUser;
  
  if (!user || user.email !== 'superadmin@spotfinder.cz') {
    throw new Error('Unauthorized: Only superadmin can delete any spot');
  }
  
  const spotRef = doc(db, SPOTS_COLLECTION, spotId);
  await deleteDoc(spotRef);
};

export const rateSpot = async (spotId, rating) => {
  const { db } = getFirebaseServices();
  const ratingsRef = collection(db, RATINGS_COLLECTION);
  
  await addDoc(ratingsRef, {
    spot_id: spotId,
    rating: rating,
    created_date: new Date().toISOString()
  });
};

export const updateSpotRating = async (spotId, newRating, newCount) => {
  const { db } = getFirebaseServices();
  const spotRef = doc(db, SPOTS_COLLECTION, spotId);
  await updateDoc(spotRef, {
    rating: newRating,
    rating_count: newCount
  });
};

// Export base44-compatible API (for backward compatibility)
export const base44 = {
  auth: {
    me: async () => {
      const { auth } = getFirebaseServices();
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Not authenticated');
      }
      return {
        email: user.email,
        id: user.uid,
        displayName: user.displayName || user.email?.split('@')[0],
        photoURL: user.photoURL
      };
    },
    logout: async () => {
      await logout();
    },
    redirectToLogin: (redirectUrl) => {
      console.log('Login redirect requested:', redirectUrl);
    }
  },
  entities: {
    Spot: {
      create: async (data) => createSpot(data),
      filter: async (queryObj, sortField, limitVal) => {
        return getPublicSpots(limitVal || 200);
      },
      update: async (id, data) => updateSpot(id, data),
      delete: async (id) => deleteSpot(id)
    },
    SpotRating: {
      create: async (data) => rateSpot(data.spot_id, data.rating)
    }
  },
  integrations: {
    Core: {
      UploadFile: async ({ file }) => {
        return { file_url: URL.createObjectURL(file) };
      }
    }
  },
  appLogs: {
    logUserInApp: async (pageName) => {
      console.log('User in app:', pageName);
    }
  }
};

export default base44;
