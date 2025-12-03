// EXAMPLE CONFIG FILE
// Copy this to config.js and add your actual API keys
// NEVER commit config.js to GitHub!

const CONFIG = {
    TMDB_API_KEY: "YOUR_TMDB_API_KEY_HERE",
    TMDB_READ_ACCESS_TOKEN: "YOUR_TMDB_READ_ACCESS_TOKEN_HERE",
    GEMINI_API_KEY: "YOUR_GEMINI_API_KEY_HERE",
    TMDB_BASE_URL: "https://api.themoviedb.org/3",
    TMDB_IMAGE_BASE_URL: "https://image.tmdb.org/t/p/original",
    TMDB_IMAGE_SMALL_URL: "https://image.tmdb.org/t/p/w500",

    FIREBASE_CONFIG: {
        apiKey: "YOUR_FIREBASE_API_KEY",
        authDomain: "YOUR_PROJECT.firebaseapp.com",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_PROJECT.firebasestorage.app",
        messagingSenderId: "YOUR_SENDER_ID",
        appId: "YOUR_APP_ID"
    }
};

// Export for module usage if needed, or attach to window
window.APP_CONFIG = CONFIG;
