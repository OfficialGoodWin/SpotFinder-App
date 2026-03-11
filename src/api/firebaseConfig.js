// Firebase configuration - Replace with your own Firebase project credentials
// To set up Firebase:
// 1. Go to https://console.firebase.google.com/
// 2. Create a new project
// 3. Enable Authentication (Email/Password and Google)
// 4. Enable Firestore Database
// 5. Copy your config from Project Settings > General > Your apps
import { initializeApp } from "firebase/app";


export const firebaseConfig = {
  apiKey: "AIzaSyC9NPoHYPstR8L-FN-Yxd86IMFsRH1rMNw",
  authDomain: "tdzjesuj.firebaseapp.com",
  projectId: "tdzjesuj",
  storageBucket: "tdzjesuj.firebasestorage.app",
  messagingSenderId: "450933598203",
  appId: "1:450933598203:web:1dbd06dc825a8bc1d1cd5e"
};

// Note: For Google Sign-In, you'll also need to configure:
// 1. Go to Authentication > Sign-in method > Google > Enable
// 2. Set up authorized domains in Firebase Console
const app = initializeApp(firebaseConfig);

export default app;
