import { auth, db, addDoc, setDoc, doc, serverTimestamp, collection } from './firebase-config.js';

let currentPage = 1;
let currentQuery = '';
let currentFilters = {
    type: 'multi',
    genre: '',
    year: '',
    sort: 'popularity.desc'
};
let isLoading = false;
let currentMovieId = null;
let currentMovieData = null;
let userRating = null;
let currentUser = auth.currentUser;
let debounceTimer;

// Listen for auth state
auth.onAuthStateChanged(user => {
    currentUser = user;
});

document.addEventListener('DOMContentLoaded', () => {
    loadGenres();
    loadTrendingSearches();
    setupEventListeners();
});

function setupEventListeners() {
    const input = document.getElementById('advancedSearchInput');
    const searchBtn = document.getElementById('searchBtn');
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    const applyFiltersBtn = document.getElementById('applyFiltersBtn');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    const filterHeader = document.getElementById('filterHeader');

    // Input Autocomplete
    input.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(debounceTimer);

        if (query.length < 2) {
            document.getElementById('searchSuggestions').style.display = 'none';
            return;
        }

        debounceTimer = setTimeout(() => {
            fetchSuggestions(query);
        }, 300);
    });

    // Search Execution
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('searchSuggestions').style.display = 'none';
            executeSearch();
        }
    });

    searchBtn.addEventListener('click', executeSearch);

    // Filters
    filterHeader.addEventListener('click', toggleFilters);
    applyFiltersBtn.addEventListener('click', () => {
        executeSearch();
        // Optional: Close filters on mobile
        if (window.innerWidth < 768) toggleFilters();
    });
    resetFiltersBtn.addEventListener('click', resetFilters);

    // Load More
    loadMoreBtn.addEventListener('click', () => {
        if (!isLoading) {
            currentPage++;
            performSearch(currentQuery, currentFilters, currentPage, true);
        }
    });

    // Close suggestions on click outside
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !document.getElementById('searchSuggestions').contains(e.target)) {
            document.getElementById('searchSuggestions').style.display = 'none';
        }
    });
}

async function loadGenres() {
    const data = await fetchTMDB('/genre/movie/list');
    if (data && data.genres) {
        const select = document.getElementById('filterGenre');
        data.genres.forEach(genre => {
            const option = document.createElement('option');
            option.value = genre.id;
            option.textContent = genre.name;
            select.appendChild(option);
        });
    }
}

async function loadTrendingSearches() {
    const data = await fetchTMDB('/trending/all/day');
    if (data && data.results) {
        const container = document.getElementById('trendingTags');
        container.innerHTML = '';
        // Take top 10 titles
        const titles = data.results.slice(0, 10).map(item => item.title || item.name);
        // Deduplicate
        const uniqueTitles = [...new Set(titles)];

        uniqueTitles.forEach(title => {
            const tag = document.createElement('div');
            tag.className = 'trending-tag';
            tag.textContent = title;
            tag.onclick = () => {
                document.getElementById('advancedSearchInput').value = title;
                executeSearch();
            };
            container.appendChild(tag);
        });
    }
}

async function fetchSuggestions(query) {
    const data = await fetchTMDB('/search/multi', { query: query });
    const container = document.getElementById('searchSuggestions');
    container.innerHTML = '';

    if (data && data.results && data.results.length > 0) {
        container.style.display = 'block';
        data.results.slice(0, 5).forEach(item => {
            if (!item.title && !item.name) return;

            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.innerHTML = `
                <span>${item.title || item.name}</span>
                <span style="font-size: 0.8rem; color: var(--text-secondary);">${item.media_type ? item.media_type.toUpperCase() : ''}</span>
            `;
            div.onclick = () => {
                // Autofill and search
                document.getElementById('advancedSearchInput').value = item.title || item.name;
                container.style.display = 'none';
                executeSearch();
                // Alternatively, open modal directly:
                // openMovieModal(item.id, item.media_type);
            };
            container.appendChild(div);
        });
    } else {
        container.style.display = 'none';
    }
}

function executeSearch() {
    const input = document.getElementById('advancedSearchInput');
    currentQuery = input.value.trim();

    // Update filters
    currentFilters.type = document.getElementById('filterType').value;
    currentFilters.genre = document.getElementById('filterGenre').value;
    currentFilters.year = document.getElementById('filterYear').value;
    currentFilters.sort = document.getElementById('filterSort').value;

    currentPage = 1;
    performSearch(currentQuery, currentFilters, currentPage);
}

async function performSearch(query, filters, page, append = false) {
    isLoading = true;
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    const resultsGrid = document.getElementById('resultsGrid');
    const resultsTitle = document.getElementById('resultsTitle');

    if (!append) {
        resultsGrid.innerHTML = '';
        resultsTitle.style.display = 'block';
        resultsTitle.textContent = query ? `Results for "${query}"` : 'Filtered Results';
    }

    let endpoint = '';
    let params = { page: page };

    if (query) {
        // Text Search
        if (filters.type === 'movie') endpoint = '/search/movie';
        else if (filters.type === 'tv') endpoint = '/search/tv';
        else endpoint = '/search/multi';

        params.query = query;
        if (filters.year) params.year = filters.year; // Works for movie search
        // Note: Sort and Genre are hard to apply server-side for search. 
        // We will filter client-side if needed, or just ignore for now.
    } else {
        // Discover (Filters only)
        if (filters.type === 'tv') endpoint = '/discover/tv';
        else endpoint = '/discover/movie'; // Default to movie if 'multi' or 'movie'

        if (filters.genre) params.with_genres = filters.genre;
        if (filters.year) params.primary_release_year = filters.year;
        if (filters.sort) params.sort_by = filters.sort;
    }

    const data = await fetchTMDB(endpoint, params);

    if (data && data.results) {
        let results = data.results;

        // Client-side filtering for Search (since API is limited)
        if (query && filters.genre) {
            results = results.filter(item => item.genre_ids && item.genre_ids.includes(parseInt(filters.genre)));
        }

        renderGrid(results);

        if (page < data.total_pages) {
            loadMoreBtn.style.display = 'block';
            loadMoreBtn.textContent = 'Load More';
        } else {
            loadMoreBtn.style.display = 'none';
        }

        if (results.length === 0 && !append) {
            resultsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">No results found.</p>';
        }
    } else {
        if (!append) resultsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">No results found.</p>';
    }

    isLoading = false;
}

