
// Real Firebase Wrapper (Redirect to Public Config)
// The root firebase-config.js is a mock/placeholder.
// public/firebase-config.js contains the real keys and SDK exports.

import * as FirebaseConfig from './public/firebase-config-v2.js';

export const auth = FirebaseConfig.auth;
export const db = FirebaseConfig.db;
export const provider = FirebaseConfig.provider; // Exporting provider as generic
export const googleProvider = FirebaseConfig.provider; // Alias for backward compatibility if needed
export const signInWithPopup = FirebaseConfig.signInWithPopup;
export const signInWithEmailAndPassword = FirebaseConfig.signInWithEmailAndPassword; // ADDED THIS
export const signOut = FirebaseConfig.signOut;
export const onAuthStateChanged = FirebaseConfig.onAuthStateChanged;
export const collection = FirebaseConfig.collection;
export const collectionGroup = FirebaseConfig.collectionGroup;
export const addDoc = FirebaseConfig.addDoc;
export const setDoc = FirebaseConfig.setDoc;
export const doc = FirebaseConfig.doc;
export const updateDoc = FirebaseConfig.updateDoc;
export const deleteDoc = FirebaseConfig.deleteDoc;
export const getDoc = FirebaseConfig.getDoc;
export const getDocs = FirebaseConfig.getDocs;
export const serverTimestamp = FirebaseConfig.serverTimestamp;
export const query = FirebaseConfig.query;
export const where = FirebaseConfig.where;
export const orderBy = FirebaseConfig.orderBy;
export const limit = FirebaseConfig.limit;
export const onSnapshot = FirebaseConfig.onSnapshot;
export const arrayUnion = FirebaseConfig.arrayUnion;
export const arrayRemove = FirebaseConfig.arrayRemove;
