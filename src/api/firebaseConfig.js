// Firebase configuration - Replace with your own Firebase project credentials
// To set up Firebase:
// 1. Go to https://console.firebase.google.com/
// 2. Create a new project
// 3. Enable Authentication (Email/Password and Google)
// 4. Enable Firestore Database
// 5. Copy your config from Project Settings > General > Your apps

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyCJfu6SSuKJoDtLSJvNz491a8YtWznCDMk",
  authDomain: "spotfinderapp-cdc7b.firebaseapp.com",
  projectId: "spotfinderapp-cdc7b",
  storageBucket: "spotfinderapp-cdc7b.firebasestorage.app",
  messagingSenderId: "179466659021",
  appId: "1:179466659021:web:f93b90b96948a264d23584"
};

// Initialize Firebase
// Note: For Google Sign-In, you'll also need to configure:
// 1. Go to Authentication > Sign-in method > Google > Enable
// 2. Set up authorized domains in Firebase Console
