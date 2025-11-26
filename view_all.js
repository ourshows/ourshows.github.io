import { auth, db } from './firebase-config.js';

let currentPage = 1;
let currentCategory = '';
let isLoading = false;

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentCategory = urlParams.get('category');

    if (currentCategory) {
        updateTitle(currentCategory);
        loadContent(currentCategory, currentPage);
    }

    document.getElementById('loadMoreBtn').addEventListener('click', () => {
        if (!isLoading) {
            currentPage++;
            loadContent(currentCategory, currentPage);
        }
    });
});

function updateTitle(category) {
    const titles = {
        'trending': 'Trending Now',
        'popular': 'Popular Movies',
        'top_rated': 'Top Rated',
        'upcoming': 'Coming Soon',
        'now_playing': 'Now in Theaters',
        'nepali': 'Nepali Hits 🇳🇵',
        'hindi': 'Bollywood & Hindi 🇮🇳'
    };
    document.getElementById('pageTitle').textContent = titles[category] || 'Movies';
}

async function loadContent(category, page) {
    isLoading = true;
    const btn = document.getElementById('loadMoreBtn');
    btn.textContent = 'Loading...';

    let endpoint = '';
    let params = { page: page };

    switch (category) {
        case 'trending': endpoint = '/trending/movie/week'; break;
        case 'popular': endpoint = '/movie/popular'; break;
        case 'top_rated': endpoint = '/movie/top_rated'; break;
        case 'upcoming': endpoint = '/movie/upcoming'; break;
        case 'now_playing': endpoint = '/movie/now_playing'; break;
        case 'nepali':
            endpoint = '/discover/movie';
            params.with_original_language = 'ne';
            params.sort_by = 'popularity.desc';
            break;
        case 'hindi':
            endpoint = '/discover/movie';
            params.with_original_language = 'hi';
            params.sort_by = 'popularity.desc';
            params.region = 'IN';
            break;
    }

    const data = await fetchTMDB(endpoint, params);

    if (data && data.results) {
        renderGrid(data.results);
        if (page >= data.total_pages) {
            btn.style.display = 'none';
        }
    }

    isLoading = false;
    btn.textContent = 'Load More';
}

async function fetchTMDB(endpoint, params = {}) {
    if (!window.APP_CONFIG) return null;

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

function renderGrid(items) {
    const container = document.getElementById('mediaGrid');

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

        // For now, clicking just alerts or does nothing as we didn't fully copy the modal logic.
        // Ideally we should open the modal.
        // Let's just link to a simple details view or alert.
        // Or better, we can just reuse the openMovieModal from main.js if we import it or duplicate it.
        // Since main.js is not a module, we can't import easily.
        // Let's just redirect to index.html with a hash or query param to open the modal there?
        // No, that's complex.
        // Let's just show a simple alert for now or leave it non-interactive for this demo step.
        // User asked for "view full list", so seeing them is the priority.

        container.appendChild(card);
    });
}

// Simple modal close for the placeholder modal
window.closeModal = () => {
    document.getElementById('movieModal').style.display = 'none';
}
