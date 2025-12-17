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

// Initialize App
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// --- API Helper ---
async function fetchTMDB(endpoint, params = {}) {
    // 1. Priority: Client-Side Direct Call (Public Config)
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

    // Highlight selected button
    // Note: This assumes the button onclick passes the tabName explicitly. 
    // We can find the button by its onclick attribute or ID if we assigned one consistently.
    // For now, let's try to match by text or onclick.
    // Simpler: Just rely on the user clicking the button to handle the visual state? 
    // No, we need to update the button state programmatically.
    // Let's find button by onclick="switchTab('tabName')"
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

async function loadTrending() {
    const data = await fetchTMDB('/trending/movie/week');
    if (data) renderCards(data.results, 'trendingScroller', 'movie');
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

// --- HYBRID RENDERING SYSTEM ---
// Fetches and mixes regional content (Nepali/Hindi) with global content

/**
 * Renders a content row with regional integration
 * @param {string} containerId - DOM element ID for the scroller
 * @param {string} endpoint - TMDB API endpoint (e.g., '/movie/popular')
 * @param {string} mediaType - 'movie' or 'tv'
 * @param {boolean} includeRegional - Whether to inject Nepali/Hindi content
 */
async function renderHybridContentRow(containerId, endpoint, mediaType = 'movie', includeRegional = true) {
    // Fetch global content
    const globalData = await fetchTMDB(endpoint);
    if (!globalData || !globalData.results) return;

    let finalResults = [...globalData.results];

    if (includeRegional) {
        // Fetch Nepali content
        const nepaliData = await fetchTMDB('/discover/movie', {
            with_original_language: REGIONAL_CONFIG.languages.nepali,
            sort_by: 'popularity.desc'
        });

        // Fetch Hindi content
        const hindiData = await fetchTMDB('/discover/movie', {
            with_original_language: REGIONAL_CONFIG.languages.hindi,
            sort_by: 'popularity.desc',
            region: 'IN'
        });

        // Mix regional content into the results
        const regionalItems = [];
        if (nepaliData?.results) regionalItems.push(...nepaliData.results.slice(0, 3));
        if (hindiData?.results) regionalItems.push(...hindiData.results.slice(0, 3));

        // Inject regional content at strategic positions (positions 2, 5, 8, 11, 14)
        const injectionPositions = [2, 5, 8, 11, 14];
        regionalItems.forEach((item, index) => {
            if (index < injectionPositions.length) {
                finalResults.splice(injectionPositions[index], 0, item);
            }
        });
    }

    renderCards(finalResults.slice(0, 20), containerId, mediaType);
}


/**
 * Load new content rows
 */
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

        const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
        const year = (item.release_date || item.first_air_date || '').split('-')[0];
        const title = item.title || item.name;
        const mediaType = item.media_type || defaultType;

        card.innerHTML = `
            <div class="media-poster-container">
                <img class="media-poster" src="${window.APP_CONFIG.TMDB_IMAGE_SMALL_URL}${item.poster_path}" loading="lazy" alt="${title}">
                <div class="card-rating-badge">★ ${rating}</div>
                <div class="card-overlay">
                    <button class="card-download-btn" onclick="event.stopPropagation(); window.location.href='watchanddownload.html?id=${item.id}&type=${mediaType}'">
                        <i class="fas fa-download"></i> Watch
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

    // Load reviews
    loadReviews(details.reviews);

    // Load similar
    loadSimilar(details.similar);
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

function loadReviews(reviews) {
    const reviewsContainer = document.getElementById('modalReviews');
    if (!reviews || !reviews.results || reviews.results.length === 0) {
        reviewsContainer.innerHTML = '<p>No reviews yet. Be the first to review!</p>';
        return;
    }

    reviewsContainer.innerHTML = reviews.results.slice(0, 5).map(review => `
        <div class="review-card">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                <strong>${review.author}</strong>
                <span style="color: #ffd700;">★ ${review.author_details.rating || 'N/A'}</span>
            </div>
            <p style="color: var(--text-secondary); line-height: 1.6;">
                ${review.content.substring(0, 300)}${review.content.length > 300 ? '...' : ''}
            </p>
        </div>
    `).join('');
}

function loadSimilar(similar) {
    const similarContainer = document.getElementById('modalSimilar');
    if (!similar || !similar.results || similar.results.length === 0) {
        similarContainer.innerHTML = '<p>No similar titles found.</p>';
        return;
    }

    renderCards(similar.results.slice(0, 10), 'modalSimilar', 'movie');
}

// --- User Actions ---
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
        // Save review to Firestore
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
            mediaType: currentMovieData.media_type || 'movie', // Save media type
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
            mediaType: currentMovieData.media_type || 'movie', // Save media type
            timestamp: serverTimestamp()
        });

        alert('Added to watch later!');
    } catch (error) {
        console.error('Error adding to watch later:', error);
        alert('Failed to add to watch later. Please try again.');
    }
}

function watchNow() {
    const mediaType = currentMovieData?.media_type || 'movie';
    window.location.href = `watchanddownload.html?id=${currentMovieId}&type=${mediaType}`;
}

async function addToCollectionConfirm(collectionId) {
    if (!currentUser || !currentMovieId) return;

    try {
        await addDoc(collection(db, 'users', currentUser.uid, 'custom_collections', collectionId, 'items'), {
            movieId: currentMovieId,
            movieTitle: currentMovieData.title || currentMovieData.name,
            posterPath: currentMovieData.poster_path,
            rating: currentMovieData.vote_average,
            mediaType: currentMovieData.media_type || 'movie',
            addedAt: serverTimestamp()
        });

        alert('Added to collection!');
        closeAddToCollectionModal();
    } catch (err) {
        console.error("Error adding to collection:", err);
        alert('Failed to add to collection.');
    }
}

async function openAddToCollectionModal() {
    if (!currentUser) {
        alert('Please log in.');
        window.location.href = 'login.html';
        return;
    }

    const modal = document.getElementById('addToCollectionModal');
    const list = document.getElementById('userCollectionsList');
    if (modal) modal.style.display = 'block';

    list.innerHTML = '<div style="text-align: center;">Loading...</div>';

    try {
        const snap = await getDocs(collection(db, 'users', currentUser.uid, 'custom_collections'));
        list.innerHTML = '';

        if (snap.empty) {
            list.innerHTML = '<div style="text-align: center; padding: 1rem;">No custom collections found. <a href="collection.html" style="color: var(--primary-color);">Create one</a></div>';
            return;
        }

        snap.forEach(doc => {
            const data = doc.data();
            const btn = document.createElement('button');
            btn.className = 'glass-button';
            btn.style.justifyContent = 'flex-start';
            btn.style.textAlign = 'left';
            btn.innerHTML = `<i class="fas fa-folder"></i> ${data.name}`;
            btn.onclick = () => addToCollectionConfirm(doc.id);
            list.appendChild(btn);
        });
    } catch (err) {
        console.error("Error loading collections:", err);
        list.innerHTML = '<div style="color: red;">Error loading collections.</div>';
    }
}

function closeAddToCollectionModal() {
    document.getElementById('addToCollectionModal').style.display = 'none';
}

// --- AI Chat ---
// --- AI Chat ---
async function askAI() {
    const questionInput = document.getElementById('aiQuestion');
    const question = questionInput.value.trim();
    if (!question) return;

    const chatContainer = document.getElementById('aiChat');

    // Add user message to UI
    const userMsg = document.createElement('div');
    userMsg.className = 'ai-message user';
    userMsg.innerHTML = `<p>${question}</p>`; // Use p tag for consistency with CSS
    chatContainer.appendChild(userMsg);

    questionInput.value = '';

    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;

    if (!window.callAI) {
        console.error("AI system not initialized");
        const errorMsg = document.createElement('div');
        errorMsg.className = 'ai-message ai';
        errorMsg.innerHTML = '<p>AI system is currently unavailable.</p>';
        chatContainer.appendChild(errorMsg);
        return;
    }

    const movieTitle = currentMovieData.title || currentMovieData.name;
    const movieYear = (currentMovieData.release_date || currentMovieData.first_air_date || '').split('-')[0];

    // Construct Prompt
    const systemPrompt = `You are a knowledgeable movie assistant focusing on "${movieTitle}" (${movieYear}). 
    Answer the user's question specifically about this title. 
    Keep your response concise (max 3 sentences). Be friendly and enthusiastic.`;

    const messages = [{ role: 'user', content: question }];

    try {
        const response = await window.callAI(messages, systemPrompt, false);

        const aiMsg = document.createElement('div');
        aiMsg.className = 'ai-message ai';
        aiMsg.innerHTML = `<p>${response}</p>`;
        chatContainer.appendChild(aiMsg);
        chatContainer.scrollTop = chatContainer.scrollHeight;

    } catch (error) {
        console.error('AI Error:', error);
        const aiMsg = document.createElement('div');
        aiMsg.className = 'ai-message ai';
        aiMsg.innerHTML = '<p>Sorry, I encountered an error. Please try again.</p>';
        chatContainer.appendChild(aiMsg);
    }
}

async function callHuggingFace(prompt) {
    if (!window.APP_CONFIG || !window.APP_CONFIG.HUGGINGFACE_API_KEY) {
        throw new Error("Hugging Face API key not configured");
    }

    const HF_API_KEY = window.APP_CONFIG.HUGGINGFACE_API_KEY;
    const HF_MODEL = "meta-llama/Llama-3.2-3B-Instruct";
    const url = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${HF_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            inputs: prompt,
            parameters: {
                max_new_tokens: 250,
                temperature: 0.7,
                top_p: 0.9,
                return_full_text: false
            }
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error('Hugging Face API Error:', errorData);

        if (errorData.error && errorData.error.includes('loading')) {
            throw new Error('AI model is warming up. Please try again in a few seconds.');
        }

        throw new Error(`API Error: ${errorData.error || response.statusText}`);
    }

    const data = await response.json();

    // Hugging Face returns an array with generated text
    if (Array.isArray(data) && data[0]?.generated_text) {
        return data[0].generated_text;
    } else if (typeof data === 'string') {
        return data;
    } else {
        console.error('Unexpected API response:', data);
        throw new Error('Invalid response format from AI.');
    }
}

// Close modal on outside click
window.onclick = function (event) {
    const modal = document.getElementById('movieModal');
    if (event.target == modal) {
        closeModal();
    }
}

// ============================================
// GLOBAL THEME & VIBE CONTROLLER
// ============================================

const THEME_SETTINGS = [
    { name: 'Dark Mode', class: 'theme-dark', default: true },
    { name: 'Light Mode', class: 'theme-light' }
];

const VIBE_SETTINGS = [
    { name: 'Standard', class: 'vibe-standard', default: true },
    { name: 'Neon Nights', class: 'vibe-neon' },
    { name: 'Retro Wave', class: 'vibe-retro' },
    { name: 'Cozy Cinema', class: 'vibe-cozy' }
];

function applyTheme(themeClass) {
    // Remove all theme classes
    THEME_SETTINGS.forEach(t => document.body.classList.remove(t.class));
    // Add new theme class
    document.body.classList.add(themeClass);
    // Save
    localStorage.setItem('os_theme', themeClass);
    // Update UI
    updateAppearanceUI();
    console.log(`Theme applied: ${themeClass}`);
}

function applyVibe(vibeClass) {
    // Remove all vibe classes
    VIBE_SETTINGS.forEach(v => document.body.classList.remove(v.class));
    // Add new vibe class
    document.body.classList.add(vibeClass);
    // Save
    localStorage.setItem('os_vibe', vibeClass);
    // Update UI
    updateAppearanceUI();
    console.log(`Vibe applied: ${vibeClass}`);
}

function initThemeVibe() {
    // Load Theme
    const savedTheme = localStorage.getItem('os_theme');
    if (savedTheme && THEME_SETTINGS.some(t => t.class === savedTheme)) {
        applyTheme(savedTheme);
    } else {
        const defaultTheme = THEME_SETTINGS.find(t => t.default);
        applyTheme(defaultTheme.class);
    }

    // Load Vibe
    const savedVibe = localStorage.getItem('os_vibe');
    if (savedVibe && VIBE_SETTINGS.some(v => v.class === savedVibe)) {
        applyVibe(savedVibe);
    } else {
        const defaultVibe = VIBE_SETTINGS.find(t => t.default);
        applyVibe(defaultVibe.class);
    }
}



function updateAppearanceUI() {
    // Update Theme Buttons
    document.querySelectorAll('.theme-btn').forEach(btn => {
        const onclick = btn.getAttribute('onclick');
        if (onclick) {
            const match = onclick.match(/'([^']+)'/);
            if (match) {
                const themeClass = match[1];
                if (document.body.classList.contains(themeClass)) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            }
        }
    });

    // Update Vibe Select
    const select = document.querySelector('.vibe-select');
    if (select) {
        VIBE_SETTINGS.forEach(v => {
            if (document.body.classList.contains(v.class)) {
                select.value = v.class;
            }
        });
    }
}

// Expose to window
window.applyTheme = applyTheme;
window.applyVibe = applyVibe;
window.initThemeVibe = initThemeVibe;
window.fetchTMDB = fetchTMDB;
window.renderCustomList = renderCustomList;

// Toggle theme function for navbar button
window.toggleTheme = function () {
    const isDark = document.body.classList.contains('theme-dark');
    if (isDark) {
        applyTheme('theme-light');
    } else {
        applyTheme('theme-dark');
    }

    // Update icon
    const themeBtn = document.querySelector('.theme-toggle i');
    if (themeBtn) {
        if (isDark) {
            themeBtn.classList.remove('fa-moon');
            themeBtn.classList.add('fa-sun');
        } else {
            themeBtn.classList.remove('fa-sun');
            themeBtn.classList.add('fa-moon');
        }
    }
};


