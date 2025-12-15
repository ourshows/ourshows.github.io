window.PUBLIC_CONFIG = {
    PROJECT_ID: "ourshow-7d1b4",
    GROQ_API_KEY: null, // Key is now secure on the backend proxy
    // Base URL for your Backend Proxy (Render)
    // This is safe to share because the proxy hides the actual keys.
    // Cloudflare Worker URL (Fast & Secure)
    API_BASE_URL: "https://ourshow-proxy.ourshow.workers.dev",
    TMDB_BASE_URL: "https://api.themoviedb.org/3",
    TMDB_IMAGE_BASE_URL: "https://image.tmdb.org/t/p/original",
    TMDB_IMAGE_SMALL_URL: "https://image.tmdb.org/t/p/w500",
    TMDB_KEY: "798ae7de540b25e908c68ea2ca408347",
};

// Fallback for older scripts expecting APP_CONFIG
if (!window.APP_CONFIG) {
    window.APP_CONFIG = {
        TMDB_IMAGE_BASE_URL: "https://image.tmdb.org/t/p/original",
        TMDB_IMAGE_SMALL_URL: "https://image.tmdb.org/t/p/w500",
        TMDB_BASE_URL: "https://api.themoviedb.org/3",
        TMDB_API_KEY: null // Intentionally null to force proxy use in production
    };
}
