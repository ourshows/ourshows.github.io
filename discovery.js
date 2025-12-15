import { auth, db, addDoc, setDoc, doc, serverTimestamp, collection, getDocs, deleteDoc } from './firebase-config.js';

// ============================================
// STATE MANAGEMENT
// ============================================
let currentSearchScope = 'movie'; // movie, tv, person
let currentPage = 1;
let currentQuery = '';
let currentFilters = {
    sortBy: 'popularity.desc',
    language: '',
    yearFrom: '',
    yearTo: '',
    genres: []
};
let searchHistory = [];
let debounceTimer;
let currentUser = auth.currentUser;
let currentMovieId = null;
let currentMovieData = null;
let userRating = null;

// Listen for auth state
auth.onAuthStateChanged(user => {
    currentUser = user;
    loadSearchHistory();
});

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initDiscoveryPage();
});

async function initDiscoveryPage() {
    if (!window.APP_CONFIG) {
        console.error("Config not found!");
        return;
    }

    await loadGenres();
    await loadTrendingSearches();
    setupEventListeners();
    loadSearchHistory();
}

function setupEventListeners() {
    const searchInput = document.getElementById('mainSearchInput');
    const dropdown = document.getElementById('search-results-dropdown');

    // Search input events
    searchInput.addEventListener('input', handleSearchInput);
    searchInput.addEventListener('focus', () => {
        dropdown.classList.add('active');
        if (!searchInput.value) {
            showTrendingAndHistory();
        }
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && searchInput.value.trim()) {
            performSearch(searchInput.value.trim());
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });

    // Load more button
    document.getElementById('loadMoreBtn')?.addEventListener('click', loadMore);
}

// ============================================
// SEARCH SCOPE TOGGLE
// ============================================
window.toggleSearchScope = function (scope) {
    currentSearchScope = scope;

    // Update UI
    document.querySelectorAll('.scope-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.scope === scope) {
            btn.classList.add('active');
        }
    });

    // Update placeholder
    const input = document.getElementById('mainSearchInput');
    const placeholders = {
        movie: 'Search for movies...',
        tv: 'Search for TV series...',
        person: 'Search for actors, directors...'
    };
    input.placeholder = placeholders[scope] || 'Search...';

    // Clear results if there's a current search
    if (currentQuery) {
        performSearch(currentQuery);
    }

    console.log(`Search scope changed to: ${scope}`);
};

// ============================================
// SEARCH INPUT HANDLING
// ============================================
function handleSearchInput(e) {
    const query = e.target.value.trim();

    clearTimeout(debounceTimer);

    if (!query) {
        showTrendingAndHistory();
        return;
    }

    if (query.length < 2) {
        return;
    }

    debounceTimer = setTimeout(() => {
        fetchAutofillResults(query);
    }, 300);
}

async function fetchAutofillResults(query) {
    const endpoint = currentSearchScope === 'person' ? '/search/person' : '/search/multi';
    const data = await fetchTMDB(endpoint, { query: query });

    if (data && data.results && data.results.length > 0) {
        displayAutofillResults(data.results.slice(0, 5));
    } else {
        showNoResults(query);
    }
}

