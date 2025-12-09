// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDEnUqqG23ztpQwWQiOtG7eOJQ1J2qMxbA",
  authDomain: "bazar-app-34a67.firebaseapp.com",
  projectId: "bazar-app-34a67",
  storageBucket: "bazar-app-34a67.firebasestorage.app",
  messagingSenderId: "568307829200",
  appId: "1:568307829200:web:4c17209f0644532c44d1d5",
  measurementId: "G-XRZC15RGC8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const db = getFirestore(app);