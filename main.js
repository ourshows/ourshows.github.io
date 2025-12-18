// Import Firebase modules
import { auth, db, onAuthStateChanged, collection, addDoc, serverTimestamp, doc, setDoc, getDocs, getDoc, deleteDoc, query, where, orderBy, limit } from './firebase-wrapper.js';

// Import custom lists
import { CUSTOM_LISTS, REGIONAL_CONFIG } from './custom_lists.js';

// Global state variables
let currentUser = null;
let currentMovieId = null;
let currentMovieData = null;
let userRating = null;

// Initialize auth state listener
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    console.log('Auth state changed:', user ? user.email : 'Not logged in');
    updateAuthUI(user);
});

function updateAuthUI(user) {
    // Update nav auth button
    const authBtn = document.getElementById('navAuthBtn');
    if (authBtn) {
        if (user) {
            authBtn.innerHTML = '<i class="fas fa-user"></i> ' + (user.displayName || user.email.split('@')[0]);
            authBtn.onclick = () => window.location.href = 'profile.html';
        } else {
            authBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
            authBtn.onclick = () => window.location.href = 'login.html';
        }
    }
}

// Expose functions to global scope for onclick handlers
window.closeModal = closeModal;
window.switchTab = switchTab;
window.rateMovie = rateMovie;
window.submitReview = submitReview;
window.markAsWatched = markAsWatched;
window.addToWatchLater = addToWatchLater;
window.watchNow = watchNow;
window.askAI = askAI;
window.openMovieModal = openMovieModal;
window.openAddToCollectionModal = openAddToCollectionModal;
window.closeAddToCollectionModal = closeAddToCollectionModal;
window.addToCollectionConfirm = addToCollectionConfirm;
window.toggleReview = toggleReview;

// Toggle review read more/less
function toggleReview(reviewId, fullContent, button) {
    const reviewElement = document.getElementById(reviewId);
    if (!reviewElement) return;

    if (button.textContent === 'Read More') {
        reviewElement.textContent = fullContent;
        button.textContent = 'Read Less';
    } else {
        const truncated = fullContent.substring(0, 200) + '...';
        reviewElement.textContent = truncated;
        button.textContent = 'Read More';
    }
}

// Initialize App
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Fix for homepage cache issue when navigating back
// Fix for homepage cache issue when navigating back
window.addEventListener('pageshow', async (event) => {
    if (event.persisted) {
        // Page was loaded from BFCache (back/forward cache) and is likely stale.
        console.log('Page restored from cache. Refreshing content...');

        // 1. Show Loading Screen immediately
        if (window.ourShowLoader) window.ourShowLoader.show();

        // 2. Reset Modals
        if (typeof closeModal === 'function') closeModal();
        if (typeof closeSearch === 'function') closeSearch();
        if (typeof closeAIModal === 'function') closeAIModal();
        if (typeof closeAddToCollectionModal === 'function') closeAddToCollectionModal();

        // 3. Refresh Content
        try {
            await refreshHomepageContent();
        } catch (e) {
            console.error("Failed to refresh content:", e);
        }

        // 4. Hide Loader
        if (window.ourShowLoader) {
            setTimeout(() => window.ourShowLoader.hide(), 500);
        }
    }
});

async function refreshHomepageContent() {
    // Only fetch if on homepage
    if (!document.getElementById('trendingScroller')) return;

    console.log('Refreshing homepage data...');

    // Parallel fetch for speed
    const loaders = [
        loadHeroContent(),
        loadTrending(),
        loadPopular(),
        loadTopRated(),
        loadUpcoming(),
        loadNowPlaying(),
        loadNepaliContent(),
        loadHindiContent(),
        loadNewToStream(),
        loadHighestGrossing(),
        loadCultClassics(),
        loadUnderratedGems(),
        loadActionThrillers(),
        loadDramaRomance()
    ];

    await Promise.allSettled(loaders);
    console.log('Homepage data refreshed.');
}

