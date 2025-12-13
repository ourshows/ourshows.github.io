// MOCK FIREBASE WRAPPER TO UNBLOCK HOMEPAGE
// This removes all external dependencies so the site can load.

const auth = { currentUser: null };
const db = {};
const provider = {};

const signInWithPopup = async () => { alert("Firebase disconnected."); return null; };
const signOut = async () => { };
const onAuthStateChanged = (auth, cb) => cb(null);

// Mock Firestore functions
const collection = () => { };
const addDoc = async () => { };
const setDoc = async () => { };
const doc = () => { };
const updateDoc = async () => { };
const deleteDoc = async () => { };
const getDoc = async () => ({ exists: () => false, data: () => ({}) });
const getDocs = async () => ({ empty: true, forEach: () => { }, docs: [] });
const serverTimestamp = () => new Date();
const query = () => { };
const where = () => { };
const orderBy = () => { };
const limit = () => { };

export {
    auth, db, provider, signInWithPopup, signOut, onAuthStateChanged,
    collection, addDoc, setDoc, doc, updateDoc, deleteDoc, getDoc, getDocs,
    serverTimestamp, query, where, orderBy, limit
};
