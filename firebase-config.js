// firebase-config.js — load Firebase modular SDK and initialize
// Exposes: window.dbMod, window.authMod, window.db, window.firebase

const firebaseConfig = {
  apiKey: "AIzaSyBIL23CGizjL3SVBYEOagOqMRVUx3BAKpA",
  authDomain: "ourshow-9c506.firebaseapp.com",
  projectId: "ourshow-9c506",
  storageBucket: "ourshow-9c506.firebasestorage.app",
  messagingSenderId: "44106754282",
  appId: "1:44106754282:web:8c52cab2f6cf083b8acf93",
  measurementId: "G-4PJ67QWDPM",
  databaseURL: "https://ourshow-9c506-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

// Promise that resolves when Firebase is ready
let firebaseReadyPromise;

async function initializeFirebase() {
  try {
    console.log('🔥 Loading Firebase modules...');
    
    const appModule = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js');
    const dbModule = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
    const authModule = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js');

    const app = appModule.initializeApp(firebaseConfig);
    const dbMod = dbModule.getDatabase(app);
    const authMod = authModule.getAuth(app);

    // Minimal compat wrapper for Database reference
    function makeRef(path) {
      const r = dbModule.ref(dbMod, path);
      return {
        push: (val) => dbModule.push(r, val),
        set: (val) => dbModule.set(r, val),
        update: (val) => dbModule.update(r, val),
        remove: () => dbModule.remove(r),
        child: (p) => makeRef(path.replace(/\/$/, '') + '/' + p.replace(/^\//, '')),
        on: (event, cb) => {
          if (event === 'child_added') return dbModule.onChildAdded(r, (snap) => cb(snap));
          if (event === 'value') return dbModule.onValue(r, (snap) => cb(snap));
          return dbModule.onValue(r, (snap) => cb(snap));
        },
        onDisconnect: () => {
          const od = dbModule.onDisconnect(r);
          return { remove: () => od.remove() };
        },
        get: () => dbModule.get(r)
      };
    }

    const dbCompat = {
      ref: (path) => makeRef(path)
    };

    // Auth compat wrapper
    function makeAuthCompat() {
      return {
        onAuthStateChanged: (cb) => authModule.onAuthStateChanged(authMod, cb),
        signOut: () => authModule.signOut(authMod),
        setPersistence: (p) => authModule.setPersistence(authMod, p),
        get currentUser() {
          const u = authMod.currentUser;
          if (!u) return null;
          return Object.assign(u, {
            updateProfile: (data) => authModule.updateProfile(authMod.currentUser, data)
          });
        }
      };
    }

    // Build compat-style `firebase` global
    const firebaseCompat = {};
    firebaseCompat.apps = [app];
    firebaseCompat.initializeApp = (cfg) => {
      if (firebaseCompat.apps && firebaseCompat.apps.length) return firebaseCompat.apps[0];
      const a = appModule.initializeApp(cfg || firebaseConfig);
      firebaseCompat.apps.push(a);
      return a;
    };

    firebaseCompat.database = () => dbCompat;

    function authFactory() { return makeAuthCompat(); }
    authFactory.Auth = { Persistence: { LOCAL: authModule.browserLocalPersistence } };
    firebaseCompat.auth = authFactory;

    // Expose to window
    window.firebase = firebaseCompat;
    window.db = dbCompat;
    window.dbMod = dbMod;
    window.authMod = authMod;

    console.log('✅ Firebase initialized successfully');
    return { app, dbMod, authMod, db: dbCompat, firebase: firebaseCompat };

  } catch (err) {
    console.error('❌ Firebase initialization failed:', err);
    
    // Fallback values
    window.firebase = { apps: [] };
    window.db = null;
    window.dbMod = null;
    window.authMod = null;
    
    throw err; // Re-throw so callers know it failed
  }
}

// Initialize immediately
firebaseReadyPromise = initializeFirebase();

// Export both the promise and a helper function
export const waitForFirebase = () => firebaseReadyPromise;
export default firebaseReadyPromise;