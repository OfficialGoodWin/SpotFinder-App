// Firebase configuration
// To set up:
// 1. Go to https://console.firebase.google.com/
// 2. Enable Authentication (Email/Password + Google)
// 3. Enable Firestore Database
// 4. Enable Storage  ← IMPORTANT for spot images
// 5. Copy your config from Project Settings > General > Your apps
//
// For Google Sign-In:
// - Authentication > Sign-in method > Google > Enable
// - Add your domain to "Authorized domains" (including your Vercel URL)
//
// For Storage rules, add in Firebase Console > Storage > Rules:
//   service firebase.storage {
//     match /b/{bucket}/o {
//       match /spots/{allPaths=**} {
//         allow read: if true;
//         allow write: if true; // or: if request.resource.size < 5 * 1024 * 1024;
//       }
//     }
//   }

import { selectBrowserFirebaseConfig } from '../lib/stagingFirebaseConfig';

const productionFirebaseConfig = {
  apiKey: "AIzaSyCJfu6SSuKJoDtLSJvNz491a8YtWznCDMk",
  authDomain: "spotfinderapp-cdc7b.firebaseapp.com",
  projectId: "spotfinderapp-cdc7b",
  storageBucket: "spotfinderapp-cdc7b.firebasestorage.app",
  messagingSenderId: "179466659021",
  appId: "1:179466659021:web:f93b90b96948a264d23584"
};

export const firebaseConfig = selectBrowserFirebaseConfig(
  import.meta.env.DEV && import.meta.env.VITE_FIREBASE_EMULATOR_ONLY === 'true'
    ? 'emulator' : import.meta.env.VITE_SPOTFINDER_STAGE,
  productionFirebaseConfig,
  {
    apiKey: import.meta.env.VITE_FIREBASE_STAGING_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_STAGING_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_STAGING_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_STAGING_APP_ID,
    messagingSenderId: import.meta.env.VITE_FIREBASE_STAGING_MESSAGING_SENDER_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STAGING_STORAGE_BUCKET,
  },
);

export default firebaseConfig;