function displayAutofillResults(results) {
    const autofillSection = document.getElementById('autofillSection');
    const autofillResults = document.getElementById('autofillResults');
    const trendingSection = document.getElementById('trendingSection');
    const historySection = document.getElementById('historySection');
    const aiFallbackSection = document.getElementById('aiFallbackSection');

    // Hide other sections
    trendingSection.style.display = 'none';
    historySection.style.display = 'none';
    aiFallbackSection.style.display = 'none';

    // Show autofill section
    autofillSection.style.display = 'block';

    autofillResults.innerHTML = results.map(item => {
        const title = item.title || item.name;
        const year = (item.release_date || item.first_air_date || '').split('-')[0];
        const posterPath = item.poster_path || item.profile_path;
        const mediaType = item.media_type || currentSearchScope;

        return `
            <div class="autofill-item" onclick="selectAutofillItem(${item.id}, '${mediaType}', '${title.replace(/'/g, "\\'")}')">
                <img 
                    class="autofill-poster" 
                    src="${posterPath ? window.APP_CONFIG.TMDB_IMAGE_SMALL_URL + posterPath : 'https://via.placeholder.com/50x75?text=No+Image'}" 
                    alt="${title}"
                >
                <div class="autofill-info">
                    <div class="autofill-title">${title}</div>
                    <div class="autofill-meta">
                        ${year ? year + ' • ' : ''}
                        ${mediaType === 'movie' ? '🎬 Movie' : mediaType === 'tv' ? '📺 Series' : '👤 Person'}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

window.selectAutofillItem = function (id, mediaType, title) {
    // Add to search history
    addToSearchHistory(title);

    // Close dropdown
    document.getElementById('search-results-dropdown').classList.remove('active');

    // Open modal or perform action based on type
    if (mediaType === 'person') {
        // For people, perform a search for their works
        performSearch(title);
    } else {
        openMovieModal(id, mediaType);
    }
};

function showNoResults(query) {
    const autofillSection = document.getElementById('autofillSection');
    const aiFallbackSection = document.getElementById('aiFallbackSection');
    const trendingSection = document.getElementById('trendingSection');
    const historySection = document.getElementById('historySection');

    trendingSection.style.display = 'none';
    historySection.style.display = 'none';
    autofillSection.style.display = 'none';
    aiFallbackSection.style.display = 'block';

    document.getElementById('aiFallbackBtn').onclick = () => {
        window.location.href = `ai.html?q=${encodeURIComponent(query)}`;
    };
}

function showTrendingAndHistory() {
    const trendingSection = document.getElementById('trendingSection');
    const historySection = document.getElementById('historySection');
    const autofillSection = document.getElementById('autofillSection');
    const aiFallbackSection = document.getElementById('aiFallbackSection');

    trendingSection.style.display = 'block';
    historySection.style.display = searchHistory.length > 0 ? 'block' : 'none';
    autofillSection.style.display = 'none';
    aiFallbackSection.style.display = 'none';
}

// ============================================
// TRENDING SEARCHES
// ============================================
async function loadTrendingSearches() {
    const data = await fetchTMDB('/trending/all/day');

    if (data && data.results) {
        const trendingChips = document.getElementById('trendingChips');
        const titles = data.results.slice(0, 8).map(item => item.title || item.name);
        const uniqueTitles = [...new Set(titles)];

        trendingChips.innerHTML = uniqueTitles.map(title => `
            <div class="trending-chip" onclick="searchFromTrending('${title.replace(/'/g, "\\'")}')">
                ${title}
            </div>
        `).join('');
    }
}

window.searchFromTrending = function (query) {
    document.getElementById('mainSearchInput').value = query;
    performSearch(query);
    document.getElementById('search-results-dropdown').classList.remove('active');
};

// ============================================
// SEARCH HISTORY
// ============================================
function loadSearchHistory() {
    const saved = localStorage.getItem('os_search_history');
    if (saved) {
        searchHistory = JSON.parse(saved);
        displaySearchHistory();
    }
}

function addToSearchHistory(query) {
    // Remove if already exists
    searchHistory = searchHistory.filter(item => item.query !== query);

    // Add to beginning
    searchHistory.unshift({
        query: query,
        timestamp: Date.now()
    });

    // Keep only last 10
    searchHistory = searchHistory.slice(0, 10);

    // Save
    localStorage.setItem('os_search_history', JSON.stringify(searchHistory));
    displaySearchHistory();
}

function displaySearchHistory() {
    const historyList = document.getElementById('historyList');

    if (searchHistory.length === 0) {
        document.getElementById('historySection').style.display = 'none';
        return;
    }

    historyList.innerHTML = searchHistory.map((item, index) => `
        <div class="history-item">
            <div class="history-item-text" onclick="searchFromHistory('${item.query.replace(/'/g, "\\'")}')">
                <i class="fas fa-history history-item-icon"></i>
                ${item.query}
            </div>
            <button class="history-item-remove" onclick="removeFromHistory(${index})">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

window.searchFromHistory = function (query) {
    document.getElementById('mainSearchInput').value = query;
    performSearch(query);
    document.getElementById('search-results-dropdown').classList.remove('active');
};

window.removeFromHistory = function (index) {
    searchHistory.splice(index, 1);
    localStorage.setItem('os_search_history', JSON.stringify(searchHistory));
    displaySearchHistory();
};

// ============================================
// MAIN SEARCH EXECUTION
// ============================================
async function performSearch(query) {
    currentQuery = query;
    currentPage = 1;

    addToSearchHistory(query);

    // Show results header
    document.getElementById('resultsHeader').style.display = 'block';
    document.getElementById('resultsTitle').textContent = `Results for "${query}"`;
    document.getElementById('emptyState').style.display = 'none';

    // Determine endpoint based on scope
    let endpoint = '/search/multi';
    if (currentSearchScope === 'movie') endpoint = '/search/movie';
    else if (currentSearchScope === 'tv') endpoint = '/search/tv';
    else if (currentSearchScope === 'person') endpoint = '/search/person';

    const data = await fetchTMDB(endpoint, { query: query, page: currentPage });

    if (data && data.results) {
        // Prioritize regional content
        const prioritizedResults = prioritizeRegionalContent(data.results);
        displayResults(prioritizedResults, data.total_results);

        // Show load more if there are more pages
        if (currentPage < data.total_pages) {
            document.getElementById('loadMoreContainer').style.display = 'block';
        } else {
            document.getElementById('loadMoreContainer').style.display = 'none';
        }
    }
}

// ============================================
// REGIONAL CONTENT PRIORITIZATION
// ============================================
function prioritizeRegionalContent(results) {
    const nepaliContent = results.filter(item =>
        item.original_language === 'ne' ||
        (item.origin_country && item.origin_country.includes('NP'))
    );

    const hindiContent = results.filter(item =>
        item.original_language === 'hi' ||
        (item.origin_country && item.origin_country.includes('IN'))
    );

    const otherContent = results.filter(item =>
        item.original_language !== 'ne' &&
        item.original_language !== 'hi' &&
        (!item.origin_country || (!item.origin_country.includes('NP') && !item.origin_country.includes('IN')))
    );

    // Intersperse: Nepali, Hindi, then others
    const prioritized = [];
    const maxLength = Math.max(nepaliContent.length, hindiContent.length, otherContent.length);

    for (let i = 0; i < maxLength; i++) {
        if (nepaliContent[i]) prioritized.push(nepaliContent[i]);
        if (hindiContent[i]) prioritized.push(hindiContent[i]);
        if (otherContent[i]) prioritized.push(otherContent[i]);
    }

    return prioritized;
}

// ============================================
// FILTER PANEL
// ============================================
window.toggleFilterPanel = function () {
    const panel = document.getElementById('filter-controls-panel');
    const btn = document.getElementById('filterToggleBtn');

    panel.classList.toggle('active');
    btn.classList.toggle('active');
};

async function loadGenres() {
    const movieGenres = await fetchTMDB('/genre/movie/list');
    const tvGenres = await fetchTMDB('/genre/tv/list');

    if (movieGenres && tvGenres) {
        // Combine and deduplicate
        const allGenres = [...movieGenres.genres, ...tvGenres.genres];
        const uniqueGenres = Array.from(new Map(allGenres.map(g => [g.id, g])).values());

        const genrePills = document.getElementById('genrePills');
        genrePills.innerHTML = uniqueGenres.map(genre => `
            <div class="genre-pill" data-genre-id="${genre.id}" onclick="toggleGenre(${genre.id})">
                ${genre.name}
            </div>
        `).join('');
    }
}

window.toggleGenre = function (genreId) {
    const pill = document.querySelector(`[data-genre-id="${genreId}"]`);
    pill.classList.toggle('selected');

    if (currentFilters.genres.includes(genreId)) {
        currentFilters.genres = currentFilters.genres.filter(id => id !== genreId);
    } else {
        currentFilters.genres.push(genreId);
    }
};

window.applyFilters = async function () {
    currentPage = 1;

    // Collect filter values
    currentFilters.sortBy = document.getElementById('sortBySelect').value;
    currentFilters.language = document.getElementById('languageSelect').value;
    currentFilters.yearFrom = document.getElementById('yearFrom').value;
    currentFilters.yearTo = document.getElementById('yearTo').value;

    // Use discover endpoint
    const endpoint = currentSearchScope === 'tv' ? '/discover/tv' : '/discover/movie';

    const params = {
        sort_by: currentFilters.sortBy,
        page: currentPage
    };

    if (currentFilters.language) params.with_original_language = currentFilters.language;
    if (currentFilters.genres.length > 0) params.with_genres = currentFilters.genres.join(',');
    if (currentFilters.yearFrom) params['primary_release_date.gte'] = `${currentFilters.yearFrom}-01-01`;
    if (currentFilters.yearTo) params['primary_release_date.lte'] = `${currentFilters.yearTo}-12-31`;

    const data = await fetchTMDB(endpoint, params);

    if (data && data.results) {
        document.getElementById('resultsHeader').style.display = 'block';
        document.getElementById('resultsTitle').textContent = 'Filtered Results';
        document.getElementById('emptyState').style.display = 'none';

        const prioritizedResults = prioritizeRegionalContent(data.results);
        displayResults(prioritizedResults, data.total_results);

        if (currentPage < data.total_pages) {
            document.getElementById('loadMoreContainer').style.display = 'block';
        } else {
            document.getElementById('loadMoreContainer').style.display = 'none';
        }
    }

    // Close filter panel
    toggleFilterPanel();
};

window.resetFilters = function () {
    currentFilters = {
        sortBy: 'popularity.desc',
        language: '',
        yearFrom: '',
        yearTo: '',
        genres: []
    };

    document.getElementById('sortBySelect').value = 'popularity.desc';
    document.getElementById('languageSelect').value = '';
    document.getElementById('yearFrom').value = '';
    document.getElementById('yearTo').value = '';

    document.querySelectorAll('.genre-pill').forEach(pill => {
        pill.classList.remove('selected');
    });

    // Clear results
    document.getElementById('resultsGrid').innerHTML = '';
    document.getElementById('resultsHeader').style.display = 'none';
    document.getElementById('emptyState').style.display = 'block';
    document.getElementById('loadMoreContainer').style.display = 'none';
};

// ============================================
// DISPLAY RESULTS
// ============================================
function displayResults(results, totalResults) {
    const grid = document.getElementById('resultsGrid');
    const resultsCount = document.getElementById('resultsCount');

    resultsCount.textContent = `${totalResults.toLocaleString()} results found`;

    if (currentPage === 1) {
        grid.innerHTML = '';
    }

    results.forEach(item => {
        if (!item.poster_path && !item.profile_path) return;

        const card = document.createElement('div');
        card.className = 'media-card';

        const title = item.title || item.name;
        const year = (item.release_date || item.first_air_date || '').split('-')[0];
        const posterPath = item.poster_path || item.profile_path;
        const mediaType = item.media_type || currentSearchScope;

        // Add regional badge
        const isNepali = item.original_language === 'ne' || (item.origin_country && item.origin_country.includes('NP'));
        const isHindi = item.original_language === 'hi' || (item.origin_country && item.origin_country.includes('IN'));
        const regionalBadge = isNepali ? '<span class="regional-badge">🇳🇵 NP</span>' :
            isHindi ? '<span class="regional-badge">🇮🇳 IN</span>' : '';

        card.innerHTML = `
            <img class="media-poster" src="${window.APP_CONFIG.TMDB_IMAGE_SMALL_URL}${posterPath}" loading="lazy" alt="${title}">
            <div class="media-info">
                <div class="media-title">${title} ${regionalBadge}</div>
                <div class="media-year">${year}</div>
            </div>
        `;

        card.onclick = () => {
            if (mediaType === 'person') {
                performSearch(title);
            } else {
                openMovieModal(item.id, mediaType);
            }
        };

        grid.appendChild(card);
    });
}

async function loadMore() {
    currentPage++;

    if (currentQuery) {
        // Continue search
        let endpoint = '/search/multi';
        if (currentSearchScope === 'movie') endpoint = '/search/movie';
        else if (currentSearchScope === 'tv') endpoint = '/search/tv';

        const data = await fetchTMDB(endpoint, { query: currentQuery, page: currentPage });

        if (data && data.results) {
            const prioritizedResults = prioritizeRegionalContent(data.results);
            displayResults(prioritizedResults, data.total_results);

            if (currentPage >= data.total_pages) {
                document.getElementById('loadMoreContainer').style.display = 'none';
            }
        }
    } else {
        // Continue filtered results
        applyFilters();
    }
}

// ============================================
// TMDB API
// ============================================
// Client-Side Direct Call (Preferred)
if (window.PUBLIC_CONFIG && window.PUBLIC_CONFIG.TMDB_KEY) {
    const baseUrl = window.PUBLIC_CONFIG.TMDB_BASE_URL || "https://api.themoviedb.org/3";
    const url = new URL(`${baseUrl}${endpoint}`);
    url.searchParams.append('api_key', window.PUBLIC_CONFIG.TMDB_KEY);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
    } catch (e) {
        console.error("Direct TMDB Error:", e);
        return null;
    }
}

