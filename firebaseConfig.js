import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// TODO: Replace the following with your app's Firebase project configuration
// See: https://firebase.google.com/docs/web/setup#config-object
const firebaseConfig = {
    apiKey: "AIzaSyByEarz9zylJaeFn5qTmF8PeQL5q0uxxbM",
    authDomain: "nueva-cuadrilla.firebaseapp.com",
    projectId: "nueva-cuadrilla",
    storageBucket: "nueva-cuadrilla.firebasestorage.app",
    messagingSenderId: "302157087214",
    appId: "1:302157087214:web:dee62a8b63dc5129c18eff",
    measurementId: "G-9HP40L0Z4L"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);
export const auth = getAuth(app);
