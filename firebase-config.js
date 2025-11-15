// firebase-config.js — load Firebase compat SDKs and initialize window.db/window.auth
// This file is intentionally small and loaded before `config.js`/`main.js` in `index.html`.

(async function () {
  // Modular Firebase loader + lightweight compat wrapper
  // Initializes modular SDK and exposes:
  // - `window.dbMod` (modular Database instance)
  // - `window.authMod` (modular Auth instance)
  // - `window.db` (compat-style wrapper with db.ref(...).push/on/set/remove/...)
  // - `window.firebase` (compat-style surface: apps, initializeApp, auth(), database())

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

  try {
    const appModule = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js');
    const dbModule = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
    const authModule = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js');

    const app = appModule.initializeApp(firebaseConfig);
    const dbMod = dbModule.getDatabase(app);
    const authMod = authModule.getAuth(app);

    // Minimal compat wrapper for Database reference used by this codebase
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
          // fallback: treat other events as value
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
          // attach updateProfile to mimic compat user API
          return Object.assign(u, {
            updateProfile: (data) => authModule.updateProfile(authMod.currentUser, data)
          });
        }
      };
    }

    // Build a compat-style `firebase` global
    const firebaseCompat = {};
    firebaseCompat.apps = [app];
    firebaseCompat.initializeApp = (cfg) => {
      // if already initialized, return the first app
      if (firebaseCompat.apps && firebaseCompat.apps.length) return firebaseCompat.apps[0];
      const a = appModule.initializeApp(cfg || firebaseConfig);
      firebaseCompat.apps.push(a);
      return a;
    };

    // `firebase.database()` compat function
    firebaseCompat.database = () => dbCompat;

    // `firebase.auth()` compat function (also attach Auth Persistence constant)
    function authFactory() { return makeAuthCompat(); }
    authFactory.Auth = { Persistence: { LOCAL: authModule.browserLocalPersistence } };
    firebaseCompat.auth = authFactory;

    // Expose modular instances as well for gradual migration
    window.firebase = firebaseCompat;
    window.db = dbCompat;         // compat-style DB wrapper used by existing code
    window.dbMod = dbMod;        // modular Database instance (for new code)
    window.authMod = authMod;    // modular Auth instance (for new code)

    console.log('firebase-config: modular Firebase initialized; compat wrappers exposed');
  } catch (err) {
    console.warn('firebase-config: Failed to load modular Firebase SDKs. Chat/DB features disabled.', err);
    window.firebase = window.firebase || { apps: [] };
    window.db = null;
    window.dbMod = null;
    window.authMod = null;
  }
})();
