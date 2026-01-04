// Firebase core
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";

// Auth
import { getAuth } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

// Firestore
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// Your Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyAr3oQxAOXOtFeQIdm83dMaLj2n2ibsHYk",
    authDomain: "lifelink-a61c1.firebaseapp.com",
    projectId: "lifelink-a61c1",
    storageBucket: "lifelink-a61c1.firebasestorage.app",
    messagingSenderId: "473418229264",
    appId: "1:473418229264:web:628e0e8286d2b20cf40c95"
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export services
export const auth = getAuth(app);
export const db = getFirestore(app);
