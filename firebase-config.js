// MOCK FIREBASE CONFIG TO UNBLOCK HOMEPAGE
// The real config is corrupted. This mock allows the site to load without Auth/DB.

const auth = { 
    currentUser: null,
    onAuthStateChanged: (cb) => cb(null) 
};
const db = {};
const provider = {};
const signInWithPopup = async () => { alert('Firebase config missing. Login disabled.'); return null; };
const signOut = async () => { console.log('Mock signout'); };
const onAuthStateChanged = (authInstance, callback) => {
    // Simulate no user logged in
    callback(null);
    return () => {}; // Unsubscribe mock
};
const initializeApp = () => {};

export { auth, db, provider, signInWithPopup, signOut, onAuthStateChanged, initializeApp };
