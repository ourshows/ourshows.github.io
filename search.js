import { auth, onAuthStateChanged } from './firebase-config.js';

// Init
document.addEventListener('DOMContentLoaded', () => {

    // Auth UI Update
    onAuthStateChanged(auth, (user) => {
        const authBtn = document.getElementById('navAuthBtn');
        if (authBtn) {
            if (user) {
                authBtn.innerHTML = '<i class="fas fa-user"></i> ' + (user.displayName || user.email.split('@')[0]);
                authBtn.href = 'profile.html';
            } else {
                authBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
                authBtn.href = 'login.html';
            }
        }
    });

    // Handle Search from URL
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');

    if (query) {
        document.getElementById('queryDisplay').textContent = query;
        document.getElementById('navSearchInput').value = query; // Pre-fill nav search
        performSearch(query);
    } else {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('emptyState').style.display = 'block';
        document.getElementById('resultsCount').textContent = '';
    }

    // Handle New Search from Navbar
    const navInput = document.getElementById('navSearchInput');
    if (navInput) {
        navInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const newQuery = navInput.value.trim();
                if (newQuery) {
                    window.location.href = `search.html?q=${encodeURIComponent(newQuery)}`;
                }
            }
        });
    }
});

async function performSearch(query) {
    const loading = document.getElementById('loading');
    const container = document.getElementById('resultsContainer');
    const emptyState = document.getElementById('emptyState');
    const countDisplay = document.getElementById('resultsCount');

    if (!window.APP_CONFIG) {
        console.error("Config not loaded");
        return;
    }

    try {
        const url = `${window.APP_CONFIG.TMDB_BASE_URL}/search/multi?api_key=${window.APP_CONFIG.TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false`;
        const res = await fetch(url);
        constdata = await res.json();

        loading.style.display = 'none';

        if (!data.results || data.results.length === 0) {
            emptyState.style.display = 'block';
            countDisplay.textContent = '0 results found';
            return;
        }

        // Filter out people or incomplete data
        const validResults = data.results.filter(item =>
            (item.media_type === 'movie' || item.media_type === 'tv') &&
            item.poster_path
        );

        if (validResults.length === 0) {
            emptyState.style.display = 'block';
            countDisplay.textContent = '0 results found';
            return;
        }

        countDisplay.textContent = `${validResults.length} results found`;
        renderResults(validResults);

    } catch (error) {
        console.error("Search error:", error);
        loading.style.display = 'none';
        container.innerHTML = '<p class="error-msg">An error occurred while searching. Please try again.</p>';
    }
}

function renderResults(items) {
    const container = document.getElementById('resultsContainer');
    container.innerHTML = '';

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'media-card';

        const title = item.title || item.name;
        const posterUrl = item.poster_path
            ? `${window.APP_CONFIG.TMDB_IMAGE_SMALL_URL}${item.poster_path}`
            : 'https://via.placeholder.com/200x300';
        const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
        const year = (item.release_date || item.first_air_date || '').split('-')[0];

        card.innerHTML = `
            <div class="media-poster-container">
                <img class="media-poster" src="${posterUrl}" loading="lazy" alt="${title}">
                <div class="card-rating-badge">★ ${rating}</div>
                <div class="card-overlay">
                     <button class="card-download-btn" onclick="event.stopPropagation(); window.location.href='watchanddownload.html?id=${item.id}&type=${item.media_type}'">
                        <i class="fas fa-play"></i> Watch
                    </button>
                    <button class="card-download-btn" style="margin-top: 0.5rem;" onclick="event.stopPropagation(); openLocalModal(this)" data-item='${JSON.stringify(item).replace(/'/g, "&#39;")}'>
                        <i class="fas fa-info-circle"></i> Details
                    </button>
                </div>
            </div>
            <div class="media-info">
                <div class="media-title" title="${title}">${title}</div>
                <div class="media-meta">
                    <span>${year}</span>
                    <span>${item.media_type === 'tv' ? 'TV Show' : 'Movie'}</span>
                </div>
            </div>
        `;

        // Click on card opens details
        card.onclick = () => showDetails(item);

        container.appendChild(card);
    });
}

// Modal Logic
function showDetails(item) {
    const modal = document.getElementById('movieModal');
    const posterUrl = item.poster_path ? `${window.APP_CONFIG.TMDB_IMAGE_SMALL_URL}${item.poster_path}` : 'https://via.placeholder.com/200x300';
    const title = item.title || item.name;
    const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
    const year = (item.release_date || item.first_air_date || '').split('-')[0];

    document.getElementById('modalPoster').src = posterUrl;
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalRating').textContent = `★ ${rating}`;
    document.getElementById('modalYear').textContent = year;
    document.getElementById('modalOverview').textContent = item.overview || 'No overview available.';

    // Watch Button
    const watchBtn = document.getElementById('modalWatchBtn');
    watchBtn.onclick = () => window.location.href = `watchanddownload.html?id=${item.id}&type=${item.media_type || 'movie'}`;

    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

// Attach to window for button onclick
window.openLocalModal = function (btn) {
    const itemData = btn.getAttribute('data-item');
    if (itemData) {
        showDetails(JSON.parse(itemData));
    }
}
