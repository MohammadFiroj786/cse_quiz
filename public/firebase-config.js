// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.15.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.15.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyATZBwRq35_7vSwwSQyOfjUL_RAtSKiLKg",
  authDomain: "gateprepai.firebaseapp.com",
  projectId: "gateprepai",
  storageBucket: "gateprepai.firebasestorage.app",
  messagingSenderId: "113766637461",
  appId: "1:113766637461:web:3a0a2e92af99a01753e09c",
  measurementId: "G-204Q2K1MGM"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);


//npm install -g firebase-tools
  