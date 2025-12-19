// Cache Manager for TMDB API responses
// Reduces API calls and improves load times

const CACHE_VERSION = '1.0';
const CACHE_PREFIX = 'ourshow_cache_';
const CACHE_DURATION = {
    movieDetails: 24 * 60 * 60 * 1000, // 24 hours
    trending: 6 * 60 * 60 * 1000,       // 6 hours
    search: 1 * 60 * 60 * 1000,         // 1 hour
    default: 12 * 60 * 60 * 1000        // 12 hours
};

class CacheManager {
    constructor() {
        this.enabled = this.checkLocalStorage();
        if (this.enabled) {
            this.cleanExpired();
        }
    }

    checkLocalStorage() {
        try {
            const test = '__cache_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            console.warn('localStorage not available, caching disabled');
            return false;
        }
    }

    getCacheKey(endpoint, params) {
        const paramString = params ? JSON.stringify(params) : '';
        return `${CACHE_PREFIX}${endpoint}_${paramString}`;
    }

    getCacheDuration(endpoint) {
        if (endpoint.includes('/movie/') || endpoint.includes('/tv/')) {
            return CACHE_DURATION.movieDetails;
        }
        if (endpoint.includes('trending')) {
            return CACHE_DURATION.trending;
        }
        if (endpoint.includes('search')) {
            return CACHE_DURATION.search;
        }
        return CACHE_DURATION.default;
    }

    get(endpoint, params = {}) {
        if (!this.enabled) return null;

        try {
            const key = this.getCacheKey(endpoint, params);
            const cached = localStorage.getItem(key);

            if (!cached) return null;

            const data = JSON.parse(cached);
            const now = Date.now();

            // Check if expired
            if (now > data.expiry) {
                localStorage.removeItem(key);
                return null;
            }

            console.log(`[Cache HIT] ${endpoint}`);
            return data.value;
        } catch (e) {
            console.error('Cache read error:', e);
            return null;
        }
    }

    set(endpoint, params = {}, value) {
        if (!this.enabled) return false;

        try {
            const key = this.getCacheKey(endpoint, params);
            const duration = this.getCacheDuration(endpoint);
            const expiry = Date.now() + duration;

            const cacheData = {
                value,
                expiry,
                version: CACHE_VERSION,
                timestamp: Date.now()
            };

            localStorage.setItem(key, JSON.stringify(cacheData));
            console.log(`[Cache SET] ${endpoint} (expires in ${Math.round(duration / 1000 / 60)}min)`);
            return true;
        } catch (e) {
            // Quota exceeded - clear old cache
            if (e.name === 'QuotaExceededError') {
                console.warn('Cache quota exceeded, clearing old entries');
                this.clearOldest(10);
                // Try again
                try {
                    const key = this.getCacheKey(endpoint, params);
                    const duration = this.getCacheDuration(endpoint);
                    const cacheData = {
                        value,
                        expiry: Date.now() + duration,
                        version: CACHE_VERSION,
                        timestamp: Date.now()
                    };
                    localStorage.setItem(key, JSON.stringify(cacheData));
                    return true;
                } catch (e2) {
                    console.error('Cache write failed after cleanup:', e2);
                    return false;
                }
            }
            console.error('Cache write error:', e);
            return false;
        }
    }

    cleanExpired() {
        if (!this.enabled) return;

        try {
            const now = Date.now();
            const keys = Object.keys(localStorage);
            let cleaned = 0;

            keys.forEach(key => {
                if (key.startsWith(CACHE_PREFIX)) {
                    try {
                        const data = JSON.parse(localStorage.getItem(key));
                        if (now > data.expiry || data.version !== CACHE_VERSION) {
                            localStorage.removeItem(key);
                            cleaned++;
                        }
                    } catch (e) {
                        // Invalid cache entry, remove it
                        localStorage.removeItem(key);
                        cleaned++;
                    }
                }
            });

            if (cleaned > 0) {
                console.log(`[Cache] Cleaned ${cleaned} expired entries`);
            }
        } catch (e) {
            console.error('Cache cleanup error:', e);
        }
    }

    clearOldest(count = 10) {
        if (!this.enabled) return;

        try {
            const keys = Object.keys(localStorage);
            const cacheEntries = [];

            keys.forEach(key => {
                if (key.startsWith(CACHE_PREFIX)) {
                    try {
                        const data = JSON.parse(localStorage.getItem(key));
                        cacheEntries.push({ key, timestamp: data.timestamp || 0 });
                    } catch (e) {
                        // Invalid entry
                        cacheEntries.push({ key, timestamp: 0 });
                    }
                }
            });

            // Sort by timestamp (oldest first)
            cacheEntries.sort((a, b) => a.timestamp - b.timestamp);

            // Remove oldest entries
            const toRemove = cacheEntries.slice(0, count);
            toRemove.forEach(entry => {
                localStorage.removeItem(entry.key);
            });

            console.log(`[Cache] Removed ${toRemove.length} oldest entries`);
        } catch (e) {
            console.error('Clear oldest error:', e);
        }
    }

    clear() {
        if (!this.enabled) return;

        try {
            const keys = Object.keys(localStorage);
            let cleared = 0;

            keys.forEach(key => {
                if (key.startsWith(CACHE_PREFIX)) {
                    localStorage.removeItem(key);
                    cleared++;
                }
            });

            console.log(`[Cache] Cleared ${cleared} entries`);
            return cleared;
        } catch (e) {
            console.error('Cache clear error:', e);
            return 0;
        }
    }

    getStats() {
        if (!this.enabled) return { enabled: false };

        try {
            const keys = Object.keys(localStorage);
            const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
            let totalSize = 0;

            cacheKeys.forEach(key => {
                const value = localStorage.getItem(key);
                totalSize += value ? value.length : 0;
            });

            return {
                enabled: true,
                entries: cacheKeys.length,
                sizeKB: Math.round(totalSize / 1024),
                version: CACHE_VERSION
            };
        } catch (e) {
            return { enabled: true, error: e.message };
        }
    }
}

// Create global instance
window.cacheManager = new CacheManager();

// Expose clear function for debugging
window.clearCache = () => {
    const cleared = window.cacheManager.clear();
    alert(`Cache cleared! Removed ${cleared} entries.`);
};

// Log cache stats on load
console.log('[Cache Stats]', window.cacheManager.getStats());
