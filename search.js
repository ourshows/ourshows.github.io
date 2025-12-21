import { auth, db, onAuthStateChanged, collection, addDoc, getDocs, doc, setDoc, serverTimestamp, query, where, orderBy } from './firebase-wrapper.js';

// Global variables
let currentMovieId = null;
let currentMovieData = null;
let currentUser = null;
let userRating = null;

// Global Filter State
let allResults = [];
let currentFilter = 'all';

async function fetchTMDB(endpoint, params = {}) {
    if (window.PUBLIC_CONFIG && (window.PUBLIC_CONFIG.TMDB_KEY || window.PUBLIC_CONFIG.TMDB_API_KEY)) {
        const baseUrl = window.PUBLIC_CONFIG.TMDB_BASE_URL || "https://api.themoviedb.org/3";
        const url = new URL(`${baseUrl}${endpoint}`);
        const apiKey = window.PUBLIC_CONFIG.TMDB_KEY || window.PUBLIC_CONFIG.TMDB_API_KEY;
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
document.addEventListener('DOMContentLoaded', async () => {
    if (window.ourShowLoader) window.ourShowLoader.show();

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
        await performSearch(query);
    } else {
        document.getElementById('loading').style.display = 'none';

        // If no query, maybe show trending or just wait
        if (document.getElementById('emptyState')) {
            document.getElementById('emptyState').style.display = 'block';
            if (document.getElementById('resultsCount'))
                document.getElementById('resultsCount').textContent = 'Please enter a search term.';
        }
    }

    if (window.ourShowLoader) window.ourShowLoader.hide();

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

    // Handle Mobile Search with Dropdown
    const mobileInput = document.getElementById('mobileSearchInput');
    const mobileDropdown = document.getElementById('mobileSearchDropdown');
    let mobileSearchTimeout;

    if (mobileInput && mobileDropdown) {
        mobileInput.addEventListener('input', (e) => {
            clearTimeout(mobileSearchTimeout);
            const query = e.target.value.trim();

            if (query.length < 2) {
                mobileDropdown.style.display = 'none';
                return;
            }

            mobileSearchTimeout = setTimeout(async () => {
                try {
                    const data = await fetchTMDB('/search/multi', { query: query });
                    if (data && data.results && data.results.length > 0) {
                        const validResults = data.results
                            .filter(item => (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path)
                            .slice(0, 5);

                        if (validResults.length > 0) {
                            mobileDropdown.innerHTML = validResults.map(item => {
                                const title = item.title || item.name;
                                const year = (item.release_date || item.first_air_date || '').split('-')[0];
                                const type = item.media_type === 'tv' ? 'TV Show' : 'Movie';
                                const poster = window.APP_CONFIG.TMDB_IMAGE_SMALL_URL + item.poster_path;

                                return `
                                    <div class="mobile-search-item" data-id="${item.id}" data-type="${item.media_type}">
                                        <img src="${poster}" class="mobile-search-poster" alt="${title}">
                                        <div class="mobile-search-info">
                                            <div class="mobile-search-title">${title}</div>
                                            <div class="mobile-search-meta">${year} • ${type}</div>
                                        </div>
                                    </div>
                                `;
                            }).join('');

                            // Add click handlers
                            mobileDropdown.querySelectorAll('.mobile-search-item').forEach(item => {
                                item.addEventListener('click', () => {
                                    const id = item.getAttribute('data-id');
                                    const type = item.getAttribute('data-type');
                                    mobileDropdown.style.display = 'none';
                                    mobileInput.value = '';
                                    openMovieModal(id, type);
                                });
                            });

                            mobileDropdown.style.display = 'block';
                        } else {
                            mobileDropdown.style.display = 'none';
                        }
                    } else {
                        mobileDropdown.style.display = 'none';
                    }
                } catch (error) {
                    console.error('Mobile search error:', error);
                    mobileDropdown.style.display = 'none';
                }
            }, 300);
        });

        // Handle Enter key
        mobileInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = mobileInput.value.trim();
                if (query) {
                    mobileDropdown.style.display = 'none';
                    window.location.href = `search.html?q=${encodeURIComponent(query)}`;
                }
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!mobileInput.contains(e.target) && !mobileDropdown.contains(e.target)) {
                mobileDropdown.style.display = 'none';
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
        const year = (item.release_date || item.first_air_date || '').split('-')[0];

        // Calculate verdict for poster
        const verdict = calculateVerdict(item);

        card.innerHTML = `
            <div class="media-poster-container">
                <img class="media-poster" src="${posterUrl}" loading="lazy" alt="${title}">
                <div class="card-rating-badge" style="color: ${getVerdictColor(verdict.text)};">${verdict.text}</div>
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

    // Load reviews (Now async and needs ID)
    loadReviews(details.reviews, id);

    // Load similar
    loadSimilar(details.similar);

    // Load Similar
    loadSimilar(details.similar);

    // INJECT VERDICT BADGE AND GAUGE
    const verdict = calculateVerdict(details);

    // Update Badge (Header)
    const ratingEl = document.getElementById('modalRating');
    const existingBadge = ratingEl.parentNode.querySelector('.verdict-badge');
    if (existingBadge) existingBadge.remove();
    const badge = document.createElement('span');
    badge.className = `verdict-badge ${verdict.class}`;
    badge.textContent = verdict.text;
    badge.style.marginLeft = '0.5rem';
    badge.style.fontSize = '0.8rem';
    badge.style.padding = '2px 6px';
    badge.style.borderRadius = '4px';
    ratingEl.parentNode.appendChild(badge);

    // Render Verdict Meter
    renderVerdictMeter(details, verdict);

    // Reset Buttons
    const watchLaterBtn = document.getElementById('modalWatchLaterBtn');
    const watchedBtn = document.getElementById('modalWatchedBtn');

    if (watchLaterBtn) {
        watchLaterBtn.style.background = 'rgba(255, 255, 255, 0.1)';
        watchLaterBtn.style.color = 'white';
        watchLaterBtn.innerHTML = '<i class="fas fa-plus"></i> My List';
        watchLaterBtn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    }
    if (watchedBtn) {
        watchedBtn.style.background = 'rgba(255, 255, 255, 0.1)';
        watchedBtn.style.color = 'white';
        watchedBtn.innerHTML = '<i class="fas fa-check"></i> Mark Watched';
        watchedBtn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    }

    // Check Persistent State
    if (currentUser) {
        try {
            const watchedDoc = await getDoc(doc(db, 'users', currentUser.uid, 'watched', String(id)));
            if (watchedDoc.exists()) {
                if (watchedBtn) {
                    watchedBtn.style.background = '#22c55e';
                    watchedBtn.style.color = '#fff';
                    watchedBtn.innerHTML = '<i class="fas fa-check"></i> Watched';
                    watchedBtn.style.borderColor = '#22c55e';
                }
            }

            const watchlistDoc = await getDoc(doc(db, 'users', currentUser.uid, 'watchlist', String(id)));
            if (watchlistDoc.exists()) {
                if (watchLaterBtn) {
                    watchLaterBtn.style.background = '#eab308';
                    watchLaterBtn.style.color = '#000';
                    watchLaterBtn.innerHTML = '<i class="fas fa-check"></i> Added';
                    watchLaterBtn.style.borderColor = '#eab308';
                }
            }
        } catch (e) {
            console.error("Error checking item state:", e);
        }
    }

    // Switch to Overview tab by default
    switchTab('overview');
}

// --- VERDICT SYSTEMS ---

function calculateVerdict(details) {
    const rating = details.vote_average || 0;
    const votes = details.vote_count || 0;
    const popularity = details.popularity || 0;

    // "Perfection": High rating + High engagement
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

function getVerdictColor(text) {
    if (text === 'Perfection') return '#ffd700';
    if (text === 'Go for it') return '#22c55e';
    if (text === 'One time watch') return '#f59e0b';
    return '#ef4444'; // Skip
}

function renderVerdictMeter(details, verdict) {
    const containers = [
        document.getElementById('pcVerdictMeter'),
        document.getElementById('mobileVerdictMeter')
    ];

    const rating = details.vote_average || 0;
    const rotation = (rating / 10) * 180 - 90;

    const html = `
        <div class="verdict-gauge">
            <div class="gauge-needle" style="transform: translateX(-50%) rotate(${rotation}deg)"></div>
        </div>
        <div class="verdict-label" style="color: ${getVerdictColor(verdict.text)}">${verdict.text}</div>
        <div class="verdict-subtext">${rating.toFixed(1)}/10 based on TMDB</div>
    `;

    containers.forEach(container => {
        if (container) container.innerHTML = html;
    });
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
    const btn = document.getElementById('modalWatchedBtn');
    try {
        const docRef = doc(db, 'users', currentUser.uid, 'watched', String(currentMovieId));
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            // UNDO
            await deleteDoc(docRef);
            if (btn) {
                btn.style.background = 'rgba(255, 255, 255, 0.1)';
                btn.style.color = 'white';
                btn.innerHTML = '<i class="fas fa-check"></i> Mark Watched';
                btn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }
        } else {
            // DO
            await setDoc(docRef, {
                movieId: currentMovieId,
                movieTitle: currentMovieData.title || currentMovieData.name,
                posterPath: currentMovieData.poster_path,
                rating: currentMovieData.vote_average,
                mediaType: currentMovieData.media_type || 'movie',
                genres: currentMovieData.genres || [],
                timestamp: serverTimestamp()
            });
            if (btn) {
                btn.style.background = '#22c55e'; // Green
                btn.style.color = '#fff';
                btn.innerHTML = '<i class="fas fa-check"></i> Watched';
                btn.style.borderColor = '#22c55e';
            }
        }
    } catch (error) {
        console.error('Error toggling watched status:', error);
    }
}

async function addToWatchLater() {
    if (!currentUser) {
        alert('Please log in to add to watch later!');
        window.location.href = 'login.html';
        return;
    }
    const btn = document.getElementById('modalWatchLaterBtn');
    try {
        const docRef = doc(db, 'users', currentUser.uid, 'watchlist', String(currentMovieId));
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            // UNDO
            await deleteDoc(docRef);
            if (btn) {
                btn.style.background = 'rgba(255, 255, 255, 0.1)';
                btn.style.color = 'white';
                btn.innerHTML = '<i class="fas fa-plus"></i> My List';
                btn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }
        } else {
            // DO
            await setDoc(docRef, {
                movieId: currentMovieId,
                movieTitle: currentMovieData.title || currentMovieData.name,
                posterPath: currentMovieData.poster_path,
                rating: currentMovieData.vote_average,
                mediaType: currentMovieData.media_type || 'movie',
                genres: currentMovieData.genres || [],
                timestamp: serverTimestamp()
            });
            if (btn) {
                btn.style.background = '#eab308'; // Yellow
                btn.style.color = '#000';
                btn.innerHTML = '<i class="fas fa-check"></i> Added';
                btn.style.borderColor = '#eab308';
            }
        }
    } catch (error) {
        console.error('Error toggling watch later status:', error);
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
        await loadReviews(currentMovieData.reviews, currentMovieId);
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

// --- Review Helpers ---
function getVerdictFromRating(rating) {
    if (!rating) return { text: 'N/A', class: '' };
    if (rating >= 8.0) return { text: 'Perfection', class: 'verdict-perfection' };
    if (rating >= 6.8) return { text: 'Go for it', class: 'verdict-go' };
    if (rating >= 5.0) return { text: 'One time watch', class: 'verdict-once' };
    return { text: 'Skip', class: 'verdict-skip' };
}

async function loadReviews(tmdbReviews, movieId) {
    const container = document.getElementById('modalReviews');
    if (!container) return;
    container.innerHTML = '<p style="text-align:center;">Loading reviews...</p>';

    // 1. Fetch Firebase Reviews
    let firebaseReviews = [];
    try {
        if (!movieId) throw new Error('No Movie ID');
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
    } catch (e) { console.error(e); }

    // 2. Process TMDB Reviews
    const tmdbResults = (tmdbReviews && tmdbReviews.results) ? tmdbReviews.results.map(r => ({
        id: r.id,
        author: r.author,
        content: r.content,
        rating: r.author_details.rating,
        avatar_path: r.author_details.avatar_path,
        source: 'tmdb',
        timestamp: new Date(r.created_at || 0)
    })) : [];

    // 3. Merge
    const combined = [...firebaseReviews, ...tmdbResults];

    if (combined.length === 0) {
        container.innerHTML = '<p>No reviews yet.</p>';
        return;
    }

    container.innerHTML = combined.slice(0, 10).map(review => {
        // Data Mapping
        const author = review.source === 'ourshow' ? review.username : review.author;
        const rating = review.source === 'ourshow' ? review.rating : review.rating;
        const content = review.source === 'ourshow' ? review.review : review.content;

        // Verdict Logic
        let verdictHTML = '';
        if (rating) {
            let v = { text: 'N/A', class: '' };
            const numRating = parseFloat(rating);
            if (!isNaN(numRating) && typeof rating !== 'string') {
                v = getVerdictFromRating(numRating);
            } else if (typeof rating === 'string') {
                if (rating === 'Perfection') v = { text: 'Perfection', class: 'verdict-perfection' };
                else if (rating === 'Go for it') v = { text: 'Go for it', class: 'verdict-go' };
                else if (rating === 'One time watch' || rating === 'One Time Watch') v = { text: 'One time watch', class: 'verdict-once' };
                else if (rating === 'Pass') v = { text: 'Pass', class: 'verdict-pass' };
                else if (!isNaN(numRating)) v = getVerdictFromRating(numRating);
            }
            if (v.text !== 'N/A') {
                verdictHTML = `<span class="review-verdict-badge ${v.class}" style="font-size: 0.7rem; padding: 2px 6px;">${v.text}</span>`;
            }
        }

        const maxChars = 200;
        const isLong = content.length > maxChars;
        const shortContent = isLong ? content.substring(0, maxChars) + '...' : content;
        const reviewId = `review-srch-${review.id || Math.random()}`;

        return `
        <div class="review-card" id="${reviewId}" style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; ${review.source === 'ourshow' ? 'border-left: 3px solid var(--primary-color);' : ''}">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; align-items: center;">
                <strong>${author}</strong>
                ${verdictHTML}
            </div>
            <div class="review-content" style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.5;">
                <span class="content-short">${shortContent}</span>
                ${isLong ? `<span class="content-full" style="display:none;">${content}</span>
                            <span class="read-more-btn" onclick="toggleReview('${reviewId}')">Read More</span>` : ''}
            </div>
        </div>
    `}).join('');
}

// Global Toggle (Safe to redefine)
if (!window.toggleReview) {
    window.toggleReview = function (id) {
        const card = document.getElementById(id);
        if (!card) return;
        const short = card.querySelector('.content-short');
        const full = card.querySelector('.content-full');
        const btn = card.querySelector('.read-more-btn');

        if (full.style.display === 'none') {
            full.style.display = 'inline';
            short.style.display = 'none';
            btn.textContent = 'Read Less';
        } else {
            full.style.display = 'none';
            short.style.display = 'inline';
            btn.textContent = 'Read More';
        }
    };
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
