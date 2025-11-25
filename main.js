// Main Application Logic

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    // Check if config is loaded
    if (!window.APP_CONFIG) {
        console.error("Config not found!");
        return;
    }

    // Initialize UI components
    setupNavbar();
    setupSearch();

    // Fetch Data
    await loadHeroContent();
    await loadTrending();
    await loadTopRated();
}

// --- UI Setup ---

function setupNavbar() {
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });
}

function setupSearch() {
    const input = document.getElementById('searchInput');
    const resultsContainer = document.getElementById('searchResults');
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

    // Close search when clicking outside
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !resultsContainer.contains(e.target)) {
            resultsContainer.classList.remove('active');
        }
    });
}

// --- Data Fetching ---

async function fetchTMDB(endpoint, params = {}) {
    const url = new URL(`${window.APP_CONFIG.TMDB_BASE_URL}${endpoint}`);
    url.searchParams.append('api_key', window.APP_CONFIG.TMDB_API_KEY);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
    } catch (error) {
        console.error("TMDB Fetch Error:", error);
        return null;
    }
}

async function loadHeroContent() {
    // Fetch trending to pick a random hero
    const data = await fetchTMDB('/trending/all/day');
    if (data && data.results.length > 0) {
        const randomHero = data.results[Math.floor(Math.random() * 5)]; // Pick from top 5
        updateHeroUI(randomHero);
    }
}

function updateHeroUI(item) {
    const bg = document.getElementById('heroBg');
    const title = document.getElementById('heroTitle');
    const desc = document.getElementById('heroOverview');
    const rating = document.getElementById('heroRating');
    const year = document.getElementById('heroYear');
    const watchBtn = document.getElementById('heroWatchBtn');

    bg.src = `${window.APP_CONFIG.TMDB_IMAGE_BASE_URL}${item.backdrop_path}`;
    title.textContent = item.title || item.name;
    desc.textContent = item.overview;
    rating.textContent = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
    year.textContent = (item.release_date || item.first_air_date || '').split('-')[0];

    // Link to watch page
    watchBtn.onclick = () => {
        window.location.href = `watchanddownload.html?id=${item.id}&type=${item.media_type || 'movie'}`;
    };
}

async function loadTrending() {
    const data = await fetchTMDB('/trending/movie/week');
    if (data) {
        renderCards(data.results, 'trendingScroller', 'movie');
    }
}

async function loadTopRated() {
    const data = await fetchTMDB('/movie/top_rated');
    if (data) {
        renderCards(data.results, 'topRatedScroller', 'movie');
    }
}

async function performSearch(query) {
    const data = await fetchTMDB('/search/multi', { query: query });
    const resultsContainer = document.getElementById('searchResults');
    resultsContainer.innerHTML = '';

    if (data && data.results.length > 0) {
        resultsContainer.classList.add('active');
        data.results.slice(0, 5).forEach(item => {
            if (!item.poster_path && !item.profile_path) return; // Skip if no image

            const div = document.createElement('div');
            div.className = 'search-item';
            div.innerHTML = `
                <img src="${window.APP_CONFIG.TMDB_IMAGE_SMALL_URL}${item.poster_path || item.profile_path}" alt="${item.title || item.name}">
                <div>
                    <div style="font-weight: 600;">${item.title || item.name}</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">${item.media_type ? item.media_type.toUpperCase() : ''}</div>
                </div>
            `;
            div.onclick = () => {
                window.location.href = `watchanddownload.html?id=${item.id}&type=${item.media_type}`;
            };
            resultsContainer.appendChild(div);
        });
    } else {
        resultsContainer.classList.remove('active');
    }
}

// --- Rendering ---

function renderCards(items, containerId, defaultType) {
    const container = document.getElementById(containerId);
    container.innerHTML = ''; // Clear skeletons

    items.forEach(item => {
        if (!item.poster_path) return;

        const card = document.createElement('div');
        card.className = 'media-card';
        card.innerHTML = `
            <img class="media-poster" src="${window.APP_CONFIG.TMDB_IMAGE_SMALL_URL}${item.poster_path}" loading="lazy" alt="${item.title || item.name}">
            <div class="media-info">
                <div class="media-title">${item.title || item.name}</div>
                <div class="media-year">${(item.release_date || item.first_air_date || '').split('-')[0]}</div>
            </div>
        `;

        card.onclick = () => {
            window.location.href = `watchanddownload.html?id=${item.id}&type=${item.media_type || defaultType}`;
        };

        container.appendChild(card);
    });
}
