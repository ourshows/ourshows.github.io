import { auth, db, onAuthStateChanged, collection, addDoc, getDocs, doc, setDoc, serverTimestamp } from './firebase-wrapper.js';

// Global variables
let currentMovieId = null;
let currentMovieData = null;
let currentUser = null;
let userRating = null;

// Global Filter State
let allResults = [];
let currentFilter = 'all';

async function fetchTMDB(endpoint, params = {}) {
    if (window.PUBLIC_CONFIG && window.PUBLIC_CONFIG.TMDB_KEY) {
        const baseUrl = window.PUBLIC_CONFIG.TMDB_BASE_URL || "https://api.themoviedb.org/3";
        const url = new URL(`${baseUrl}${endpoint}`);
        url.searchParams.append('api_key', window.PUBLIC_CONFIG.TMDB_KEY);
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
    // Production Proxy Fallback
    const url = new URL('/api/tmdb', window.location.origin);
    url.searchParams.append('endpoint', endpoint);
    url.searchParams.append('language', 'en-US');
    url.searchParams.append('include_adult', 'false');
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Proxy API Error: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Proxy Fetch Error:', error);
        return null;
    }
}

// Init
document.addEventListener('DOMContentLoaded', () => {

    // Auth Listener
    onAuthStateChanged(auth, (user) => {
        currentUser = user; // Store globally
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

    // Update Display
    const queryDisplay = document.getElementById('queryDisplay');
    if (queryDisplay && query) queryDisplay.textContent = query;

    if (query) {
        performSearch(query);
    } else {
        document.getElementById('loading').style.display = 'none';

        // If no query, maybe show trending or just wait
        if (document.getElementById('emptyState')) {
            document.getElementById('emptyState').style.display = 'block';
            if (document.getElementById('resultsCount'))
                document.getElementById('resultsCount').textContent = 'Please enter a search term.';
        }
    }

    // Handle Nav Search (redirects to search page)
    const navInput = document.getElementById('navSearchInput');
    if (navInput) {
        navInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const newQuery = navInput.value.trim();
                if (newQuery) window.location.href = `search.html?q=${encodeURIComponent(newQuery)}`;
            }
        });
    }
});


// --- Filter Logic ---
window.filterResults = function (filter) {
    currentFilter = filter;

    // Update active button state
    document.querySelectorAll('.filter-chip').forEach(btn => {
        if (btn.textContent.toLowerCase().includes(filter === 'all' ? 'all' : (filter === 'movie' ? 'movie' : 'tv'))) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    renderResults(allResults);
}

// --- Search Logic ---
async function performSearch(query) {
    const loading = document.getElementById('loading');
    const container = document.getElementById('resultsContainer');
    const emptyState = document.getElementById('emptyState');
    // const countDisplay = document.getElementById('resultsCount'); 

    // Reset
    allResults = [];
    container.innerHTML = '';
    loading.style.display = 'block';
    emptyState.style.display = 'none';

    try {
        const data = await fetchTMDB('/search/multi', { query: query });
        loading.style.display = 'none';

        if (!data || !data.results || data.results.length === 0) {
            emptyState.style.display = 'block';
            return;
        }

        // Filter out people or incomplete data
        const validResults = data.results.filter(item =>
            (item.media_type === 'movie' || item.media_type === 'tv') &&
            item.poster_path
        );

        if (validResults.length === 0) {
            emptyState.style.display = 'block';
            return;
        }

        allResults = validResults;
        renderResults(allResults);

    } catch (error) {
        console.error("Search error:", error);
        loading.style.display = 'none';
        container.innerHTML = '<p class="error-msg">An error occurred while searching. Please try again.</p>';
    }
}

function renderResults(items) {
    const container = document.getElementById('resultsContainer');
    container.innerHTML = '';

    // Apply Filter
    let filteredItems = items;
    if (currentFilter !== 'all') {
        filteredItems = items.filter(item => item.media_type === currentFilter);
    }

    if (filteredItems.length === 0 && items.length > 0) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">No results for this category.</div>';
        return;
    }

    filteredItems.forEach(item => {
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
                    <button class="card-download-btn" style="margin-top: 0.5rem;" onclick="event.stopPropagation(); openMovieModal('${item.id}', '${item.media_type}')">
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

        card.onclick = () => openMovieModal(item.id, item.media_type);
        container.appendChild(card);
    });
}

// --- Full Modal Logic (Synced with main.js) ---
async function openMovieModal(id, type = 'movie') {
    currentMovieId = id;
    const modal = document.getElementById('movieModal');
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';

    // Fetch movie details
    const details = await fetchTMDB(`/${type}/${id}`, { append_to_response: 'videos,credits,reviews,similar' });
    if (!details) return;

    currentMovieData = details;
    currentMovieData.media_type = type; // Ensure type is set

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
                document.getElementById('modalFranchise').innerHTML = franchiseContent; // Note: similar-grid css class might be needed or flex styles
            }
        } catch (e) { console.error("Error fetching collection:", e); }
    }

    // Load cast
    loadCast(details.credits);

    // Load reviews
    loadReviews(details.reviews);

    // Load similar
    loadSimilar(details.similar);

    // Switch to Overview tab by default
    switchTab('overview');
}

