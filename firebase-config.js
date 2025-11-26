import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAprT5FCxRGy_zAUPo_Mq-fjNgUDZ8htT8",
    authDomain: "ourshow-7d1b4.firebaseapp.com",
    databaseURL: "https://ourshow-7d1b4-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "ourshow-7d1b4",
    storageBucket: "ourshow-7d1b4.firebasestorage.app",
    messagingSenderId: "608739354484",
    appId: "1:608739354484:web:0a16cde65d1d94ac05ee21",
    measurementId: "G-S1VHSR27TY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export {
    auth,
    db,
    googleProvider,
    signInWithPopup,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    collection,
    addDoc,
    getDocs,
    query,
    orderBy,
    limit,
    serverTimestamp,
    doc,
    setDoc
};
