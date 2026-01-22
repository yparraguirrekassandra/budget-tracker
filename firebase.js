import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBRnga4TSthvdXco-KLsTmsB1Y3EZrCVyI",
  authDomain: "website-test-7da42.firebaseapp.com",
  projectId: "website-test-7da42",
  storageBucket: "website-test-7da42.firebasestorage.app",
  messagingSenderId: "330863093714",
  appId: "1:330863093714:web:5825a7156066d750f78a0b",
  measurementId: "G-E1JV0DPRH1"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