// --- API Helper ---
async function fetchTMDB(endpoint, params = {}) {
    // 1. Priority: Client-Side Direct Call (Public Config)
    if (window.PUBLIC_CONFIG && (window.PUBLIC_CONFIG.TMDB_KEY || window.PUBLIC_CONFIG.TMDB_API_KEY)) {
        const apiKey = window.PUBLIC_CONFIG.TMDB_KEY || window.PUBLIC_CONFIG.TMDB_API_KEY;
        const baseUrl = window.PUBLIC_CONFIG.TMDB_BASE_URL || "https://api.themoviedb.org/3";
        const url = new URL(`${baseUrl}${endpoint}`);
        url.searchParams.append('api_key', apiKey);
        url.searchParams.append('language', 'en-US');
        url.searchParams.append('include_adult', 'false');
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`TMDB API Error: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Direct TMDB Fetch Error:', error);
            return null;
        }
    }

    // 2. Fallback: Dev/Local Direct Call (App Config)
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal && window.APP_CONFIG && window.APP_CONFIG.TMDB_API_KEY) {
        const baseUrl = window.APP_CONFIG.TMDB_BASE_URL || "https://api.themoviedb.org/3";
        const url = new URL(`${baseUrl}${endpoint}`);
        url.searchParams.append('api_key', window.APP_CONFIG.TMDB_API_KEY);
        url.searchParams.append('language', 'en-US');
        url.searchParams.append('include_adult', 'false');
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

        try {
            const response = await fetch(url);
            if (response.ok) return await response.json();
        } catch (e) { console.error(e); }
    }

    // 3. Fallback: Proxy
    try {
        const url = new URL('/api/tmdb', window.location.origin);
        url.searchParams.append('endpoint', endpoint);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        const response = await fetch(url);
        return await response.json();
    } catch (e) { return null; }
}

async function renderCustomList(containerId, listConfig, mediaType) {
    if (!listConfig) return;

    // If listConfig is an array of IDs (manual curation)
    if (Array.isArray(listConfig)) {
        const promises = listConfig.map(id => fetchTMDB(`/${mediaType}/${id}`));
        const results = await Promise.all(promises);

        // Filter out nulls or errors
        const validItems = results.filter(item => item && item.id && item.poster_path);

        if (validItems.length > 0) {
            renderCards(validItems, containerId, mediaType);
        }
        return;
    }

    // If listConfig is a query object
    const data = await fetchTMDB('/discover/' + mediaType, listConfig);
    if (data) renderCards(data.results, containerId, mediaType);
}

async function initApp() {
    console.log('=== INIT APP STARTED ===');
    console.log('APP_CONFIG:', window.APP_CONFIG);

    // Default Configuration for Production (when config.js is missing/gitignored)
    if (!window.APP_CONFIG) {
        console.warn("Config not found, using default production configuration.");
        window.APP_CONFIG = {
            // These public URLs are safe to expose
            TMDB_IMAGE_BASE_URL: "https://image.tmdb.org/t/p/original",
            TMDB_IMAGE_SMALL_URL: "https://image.tmdb.org/t/p/w500",
            TMDB_BASE_URL: "https://api.themoviedb.org/3",
            // API Key for TMDB (Client-side safe)
            TMDB_API_KEY: "798ae7de540b25e908c68ea2ca408347"
        };

        // Also set PUBLIC_CONFIG so fetchTMDB works without isLocal check
        if (!window.PUBLIC_CONFIG) {
            window.PUBLIC_CONFIG = {
                TMDB_KEY: "798ae7de540b25e908c68ea2ca408347",
                TMDB_BASE_URL: "https://api.themoviedb.org/3"
            };
        }
    }

    // CRITICAL FIX: Ensure PUBLIC_CONFIG is set if APP_CONFIG exists (for Live deployment with config.js)
    if (!window.PUBLIC_CONFIG && window.APP_CONFIG && (window.APP_CONFIG.TMDB_API_KEY || window.APP_CONFIG.GROQ_API_KEY)) {
        window.PUBLIC_CONFIG = {
            TMDB_KEY: window.APP_CONFIG.TMDB_API_KEY,
            TMDB_BASE_URL: window.APP_CONFIG.TMDB_BASE_URL || "https://api.themoviedb.org/3",
            GROQ_API_KEY: window.APP_CONFIG.GROQ_API_KEY
        };
        console.log('Promoted APP_CONFIG to PUBLIC_CONFIG for Live execution.');
    }

    console.log('PUBLIC_CONFIG:', window.PUBLIC_CONFIG ? 'Loaded' : 'Not Loaded');
    console.log('TMDB_API_KEY:', window.APP_CONFIG.TMDB_API_KEY ? 'Present' : 'Missing');
    console.log('TMDB_BASE_URL:', window.APP_CONFIG.TMDB_BASE_URL);

    // Initialize theme system FIRST
    if (typeof window.initThemeVibe === 'function') {
        window.initThemeVibe();
    }
    if (typeof setupAppearanceUI === 'function') {
        setupAppearanceUI();
    }

    // Use global loader if available
    if (window.ourShowLoader) window.ourShowLoader.show();

    setupNavbar();
    setupSearch();

    // Check if we are on the homepage (or a page with content scrollers)
    if (!document.getElementById('trendingScroller')) {
        console.log('Not on homepage, skipping content load.');
        if (window.ourShowLoader) window.ourShowLoader.hide();
        return;
    }

    try {
        console.log('Loading hero content...');
        await loadHeroContent();

        console.log('Loading trending...');
        await loadTrending();

        console.log('Loading popular...');
        await loadPopular();

        console.log('Loading top rated...');
        await loadTopRated();

        console.log('Loading upcoming...');
        await loadUpcoming();

        console.log('Loading now playing...');
        await loadNowPlaying();

        console.log('Loading Nepali content...');
        await loadNepaliContent();

        console.log('Loading Hindi content...');
        await loadHindiContent();

        // New content rows
        console.log('Loading new to stream...');
        await loadNewToStream();

        console.log('Loading highest grossing...');
        await loadHighestGrossing();

        console.log('Loading cult classics...');
        await loadCultClassics();

        console.log('Loading underrated gems...');
        await loadUnderratedGems();

        console.log('Loading action thrillers...');
        await loadActionThrillers();

        console.log('Loading drama romance...');
        await loadDramaRomance();

        console.log('=== ALL CONTENT LOADED ===');
    } catch (error) {
        console.error("Error initializing app:", error);
        showError("Content Load Error", "Failed to load some content. Please check your internet connection or API configuration.");
    } finally {
        // Hide loader when done (success or fail)
        if (window.ourShowLoader) {
            setTimeout(() => window.ourShowLoader.hide(), 500); // Small buffer
        }
    }

    // Add "More >>" links to section headings
    addMoreLinks();
}

function showError(title, message) {
    const heroSection = document.querySelector('.hero-section');
    if (heroSection) {
        heroSection.innerHTML = `
            <div style="padding: 4rem; text-align: center; color: white;">
                <h1 style="color: #ef4444; margin-bottom: 1rem;">${title}</h1>
                <p style="font-size: 1.2rem;">${message}</p>
            </div>
        `;
    }
}

// Add "More >>" links to section headings
function addMoreLinks() {
    const sections = [
        { id: 'trendingScroller', category: 'trending', title: 'Trending Now' },
        { id: 'popularScroller', category: 'popular', title: 'Popular' },
        { id: 'topRatedScroller', category: 'top_rated', title: 'Top Rated' },
        { id: 'upcomingScroller', category: 'upcoming', title: 'Coming Soon' },
        { id: 'nowPlayingScroller', category: 'now_playing', title: 'Now in Theaters' },
        { id: 'nepaliScroller', category: 'nepali', title: 'Nepali Hits 🇳🇵' },
        { id: 'hindiScroller', category: 'hindi', title: 'Bollywood & Hindi 🇮🇳' },
        { id: 'newToStreamScroller', category: 'new_to_stream', title: 'New to Stream' },
        { id: 'highestGrossingScroller', category: 'highest_grossing', title: 'Highest Grossing (2020+)' },
        { id: 'cultClassicsScroller', category: 'cult_classics', title: 'Cult Classics' },
        { id: 'underratedGemsScroller', category: 'underrated_gems', title: 'Underrated Gems' },
        { id: 'actionThrillersScroller', category: 'action_thrillers', title: 'Action & Thrillers' },
        { id: 'dramaRomanceScroller', category: 'drama_romance', title: 'Drama & Romance' }
    ];

    sections.forEach(section => {
        const scroller = document.getElementById(section.id);
        if (scroller) {
            const sectionElement = scroller.closest('.content-section');
            const titleElement = sectionElement?.querySelector('.section-title');
            if (titleElement) {
                const moreLink = document.createElement('a');
                moreLink.href = `view_all.html?category=${section.category}`;
                moreLink.textContent = 'More >>';
                moreLink.style.cssText = 'margin-left: auto; font-size: 0.9rem; color: var(--primary-color); text-decoration: none; font-weight: 600;';
                titleElement.style.display = 'flex';
                titleElement.style.justifyContent = 'space-between';
                titleElement.appendChild(moreLink);
            }
        }
    });
}

// Switch Tabs in Modal
window.switchTab = function (tabName) {
    const tabs = ['overview', 'cast', 'reviews', 'similar', 'ai', 'seasons', 'franchise'];

    // Hide all tabs
    tabs.forEach(t => {
        const content = document.getElementById(`tab-${t}`);
        if (content) content.classList.remove('active');
    });

    // Remove active class from all buttons
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));

    // Show selected tab
    const selectedContent = document.getElementById(`tab-${tabName}`);
    if (selectedContent) selectedContent.classList.add('active');

    // Find and activate the corresponding button
    const activeBtn = document.querySelector(`button[onclick="switchTab('${tabName}')"]`);
    if (activeBtn) activeBtn.classList.add('active');
}

// --- UI Setup ---
function setupNavbar() {
    const navbar = document.getElementById('navbar');
    const mobileBtn = document.getElementById('mobileMenuBtn');
    const navRight = document.getElementById('navRight');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    if (mobileBtn && navRight) {
        mobileBtn.addEventListener('click', () => {
            navRight.classList.toggle('active');
            const icon = mobileBtn.querySelector('i');
            if (navRight.classList.contains('active')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });

        // Close menu when clicking a link
        navRight.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navRight.classList.remove('active');
                mobileBtn.querySelector('i').classList.remove('fa-times');
                mobileBtn.querySelector('i').classList.add('fa-bars');
            });
        });
    }
}

function setupSearch() {
    const input = document.getElementById('searchInput');
    const resultsContainer = document.getElementById('searchResults');

    // Return early if search elements don't exist on this page
    if (!input || !resultsContainer) {
        return;
    }

    let debounceTimer;

    input.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();

        if (query.length < 2) {
            resultsContainer.classList.remove('active');
            return;
        }

        debounceTimer = setTimeout(() => {
            performSearch(query);
        }, 500);
    });

    // Handle Enter Key
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = input.value.trim();
            if (query) {
                window.location.href = `search.html?q=${encodeURIComponent(query)}`;
            }
        }
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !resultsContainer.contains(e.target)) {
            resultsContainer.classList.remove('active');
        }
    });
}


async function loadHeroContent() {
    const data = await fetchTMDB('/trending/all/day');
    if (data && data.results && data.results.length > 0) {
        const randomHero = data.results[Math.floor(Math.random() * Math.min(5, data.results.length))];
        updateHeroUI(randomHero);
    } else {
        // Fallback or error state
        document.getElementById('heroTitle').textContent = 'Featured Content';
        document.getElementById('heroOverview').textContent = 'Unable to load today\'s trending picks. Please check your connection.';
    }
}

function updateHeroUI(item) {
    const bg = document.getElementById('heroBackground');
    const title = document.getElementById('heroTitle');
    const desc = document.getElementById('heroOverview');

    if (bg && item.backdrop_path) {
        bg.style.backgroundImage = `url(${window.APP_CONFIG.TMDB_IMAGE_BASE_URL}${item.backdrop_path})`;
    }
    if (title) {
        title.textContent = item.title || item.name;
    }
    if (desc) {
        desc.textContent = item.overview;
    }

    // Store current hero item for watch button
    window.currentHeroItem = item;
}

// Hero watch button handler
window.watchHeroMovie = function () {
    if (window.currentHeroItem) {
        const mediaType = window.currentHeroItem.media_type || 'movie';
        const movieId = window.currentHeroItem.id;
        window.location.href = `watchanddownload.html?id=${movieId}&type=${mediaType}`;
    }
};

// Trending Filter
window.filterTrending = async function (type) {
    // 1. Update UI Buttons
    const buttons = document.querySelectorAll('.filter-chip');
    buttons.forEach(btn => {
        // Simple text matching or check onclick attribute
        if (btn.onclick.toString().includes(`'${type}'`)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // 2. Fetch Content
    const scroller = document.getElementById('trendingScroller');
    if (scroller) scroller.innerHTML = '<div class="media-card skeleton"></div>'.repeat(5); // Show skeleton

    const endpoint = type === 'all' ? '/trending/all/week' : `/trending/${type}/week`;
    const data = await fetchTMDB(endpoint);

    // 3. Render
    // If 'all', we might have mixed types. 'movie' and 'tv' are explicit.
    if (data) renderCards(data.results, 'trendingScroller', type === 'tv' ? 'tv' : 'movie');
}

async function loadTrending() {
    // Default to 'all' on load
    await window.filterTrending('all');
}

async function loadPopular() {
    const data = await fetchTMDB('/movie/popular');
    if (data) renderCards(data.results, 'popularScroller', 'movie');
}

async function loadTopRated() {
    const data = await fetchTMDB('/movie/top_rated');
    if (data) renderCards(data.results, 'topRatedScroller', 'movie');
}

async function loadUpcoming() {
    const data = await fetchTMDB('/movie/upcoming');
    if (data) renderCards(data.results, 'upcomingScroller', 'movie');
}

async function loadNowPlaying() {
    const data = await fetchTMDB('/movie/now_playing');
    if (data) renderCards(data.results, 'nowPlayingScroller', 'movie');
}

async function loadNepaliContent() {
    // Discover Nepali movies
    const data = await fetchTMDB('/discover/movie', {
        with_original_language: 'ne',
        sort_by: 'popularity.desc'
    });
    if (data) renderCards(data.results, 'nepaliScroller', 'movie');
}

async function loadHindiContent() {
    // Discover Hindi movies
    const data = await fetchTMDB('/discover/movie', {
        with_original_language: 'hi',
        sort_by: 'popularity.desc',
        region: 'IN'
    });
    if (data) renderCards(data.results, 'hindiScroller', 'movie');
}

async function loadNewToStream() {
    // Get recently added content (last 3 months)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const dateString = threeMonthsAgo.toISOString().split('T')[0];

    const data = await fetchTMDB('/discover/movie', {
        'primary_release_date.gte': dateString,
        sort_by: 'popularity.desc'
    });

    if (data) renderCards(data.results, 'newToStreamScroller', 'movie');
}

async function loadHighestGrossing() {
    const data = await fetchTMDB('/discover/movie', {
        'primary_release_date.gte': '2020-01-01',
        sort_by: 'revenue.desc'
    });

    if (data) renderCards(data.results, 'highestGrossingScroller', 'movie');
}

async function loadCultClassics() {
    await renderCustomList('cultClassicsScroller', CUSTOM_LISTS.cultClassics, 'movie');
}

async function loadUnderratedGems() {
    await renderCustomList('underratedGemsScroller', CUSTOM_LISTS.underratedGems, 'movie');
}

async function loadActionThrillers() {
    await renderCustomList('actionThrillersScroller', CUSTOM_LISTS.actionThrillers, 'movie');
}

async function loadDramaRomance() {
    await renderCustomList('dramaRomanceScroller', CUSTOM_LISTS.dramaRomance, 'movie');
}

async function performSearch(query) {
    const data = await fetchTMDB('/search/multi', { query: query });
    const resultsContainer = document.getElementById('searchResults');
    resultsContainer.innerHTML = '';

    if (data && data.results.length > 0) {
        resultsContainer.classList.add('active');

        // Take top 6 results
        const items = data.results.slice(0, 6);

        items.forEach(item => {
            if (!item.poster_path && !item.profile_path) return;

            const div = document.createElement('div');
            div.className = 'suggestion-item'; // Use new class

            // Highlight matching text logic
            const title = item.title || item.name;
            const regex = new RegExp(`(${query})`, 'gi');
            const highlightedTitle = title.replace(regex, '<b>$1</b>');

            const year = (item.release_date || item.first_air_date || 'TBA').split('-')[0];
            const type = item.media_type === 'tv' ? 'TV Series' : 'Movie';
            const icon = type === 'Movie' ? 'fa-film' : 'fa-tv';

            div.innerHTML = `
                <img class="suggestion-poster" 
                     src="${window.APP_CONFIG.TMDB_IMAGE_SMALL_URL}${item.poster_path || item.profile_path}" 
                     alt="${title}">
                <div class="suggestion-info">
                    <div class="suggestion-title">${highlightedTitle}</div>
                    <div class="suggestion-meta">
                        <span>${year}</span>
                        <i class="fas fa-circle" style="font-size: 4px; margin: 0 4px;"></i>
                        <i class="fas ${icon}"></i>
                        <span>${type}</span>
                    </div>
                </div>
                <i class="fas fa-chevron-right" style="color: var(--text-secondary); opacity: 0.5;"></i>
            `;

            div.onclick = () => {
                openMovieModal(item.id, item.media_type);
                resultsContainer.classList.remove('active');
                document.getElementById('searchInput').value = ''; // Clear input
            };
            resultsContainer.appendChild(div);
        });

        // "See all" link if too many results
        if (data.results.length > 6) {
            const seeAll = document.createElement('div');
            seeAll.className = 'suggestion-item';
            seeAll.style.justifyContent = 'center';
            seeAll.style.color = 'var(--primary-color)';
            seeAll.style.fontWeight = '600';
            seeAll.innerHTML = `See all results for "${query}"`;
            seeAll.onclick = () => window.location.href = `search.html?q=${encodeURIComponent(query)}`;
            resultsContainer.appendChild(seeAll);
        }

    } else {
        resultsContainer.classList.remove('active');
    }
}

// --- Rendering ---
function renderCards(items, containerId, defaultType) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    items.forEach(item => {
        if (!item.poster_path) return;

        const card = document.createElement('div');
        card.className = 'media-card';

        // Calculate verdict for poster
        const verdict = calculateVerdict(item);

        const year = (item.release_date || item.first_air_date || '').split('-')[0];
        const title = item.title || item.name;
        const mediaType = item.media_type || defaultType;

        card.innerHTML = `
            <div class="media-poster-container">
                <img class="media-poster" src="${window.APP_CONFIG.TMDB_IMAGE_SMALL_URL}${item.poster_path}" loading="lazy" alt="${title}">
                <div class="card-rating-badge" style="color: ${getVerdictColor(verdict.text)};">${verdict.text}</div>
                <div class="card-overlay">
                    <button class="card-download-btn" onclick="event.stopPropagation(); window.location.href='watchanddownload.html?id=${item.id}&type=${mediaType}'">
                        <i class="fas fa-download"></i> Watch
                    </button>
                    <button class="card-download-btn" style="margin-top: 0.5rem;" onclick="event.stopPropagation(); openMovieModal('${item.id}', '${mediaType}')">
                        <i class="fas fa-info-circle"></i> Components
                    </button>
                </div>
            </div>
            <div class="media-info">
                <div class="media-title" title="${title}">${title}</div>
                <div class="media-year">(${year})</div>
            </div>
        `;

        card.onclick = () => openMovieModal(item.id, mediaType);
        container.appendChild(card);
    });
}

// --- Movie Modal ---
async function openMovieModal(id, type = 'movie') {
    currentMovieId = id;
    const modal = document.getElementById('movieModal');
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';

    // Fetch movie details
    const details = await fetchTMDB(`/${type}/${id}`, { append_to_response: 'videos,credits,reviews,similar' });
    if (!details) return;

    currentMovieData = details;
    currentMovieData.media_type = type; // Ensure media type is set

    // Update modal header
    document.getElementById('modalPoster').src = `${window.APP_CONFIG.TMDB_IMAGE_SMALL_URL}${details.poster_path}`;
    document.getElementById('modalTitle').textContent = details.title || details.name;
    document.getElementById('modalRating').textContent = details.vote_average ? details.vote_average.toFixed(1) : 'N/A';
    document.getElementById('modalYear').textContent = (details.release_date || details.first_air_date || '').split('-')[0];
    document.getElementById('modalRuntime').textContent = details.runtime ? `${details.runtime} min` : '';
    document.getElementById('modalOverview').textContent = details.overview;

    // Load trailer
    loadTrailer(details.videos);

    // Load genres
    loadGenres(details.genres);

    // Reset and Hide new tabs
    document.getElementById('tabBtnSeasons').style.display = 'none';
    document.getElementById('tabBtnFranchise').style.display = 'none';
    document.getElementById('modalSeasons').innerHTML = '';
    document.getElementById('modalFranchise').innerHTML = '';

    // Handle Seasons (TV)
    if (type === 'tv' && details.seasons) {
        document.getElementById('tabBtnSeasons').style.display = 'block';
        const seasonContent = details.seasons.filter(s => s.season_number > 0).map(s => `
            <div class="season-card glass-panel" style="display: flex; gap: 1rem; padding: 1rem;">
                <img src="${s.poster_path ? 'https://image.tmdb.org/t/p/w200' + s.poster_path : 'https://via.placeholder.com/100x150'}" 
                     style="width: 100px; height: 150px; object-fit: cover; border-radius: 8px;">
                <div class="season-info">
                    <h3>${s.name}</h3>
                    <p>${s.air_date ? s.air_date.substring(0, 4) : 'TBA'} | ${s.episode_count} Episodes</p>
                    <p style="font-size: 0.9rem; color: #ccc; margin-top: 0.5rem;">${s.overview || 'No overview available.'}</p>
                </div>
            </div>
        `).join('');
        document.getElementById('modalSeasons').innerHTML = seasonContent;
    }

    // Handle Franchise (Movies)
    if (type === 'movie' && details.belongs_to_collection) {
        try {
            const collectionId = details.belongs_to_collection.id;
            const collectionData = await fetchTMDB(`/collection/${collectionId}`);
            if (collectionData && collectionData.parts && collectionData.parts.length > 0) {
                document.getElementById('tabBtnFranchise').style.display = 'block';
                // Sort parts by release date
                const sortedParts = collectionData.parts.sort((a, b) => new Date(a.release_date) - new Date(b.release_date));

                const franchiseContent = sortedParts.map(movie => `
                    <div class="movie-card" onclick="openMovieModal(${movie.id}, 'movie')" style="cursor: pointer; position: relative;">
                         <img src="${movie.poster_path ? 'https://image.tmdb.org/t/p/w200' + movie.poster_path : 'https://via.placeholder.com/150x225'}" 
                              alt="${movie.title}" 
                              style="width: 100%; border-radius: 8px; transition: transform 0.3s;">
                         <div style="margin-top: 5px; font-size: 0.9rem;">${movie.title} (${movie.release_date ? movie.release_date.split('-')[0] : 'TBA'})</div>
                         ${movie.id === id ? '<span style="position: absolute; top: 10px; right: 10px; background: var(--primary-color); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem;">Current</span>' : ''}
                    </div>
                 `).join('');
                document.getElementById('modalFranchise').innerHTML = franchiseContent;
            }
        } catch (e) { console.error("Error fetching collection:", e); }
    }

    // Load cast
    loadCast(details.credits);

    // Load reviews (Now async and needs ID)
    await loadReviews(details.reviews, id);

    // Load similar
    loadSimilar(details.similar);

    // INJECT VERDICT BADGE
    const verdict = calculateVerdict(details);

    // Update Badge (Keep the header badge for quick reference)
    const ratingEl = document.getElementById('modalRating');
    const existingBadge = ratingEl.parentNode.querySelector('.verdict-badge');
    if (existingBadge) existingBadge.remove();
    const badge = document.createElement('span');
    badge.className = `verdict-badge ${verdict.class}`;
    badge.textContent = verdict.text;
    ratingEl.parentNode.appendChild(badge);

    // Render Gauge Meter (Text Only now)
    renderVerdictMeter(details, verdict);
}

function renderVerdictMeter(details, verdict) {
    const containers = [
        document.getElementById('pcVerdictMeter'),
        document.getElementById('mobileVerdictMeter')
    ];

    const rating = details.vote_average || 0;

    // TEXT ONLY - No Gauge
    const html = `
        <div class="verdict-label" style="color: ${getVerdictColor(verdict.text)}">${verdict.text}</div>
        <div class="verdict-subtext">${rating.toFixed(1)}/10 based on TMDB</div>
    `;

    containers.forEach(container => {
        if (container) container.innerHTML = html;
    });
}

function getVerdictColor(text) {
    if (text === 'Perfection') return '#ffd700';
    if (text === 'Go for it') return '#22c55e';
    if (text === 'One time watch') return '#f59e0b';
    return '#ef4444'; // Skip
}

function calculateVerdict(details) {
    const rating = details.vote_average || 0;
    const votes = details.vote_count || 0;
    const popularity = details.popularity || 0;

    // "Perfection": High rating + High engagement (avoid niche obscure formatting)
    if (rating >= 8.0 && (votes >= 500 || popularity >= 100)) {
        return { text: "Perfection", class: "verdict-perfection" };
    }
    // "Go for it": Good rating
    if (rating >= 6.8) {
        return { text: "Go for it", class: "verdict-go" };
    }
    // "One time watch": Average
    if (rating >= 5.0) {
        return { text: "One time watch", class: "verdict-once" };
    }
    // "Skip": Low rating
    return { text: "Skip", class: "verdict-skip" };
}

function closeModal() {
    document.getElementById('movieModal').style.display = 'none';
    document.body.style.overflow = 'auto';
    currentMovieId = null;
    currentMovieData = null;
}

function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    // Show selected tab
    document.getElementById(`tab-${tabName}`).style.display = 'block';

    // Find and activate the corresponding button
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => {
        if (btn.textContent.toLowerCase().includes(tabName.toLowerCase()) ||
            (tabName === 'overview' && btn.textContent === 'Overview') ||
            (tabName === 'cast' && btn.textContent === 'Cast & Crew') ||
            (tabName === 'reviews' && btn.textContent === 'Reviews') ||
            (tabName === 'similar' && btn.textContent === 'Similar') ||
            (tabName === 'ai' && btn.textContent === 'Ask AI')) {
            btn.classList.add('active');
        }
    });
}

function loadTrailer(videos) {
    const trailerContainer = document.getElementById('modalTrailer');
    if (!videos || !videos.results || videos.results.length === 0) {
        trailerContainer.innerHTML = '';
        return;
    }

    const trailer = videos.results.find(v => v.type === 'Trailer' && v.site === 'YouTube') || videos.results[0];
    if (trailer) {
        trailerContainer.innerHTML = `
            <div style="margin-bottom: 2rem;">
                <h3>Trailer</h3>
                <iframe width="100%" height="400" src="https://www.youtube.com/embed/${trailer.key}" 
                    frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen style="border-radius: 12px; margin-top: 1rem;"></iframe>
            </div>
        `;
    }
}

function loadGenres(genres) {
    const genresContainer = document.getElementById('modalGenres');
    if (!genres || genres.length === 0) {
        genresContainer.innerHTML = '';
        return;
    }
    genresContainer.innerHTML = `
        <div style="margin-bottom: 1.5rem;">
            <strong>Genres:</strong> ${genres.map(g => g.name).join(', ')}
        </div>
    `;
}

function loadCast(credits) {
    const castContainer = document.getElementById('modalCast');
    if (!credits || !credits.cast || credits.cast.length === 0) {
        castContainer.innerHTML = '<p>No cast information available.</p>';
        return;
    }
    castContainer.innerHTML = credits.cast.slice(0, 12).map(person => `
        <div class="cast-card">
            <img src="${person.profile_path ? window.APP_CONFIG.TMDB_IMAGE_SMALL_URL + person.profile_path : 'https://via.placeholder.com/150x225?text=No+Image'}" 
                alt="${person.name}">
            <div style="font-weight: 600; font-size: 0.9rem;">${person.name}</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">${person.character}</div>
        </div>
    `).join('');
}


// Reviews
async function loadReviews(tmdbReviews, movieId) {
    const reviewsContainer = document.getElementById('modalReviews');
    reviewsContainer.innerHTML = '<p style="text-align:center;">Loading reviews...</p>';

    let firebaseReviews = [];
    try {
        if (movieId) {
            const q = query(
                collection(db, 'reviews'),
                where('movieId', '==', String(movieId)),
                orderBy('timestamp', 'desc')
            );
            const snapshot = await getDocs(q);
            firebaseReviews = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                source: 'ourshow'
            }));
        }
    } catch (e) {
        console.error("Error fetching firebase reviews:", e);
    }

    const tmdbResults = (tmdbReviews && tmdbReviews.results) ? tmdbReviews.results.map(r => ({
        id: r.id,
        author: r.author,
        content: r.content,
        rating: r.author_details.rating,
        avatar_path: r.author_details.avatar_path,
        source: 'tmdb',
        timestamp: new Date(r.created_at || 0)
    })) : [];

    const combined = [...firebaseReviews, ...tmdbResults];

    if (combined.length === 0) {
        reviewsContainer.innerHTML = '<p>No reviews yet. Be the first to review!</p>';
        return;
    }

    reviewsContainer.innerHTML = combined.slice(0, 10).map(review => {
        const author = review.source === 'ourshow' ? review.username : review.author;
        const rating = review.source === 'ourshow' ? review.rating : review.rating;
        const content = review.source === 'ourshow' ? review.review : review.content;

        let verdictHTML = '';
        if (rating) {
            let v = { text: 'N/A', class: '' };
            if (typeof rating === 'string') {
                if (rating === 'Perfection') v = { text: 'Perfection', class: 'verdict-perfection' };
                else if (rating === 'Go For It' || rating === 'Go for it') v = { text: 'Go for it', class: 'verdict-go' };
                else if (rating === 'One Time Watch' || rating === 'One time watch') v = { text: 'One time watch', class: 'verdict-once' };
                else if (rating === 'Pass' || rating === 'Skip') v = { text: 'Skip', class: 'verdict-skip' };
                else {
                    v = getVerdictFromRating(rating);
                }
            } else {
                v = getVerdictFromRating(rating);
            }
            if (v.text !== 'N/A') {
                verdictHTML = `<span class="review-verdict-badge ${v.class}" style="font-size: 0.7rem; padding: 2px 6px;">${v.text}</span>`;
            }
        }

        let avatarUrl = 'https://secure.gravatar.com/avatar/ad516503a11cd5ca435acc9bb6523536?s=128';
        if (review.source === 'tmdb' && review.avatar_path) {
            if (review.avatar_path.startsWith('/https')) avatarUrl = review.avatar_path.substring(1);
            else avatarUrl = `${window.APP_CONFIG.TMDB_IMAGE_SMALL_URL}${review.avatar_path}`;
        }

        const maxLength = 200;
        const isLong = content.length > maxLength;
        const truncatedContent = isLong ? content.substring(0, maxLength) + '...' : content;
        const reviewId = `review-${review.id || Math.random().toString(36).substr(2, 9)}`;

        return `
            <div class="review-card" style="${review.source === 'ourshow' ? 'border-left: 3px solid var(--primary-color);' : ''}">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <strong style="display:flex; gap:0.5rem; align-items:center;">
                        <img class="review-avatar" src="${avatarUrl}" alt="${author}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;"> ${author}
                    </strong>
                    ${verdictHTML}
                </div>
                <p style="color: var(--text-secondary); line-height: 1.6;" id="${reviewId}">
                    ${truncatedContent}
                </p>
                ${isLong ? `<button class="read-more-btn" onclick="toggleReview('${reviewId}', \`${content.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`, this)">Read More</button>` : ''}
            </div>
        `;
    }).join('');
}


function loadSimilar(similar) {
    const similarContainer = document.getElementById('modalSimilar');
    if (!similar || !similar.results || similar.results.length === 0) {
        similarContainer.innerHTML = '<p>No similar titles found.</p>';
        return;
    }

    similarContainer.innerHTML = '';
    const scroller = document.createElement('div');
    scroller.className = 'media-scroller';

    similar.results.slice(0, 10).forEach(item => {
        if (!item.poster_path) return;
        const card = document.createElement('div');
        card.className = 'media-card';
        card.innerHTML = `
            <div class="media-poster-container">
            <img class="media-poster" src="${window.APP_CONFIG.TMDB_IMAGE_SMALL_URL}${item.poster_path}" loading="lazy" alt="${item.title || item.name}">
            </div>
            <div class="media-info">
                <div class="media-title">${item.title || item.name}</div>
                <div class="media-year">${(item.release_date || item.first_air_date || '').split('-')[0]}</div>
            </div>
        `;
        card.onclick = () => openMovieModal(item.id, item.media_type || 'movie');
        scroller.appendChild(card);
    });
    similarContainer.appendChild(scroller);
}

function rateMovie(rating) {
    userRating = rating;
    document.querySelectorAll('.rating-btn').forEach(btn => btn.classList.remove('selected'));
    document.querySelector(`.rating-btn[data-rating="${rating}"]`).classList.add('selected');
}

async function submitReview() {
    const reviewText = document.getElementById('reviewText').value;
    if (!userRating) {
        alert('Please select a rating first!');
        return;
    }
    if (!reviewText.trim()) {
        alert('Please write a review!');
        return;
    }
    if (!currentUser) {
        alert('Please log in to submit a review!');
        window.location.href = 'login.html';
        return;
    }
    try {
        await addDoc(collection(db, 'reviews'), {
            userId: currentUser.uid,
            username: currentUser.displayName || currentUser.email,
            movieId: currentMovieId,
            movieTitle: currentMovieData.title || currentMovieData.name,
            rating: userRating,
            review: reviewText.trim(),
            timestamp: serverTimestamp()
        });
        alert('Review submitted successfully!');
        document.getElementById('reviewText').value = '';
        userRating = null;
        document.querySelectorAll('.rating-btn').forEach(btn => btn.classList.remove('selected'));

        // Reload reviews
        loadReviews(currentMovieData.reviews, currentMovieId);
    } catch (error) {
        console.error('Error submitting review:', error);
        alert('Failed to submit review. Please try again.');
    }
}

async function markAsWatched() {
    if (!currentUser) {
        alert('Please log in to mark as watched!');
        window.location.href = 'login.html';
        return;
    }
    try {
        await setDoc(doc(db, 'users', currentUser.uid, 'watched', String(currentMovieId)), {
            movieId: currentMovieId,
            movieTitle: currentMovieData.title || currentMovieData.name,
            posterPath: currentMovieData.poster_path,
            rating: currentMovieData.vote_average,
            mediaType: currentMovieData.media_type || 'movie',
            timestamp: serverTimestamp()
        });
        alert('Added to watched list!');
    } catch (error) {
        console.error('Error marking as watched:', error);
        alert('Failed to add to watched list. Please try again.');
    }
}

async function addToWatchLater() {
    if (!currentUser) {
        alert('Please log in to add to watch later!');
        window.location.href = 'login.html';
        return;
    }
    try {
        await setDoc(doc(db, 'users', currentUser.uid, 'watchlist', String(currentMovieId)), {
            movieId: currentMovieId,
            movieTitle: currentMovieData.title || currentMovieData.name,
            posterPath: currentMovieData.poster_path,
            rating: currentMovieData.vote_average,
            mediaType: currentMovieData.media_type || 'movie',
            timestamp: serverTimestamp()
        });
        alert('Added to watch later!');
    } catch (error) {
        console.error('Error adding to watch later:', error);
        alert('Failed to add to watch later. Please try again.');
    }
}

// Collections Integration
function openAddToCollectionModal() {
    if (!currentUser) {
        alert('Please log in to add to a collection.');
        return;
    }
    document.getElementById('addToCollectionModal').style.display = 'block';

    // Check if we have the loadUserCollections function available (from profile-logic.js usually, but here we might need a simpler fetch)
    // For now, assume simpler functionality or just prompt.
    // Ideally we duplicate collection logic or import it.
    // Simplification for now: Use the existing collections if loaded or just simple prompt.
}

function closeAddToCollectionModal() {
    const modal = document.getElementById('addToCollectionModal');
    if (modal) modal.style.display = 'none';
}

async function addToCollectionConfirm() {
    // Placeholder - in real app this connects to collection system
    alert("Collection feature integration pending.");
    closeAddToCollectionModal();
}

function watchNow() {
    alert('Starting playback... (Demo)');
}

function askAI() {
    const question = document.getElementById('aiQuestion').value;
    if (!question) return;

    const chatContainer = document.getElementById('aiChat');
    chatContainer.innerHTML += `<div style="margin-bottom: 0.5rem;"><strong>You:</strong> ${question}</div>`;
    chatContainer.innerHTML += `<div style="margin-bottom: 0.5rem; color: var(--accent-color);"><strong>AI:</strong> That's a great question about ${currentMovieData.title || currentMovieData.name}! (AI integration coming soon)</div>`;
    document.getElementById('aiQuestion').value = '';
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function getVerdictFromRating(rating) {
    const numRating = parseFloat(rating);
    if (isNaN(numRating)) return { text: 'N/A', class: '' };
    if (numRating >= 8.0) return { text: 'Perfection', class: 'verdict-perfection' };
    if (numRating >= 6.8) return { text: 'Go for it', class: 'verdict-go' };
    if (numRating >= 5.0) return { text: 'One time watch', class: 'verdict-once' };
    return { text: 'Skip', class: 'verdict-skip' };
}
