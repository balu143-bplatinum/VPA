// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAmTlZiLHXRAoqAJ5WVyYiCRuoBsOvBAN8",
  authDomain: "vpa-official.firebaseapp.com",
  projectId: "vpa-official",
  storageBucket: "vpa-official.firebasestorage.app",
  messagingSenderId: "946551875600",
  appId: "1:946551875600:web:df31181a05e42582c1c295",
  measurementId: "G-B81EH5N5WG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// ─── ADD THIS CRITICAL LINE TO EXPORT THE DATABASE LOGIC ───
export const db = getFirestore(app);