function closeModal() {
    document.getElementById('movieModal').style.display = 'none';
    document.body.style.overflow = 'auto';
    currentMovieId = null;
    currentMovieData = null;
}

// --- Tabs Management ---
function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    // Show selected tab
    const selectedTab = document.getElementById(`tab-${tabName}`);
    if (selectedTab) selectedTab.style.display = 'block';

    // Find and activate the corresponding button
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => {
        const txt = btn.textContent.toLowerCase();
        if (txt.includes(tabName.toLowerCase()) ||
            (tabName === 'overview' && txt === 'overview') ||
            (tabName === 'cast' && txt.includes('cast')) ||
            (tabName === 'reviews' && txt === 'reviews') ||
            (tabName === 'similar' && txt === 'similar') ||
            (tabName === 'ai' && txt.includes('ai'))) {
            btn.classList.add('active');
        }
    });
}

// --- User Action Functions ---
function watchNow() {
    const mediaType = currentMovieData?.media_type || 'movie';
    window.location.href = `watchanddownload.html?id=${currentMovieId}&type=${mediaType}`;
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
        alert('Failed to add to watched list.');
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
        alert('Failed to add to watch later.');
    }
}

// --- Reviews ---
function rateMovie(rating) {
    userRating = rating;
    document.querySelectorAll('.rating-btn').forEach(btn => btn.classList.remove('selected'));
    document.querySelector(`.rating-btn[data-rating="${rating}"]`).classList.add('selected');
}

async function submitReview() {
    const reviewText = document.getElementById('reviewText').value;
    if (!userRating) { alert('Please select a rating!'); return; }
    if (!reviewText.trim()) { alert('Please write a review!'); return; }
    if (!currentUser) { alert('Please log in!'); window.location.href = 'login.html'; return; }

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
        alert('Review submitted!');
        document.getElementById('reviewText').value = '';
        userRating = null;
        document.querySelectorAll('.rating-btn').forEach(btn => btn.classList.remove('selected'));
    } catch (error) {
        console.error('Error submitting review:', error);
        alert('Failed to submit review.');
    }
}

// --- Collections ---
async function openAddToCollectionModal() {
    if (!currentUser) { alert('Please log in.'); window.location.href = 'login.html'; return; }
    const modal = document.getElementById('addToCollectionModal');
    const list = document.getElementById('userCollectionsList');
    if (modal) modal.style.display = 'block';

    list.innerHTML = '<div>Loading...</div>';

    try {
        const snap = await getDocs(collection(db, 'users', currentUser.uid, 'custom_collections'));
        list.innerHTML = '';
        if (snap.empty) {
            list.innerHTML = '<div style="padding:1rem;">No custom collections. <a href="collection.html">Create one</a></div>';
            return;
        }
        snap.forEach(doc => {
            const data = doc.data();
            const btn = document.createElement('button');
            btn.className = 'glass-button';
            btn.style.textAlign = 'left';
            btn.innerHTML = `<i class="fas fa-folder"></i> ${data.name}`;
            btn.onclick = () => addToCollectionConfirm(doc.id);
            list.appendChild(btn);
        });
    } catch (err) {
        console.error("Error loading collections:", err);
        list.innerHTML = '<div style="color:red;">Error loading collections.</div>';
    }
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
        document.getElementById('addToCollectionModal').style.display = 'none';
    } catch (err) {
        console.error("Error adding to collection:", err);
        alert('Failed to add to collection.');
    }
}

window.closeAddToCollectionModal = function () {
    document.getElementById('addToCollectionModal').style.display = 'none';
}


