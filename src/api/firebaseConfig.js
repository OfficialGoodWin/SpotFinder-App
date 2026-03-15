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

export const firebaseConfig = {
  apiKey: "AIzaSyCJfu6SSuKJoDtLSJvNz491a8YtWznCDMk",
  authDomain: "spotfinderapp-cdc7b.firebaseapp.com",
  projectId: "spotfinderapp-cdc7b",
  storageBucket: "spotfinderapp-cdc7b.firebasestorage.app",
  messagingSenderId: "179466659021",
  appId: "1:179466659021:web:f93b90b96948a264d23584"
};

export default firebaseConfig;