const url = new URL('/api/tmdb', window.location.origin);
url.searchParams.append('endpoint', endpoint);
Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
} catch (error) {
    console.error("TMDB Fetch Error:", error);
    return null;
}


// ============================================
// MODAL FUNCTIONS (Reused from main.js)
// ============================================
window.closeModal = closeModal;
window.switchTab = switchTab;
window.rateMovie = rateMovie;
window.submitReview = submitReview;
window.markAsWatched = markAsWatched;
window.addToWatchLater = addToWatchLater;
window.watchNow = watchNow;
window.askAI = askAI;

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
    loadGenresModal(details.genres);
    loadCast(details.credits);
    loadReviews(details.reviews);
    loadSimilar(details.similar);
}

function closeModal() {
    document.getElementById('movieModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).style.display = 'block';

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
            <div style="font-size: 0.8rem; color: var(--os-text-secondary);">${person.character}</div>
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
            <p style="color: var(--os-text-secondary); line-height: 1.6;">
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
    chatContainer.innerHTML += `<div style="margin-bottom: 0.5rem; color: var(--os-accent-primary);"><strong>AI:</strong> That's a great question about ${currentMovieData.title || currentMovieData.name}! (AI integration coming soon)</div>`;
    document.getElementById('aiQuestion').value = '';
    chatContainer.scrollTop = chatContainer.scrollHeight;
}