// --- AI Features ---
async function askAI() {
    const questionInput = document.getElementById('aiQuestion');
    const question = questionInput.value.trim();
    if (!question) return;

    const chatContainer = document.getElementById('aiChat');
    const userMsg = document.createElement('div');
    userMsg.className = 'ai-message user';
    userMsg.innerHTML = `<p>${question}</p>`;
    chatContainer.appendChild(userMsg);
    questionInput.value = '';
    chatContainer.scrollTop = chatContainer.scrollHeight;

    if (!window.callAI) {
        const errorMsg = document.createElement('div');
        errorMsg.className = 'ai-message ai';
        errorMsg.innerHTML = '<p>AI unavailable.</p>';
        chatContainer.appendChild(errorMsg);
        return;
    }

    const movieTitle = currentMovieData.title || currentMovieData.name;
    const movieYear = (currentMovieData.release_date || currentMovieData.first_air_date || '').split('-')[0];
    const systemPrompt = `You are a helper for "${movieTitle}" (${movieYear}). Answer concisely.`;

    try {
        const response = await window.callAI([{ role: 'user', content: question }], systemPrompt, false);
        const aiMsg = document.createElement('div');
        aiMsg.className = 'ai-message ai';
        aiMsg.innerHTML = `<p>${response}</p>`;
        chatContainer.appendChild(aiMsg);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    } catch (error) {
        const aiMsg = document.createElement('div');
        aiMsg.className = 'ai-message ai';
        aiMsg.innerHTML = '<p>Error occurred.</p>';
        chatContainer.appendChild(aiMsg);
    }
}


// --- Helper Loaders ---
function loadTrailer(videos) {
    const container = document.getElementById('modalTrailer');
    if (!container) return;
    if (!videos || !videos.results || videos.results.length === 0) {
        container.innerHTML = '';
        return;
    }
    const trailer = videos.results.find(v => v.type === 'Trailer' && v.site === 'YouTube') || videos.results[0];
    if (trailer) {
        container.innerHTML = `
            <div style="margin-bottom: 2rem;">
                <h3>Trailer</h3>
                <iframe width="100%" height="400" src="https://www.youtube.com/embed/${trailer.key}" 
                    frameborder="0" allow="accelerometer" allowfullscreen style="border-radius: 12px; margin-top: 1rem;"></iframe>
            </div>`;
    }
}

function loadGenres(genres) {
    const container = document.getElementById('modalGenres');
    if (!genres || genres.length === 0) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = `<div style="margin-bottom: 1.5rem;"><strong>Genres:</strong> ${genres.map(g => g.name).join(', ')}</div>`;
}

function loadCast(credits) {
    const container = document.getElementById('modalCast');
    if (!container) return;
    if (!credits || !credits.cast || credits.cast.length === 0) {
        container.innerHTML = '<p>No cast info.</p>';
        return;
    }
    container.innerHTML = credits.cast.slice(0, 12).map(p => `
        <div class="cast-card">
            <img src="${p.profile_path ? window.APP_CONFIG.TMDB_IMAGE_SMALL_URL + p.profile_path : 'https://via.placeholder.com/150x225'}" alt="${p.name}">
            <div style="font-weight: 600; font-size: 0.9rem;">${p.name}</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">${p.character}</div>
        </div>
    `).join('');
}

function loadReviews(reviews) {
    const container = document.getElementById('modalReviews');
    if (!container) return;
    if (!reviews || !reviews.results || reviews.results.length === 0) {
        container.innerHTML = '<p>No reviews yet.</p>';
        return;
    }
    container.innerHTML = reviews.results.slice(0, 5).map(r => `
        <div class="review-card">
            <div style="display: flex; justify-content: space-between;"><strong>${r.author}</strong><span>★ ${r.author_details.rating || 'N/A'}</span></div>
            <p style="color: var(--text-secondary);">${r.content.substring(0, 200)}...</p>
        </div>
    `).join('');
}

function loadSimilar(similar) {
    const container = document.getElementById('modalSimilar');
    if (!container) return;
    if (!similar || !similar.results || similar.results.length === 0) {
        container.innerHTML = '<p>No similar titles.</p>';
        return;
    }
    container.innerHTML = '';
    similar.results.slice(0, 10).forEach(item => {
        if (!item.poster_path) return;
        const card = document.createElement('div');
        card.className = 'media-card';
        card.style.minWidth = '140px';
        const title = item.title || item.name;
        card.innerHTML = `
            <div class="media-poster-container" style="height: 210px;">
                <img class="media-poster" src="${window.APP_CONFIG.TMDB_IMAGE_SMALL_URL}${item.poster_path}" loading="lazy">
            </div>
            <div class="media-info"><div class="media-title" style="font-size: 0.9rem;">${title}</div></div>
        `;
        card.onclick = () => openMovieModal(item.id, item.media_type);
        container.appendChild(card);
    });
}

// Window Assignments
window.switchTab = switchTab;
window.closeModal = closeModal;
window.openMovieModal = openMovieModal;
window.watchNow = watchNow;
window.addToWatchLater = addToWatchLater;
window.markAsWatched = markAsWatched;
window.openAddToCollectionModal = openAddToCollectionModal;
window.addToCollectionConfirm = addToCollectionConfirm;
window.closeAddToCollectionModal = closeAddToCollectionModal;
window.rateMovie = rateMovie;
window.submitReview = submitReview;
window.askAI = askAI;
