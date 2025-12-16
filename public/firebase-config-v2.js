
// Public Firebase Config V2 - Clean & Standard
// Created to bypass gitignore issues and ensure clean exports

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, setDoc, doc, updateDoc, deleteDoc, getDoc, getDocs, serverTimestamp, query, where, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase configuration
// Using the Project ID found earlier. 
// ApiKey is a placeholder based on what was recovered.
const firebaseConfig = {
    apiKey: "AIzaSyAprT5FCxRGy_zAUPo_Mq-fjNgUDZ8htT8",
    authDomain: "ourshow-7d1b4.firebaseapp.com",
    projectId: "ourshow-7d1b4",
    storageBucket: "ourshow-7d1b4.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};

// Initialize
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export {
    app,
    auth,
    db,
    provider,
    signInWithPopup,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    collection,
    addDoc,
    setDoc,
    doc,
    updateDoc,
    deleteDoc,
    getDoc,
    getDocs,
    serverTimestamp,
    query,
    where,
    orderBy,
    limit,
    onSnapshot
};