function renderGrid(items) {
    const container = document.getElementById('resultsGrid');

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

        card.onclick = () => openMovieModal(item.id, item.media_type || (item.title ? 'movie' : 'tv'));
        container.appendChild(card);
    });
}

function toggleFilters() {
    const content = document.getElementById('filterContent');
    const icon = document.getElementById('filterToggleIcon');
    if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
    } else {
        content.style.display = 'none';
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
    }
}

function resetFilters() {
    document.getElementById('filterType').value = 'multi';
    document.getElementById('filterGenre').value = '';
    document.getElementById('filterYear').value = '';
    document.getElementById('filterSort').value = 'popularity.desc';
    document.getElementById('advancedSearchInput').value = '';

    // Clear results
    document.getElementById('resultsGrid').innerHTML = '';
    document.getElementById('resultsTitle').style.display = 'none';
    document.getElementById('loadMoreBtn').style.display = 'none';
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

// --- Modal Logic (Copied/Adapted) ---
// Expose functions to window
window.closeModal = closeModal;
window.switchTab = switchTab;
window.rateMovie = rateMovie;
window.submitReview = submitReview;
window.markAsWatched = markAsWatched;
window.addToWatchLater = addToWatchLater;
window.watchNow = watchNow;
window.askAI = askAI;
window.toggleFilters = toggleFilters;
window.applyFilters = executeSearch;
window.resetFilters = resetFilters;

async function openMovieModal(id, type = 'movie') {
    currentMovieId = id;
    const modal = document.getElementById('movieModal');
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';

    const details = await fetchTMDB(`/${type}/${id}`, { append_to_response: 'videos,credits,reviews,similar' });
    if (!details) return;

    currentMovieData = details;
    currentMovieData.media_type = type;

    document.getElementById('modalPoster').src = `${window.APP_CONFIG.TMDB_IMAGE_SMALL_URL}${details.poster_path}`;
    document.getElementById('modalTitle').textContent = details.title || details.name;
    document.getElementById('modalRating').textContent = details.vote_average ? details.vote_average.toFixed(1) : 'N/A';
    document.getElementById('modalYear').textContent = (details.release_date || details.first_air_date || '').split('-')[0];
    document.getElementById('modalRuntime').textContent = details.runtime ? `${details.runtime} min` : '';
    document.getElementById('modalOverview').textContent = details.overview;

    loadTrailer(details.videos);
    loadGenresModal(details.genres); // Renamed to avoid conflict with loadGenres page function
    loadCast(details.credits);
    loadReviews(details.reviews);
    loadSimilar(details.similar);
}

function closeModal() {
    document.getElementById('movieModal').style.display = 'none';
    document.body.style.overflow = 'auto';
    currentMovieId = null;
    currentMovieData = null;
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).style.display = 'block';

    // Activate button logic...
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

function loadGenresModal(genres) {
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
    similarContainer.innerHTML = '';
    similar.results.slice(0, 10).forEach(item => {
        if (!item.poster_path) return;
        const card = document.createElement('div');
        card.className = 'media-card';
        card.style.minWidth = '160px';
        card.innerHTML = `
            <img class="media-poster" src="${window.APP_CONFIG.TMDB_IMAGE_SMALL_URL}${item.poster_path}" loading="lazy" alt="${item.title || item.name}">
            <div class="media-info">
                <div class="media-title">${item.title || item.name}</div>
                <div class="media-year">${(item.release_date || item.first_air_date || '').split('-')[0]}</div>
            </div>
        `;
        card.onclick = () => openMovieModal(item.id, item.media_type || 'movie');
        similarContainer.appendChild(card);
    });
}

function rateMovie(rating) {
    userRating = rating;
    document.querySelectorAll('.rating-btn').forEach(btn => btn.classList.remove('selected'));
    document.querySelector(`.rating-btn[data-rating="${rating}"]`).classList.add('selected');
}

async function submitReview() {
    const reviewText = document.getElementById('reviewText').value;
    if (!userRating) { alert('Please select a rating first!'); return; }
    if (!reviewText.trim()) { alert('Please write a review!'); return; }
    if (!currentUser) { alert('Please log in to submit a review!'); window.location.href = 'login.html'; return; }
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
    } catch (error) {
        console.error('Error submitting review:', error);
        alert('Failed to submit review. Please try again.');
    }
}

async function markAsWatched() {
    if (!currentUser) { alert('Please log in!'); window.location.href = 'login.html'; return; }
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
    } catch (error) { console.error(error); alert('Failed.'); }
}

async function addToWatchLater() {
    if (!currentUser) { alert('Please log in!'); window.location.href = 'login.html'; return; }
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
    } catch (error) { console.error(error); alert('Failed.'); }
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
