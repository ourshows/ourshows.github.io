
import { auth, db, addDoc, setDoc, doc, serverTimestamp, collection, onAuthStateChanged } from './firebase-wrapper.js';

// 1. Configuration & State
const appState = {
    filters: {
        type: 'Movie', // Default to Movie
        genre: 'All',
        language: 'All',
        year: 'All'
    },
    currentPage: 1,
    totalPages: 1000,
    isLoading: false
};

let currentMovieId = null;
let currentMovieData = null;
let userRating = null;
let currentUser = null;

// Listen for auth state
onAuthStateChanged(auth, user => {
    currentUser = user;
});

// Mappings for TMDB API
const GENRE_MAP = {
    'Action': 28,
    'Comedy': 35,
    'Drama': 18,
    'Sci-Fi': 878,
    'Thriller': 53
};

const LANG_MAP = {
    'Hindi': 'hi',
    'English': 'en',
    'Nepali': 'ne',
    'Korean': 'ko',
    'Chinese': 'zh'
};

// 2. Initialization
document.addEventListener('DOMContentLoaded', () => {
    if (!window.PUBLIC_CONFIG) {
        console.error("Public Config not loaded");
        // Could define fallback here if needed
    }

    setupFilters();
    loadItems(); // Initial Load
    setupInfiniteScroll();
});

// Expose functions to window (since this is a module)
window.closeModal = closeModal;
window.switchTab = switchTab;
window.rateMovie = rateMovie;
window.submitReview = submitReview;
window.markAsWatched = markAsWatched;
window.addToWatchLater = addToWatchLater;
window.watchNow = watchNow;
window.askAI = askAI;
window.openMovieModal = openMovieModal;

// 3. Setup Filter Listeners
function setupFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const filterType = e.target.dataset.filter;
            const value = e.target.dataset.value;

            // Update UI
            document.querySelectorAll(`.filter-btn[data-filter="${filterType}"]`).forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            // Update State
            appState.filters[filterType] = value;
            appState.currentPage = 1; // Reset to page 1

            // Clear Grid and Reload
            document.getElementById('discoverGrid').innerHTML = '';
            loadItems();
        });
    });
}

// 4. Fetch Helper
async function fetchTMDB(endpoint, params = {}) {
    // Determine Base URL & Key
    const publicConfig = window.PUBLIC_CONFIG || {};
    const appConfig = window.APP_CONFIG || {};

    const baseUrl = publicConfig.TMDB_BASE_URL || "https://api.themoviedb.org/3";
    const apiKey = publicConfig.TMDB_KEY || appConfig.TMDB_API_KEY || "798ae7de540b25e908c68ea2ca408347"; // Fallback key if config missing

    const url = new URL(`${baseUrl}${endpoint}`);
    url.searchParams.append('api_key', apiKey);
    url.searchParams.append('language', 'en-US'); // Default response lang

    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`TMDB API Error: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Fetch Error:', error);
        return null;
    }
}

// 5. Load Items Logic
async function loadItems() {
    if (appState.isLoading) return;
    appState.isLoading = true;

    const sentinel = document.getElementById('sentinel');
    sentinel.style.opacity = '1';

    try {
        const { type, genre, language, year } = appState.filters;
        const mediaType = (type === 'TV') ? 'tv' : 'movie';

        const params = {
            page: appState.currentPage,
            sort_by: 'popularity.desc',
            include_adult: 'false',
            without_keywords: '190370,9838,209700,155465,210065,155477,241932' // Filter adult keywords
        };

        // Strict filtering for general queries to block adult content
        // Relax filtering for specific languages known to have lower TMDB vote counts
        if (language === 'Nepali' || language === 'Hindi') {
            // Lower or no threshold for regional content where vote counts are naturally lower
            // keeping a small threshold to avoid absolute junk if needed, or removing it.
            // Let's remove it for Nepali to ensure content shows up.
            if (language !== 'Nepali') {
                params['vote_count.gte'] = '5';
            }
        } else {
            // Strict threshold for Korean, English, etc to block "adult" content
            params['vote_count.gte'] = '100';
        }


        if (genre !== 'All' && GENRE_MAP[genre]) {
            params.with_genres = GENRE_MAP[genre];
        }

        if (language !== 'All' && LANG_MAP[language]) {
            params.with_original_language = LANG_MAP[language];
        }

        if (year !== 'All') {
            if (mediaType === 'movie') {
                params.primary_release_year = year;
            } else {
                params.first_air_date_year = year;
            }
        }

        const data = await fetchTMDB(`/discover/${mediaType}`, params);

        if (data) {
            appState.totalPages = data.total_pages;

            if (data.results && data.results.length > 0) {
                renderGrid(data.results, mediaType);
                appState.currentPage++;
            } else if (appState.currentPage === 1) {
                document.getElementById('discoverGrid').innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #aaa;">No items found matching criteria.</p>';
            }
        }

    } catch (error) {
        console.error("Error loading items:", error);
    } finally {
        appState.isLoading = false;
        sentinel.style.opacity = '0';
    }
}

// 6. Render Grid
function renderGrid(items, mediaType) {
    const container = document.getElementById('discoverGrid');
    const imgBase = (window.PUBLIC_CONFIG && window.PUBLIC_CONFIG.TMDB_IMAGE_SMALL_URL) || "https://image.tmdb.org/t/p/w500";

    items.forEach(item => {
        if (!item.poster_path) return;
        if (item.adult) return;

        const title = item.title || item.name;
        const date = item.release_date || item.first_air_date || '';
        const year = date.split('-')[0];
        const watchLink = `watchanddownload.html?id=${item.id}&type=${mediaType}`;

        const card = document.createElement('div');
        card.className = 'media-card';
        card.innerHTML = `
            <div class="media-poster-container">
                <img class="media-poster" src="${imgBase}${item.poster_path}" loading="lazy" alt="${title}">
                <div class="card-rating-badge">${item.vote_average ? item.vote_average.toFixed(1) : ''} \u2605</div>
                <div class="card-overlay">
                    <button class="card-download-btn" onclick="event.stopPropagation(); window.location.href='${watchLink}'">
                        <i class="fas fa-play"></i> Watch
                    </button>
                    <button class="card-download-btn" style="margin-top: 0.5rem;" onclick="event.stopPropagation(); openMovieModal('${item.id}', '${mediaType}')">
                        <i class="fas fa-info-circle"></i> Details
                    </button>
                </div>
            </div>
            <div class="media-info">
                <div class="media-title" title="${title}">${title}</div>
                <div class="media-year" style="display:flex; justify-content:space-between; font-size:0.8rem; opacity:0.7;">
                    <span>${year}</span>
                    <span>${mediaType === 'tv' ? 'TV' : 'Movie'}</span>
                </div>
            </div>
        `;

        // Make whole card clickable for details
        card.onclick = () => openMovieModal(item.id, mediaType);

        container.appendChild(card);
    });
}

// 7. Infinite Scroll
function setupInfiniteScroll() {
    const sentinel = document.getElementById('sentinel');
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !appState.isLoading) {
            if (appState.currentPage <= appState.totalPages) {
                loadItems();
            }
        }
    }, { rootMargin: '200px' });

    observer.observe(sentinel);
}

// --- MODAL LOGIC (Adapted from view_all.js/main.js) ---

async function openMovieModal(id, type = 'movie') {
    currentMovieId = id;
    const modal = document.getElementById('movieModal');
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';

    // Fetch details
    const details = await fetchTMDB(`/${type}/${id}`, { append_to_response: 'videos,credits,reviews,similar' });
    if (!details) return;

    currentMovieData = details;
    currentMovieData.media_type = type;

    // Update Header
    const imgBase = (window.PUBLIC_CONFIG && window.PUBLIC_CONFIG.TMDB_IMAGE_SMALL_URL) || "https://image.tmdb.org/t/p/w500";
    document.getElementById('modalPoster').src = `${imgBase}${details.poster_path}`;
    document.getElementById('modalTitle').textContent = details.title || details.name;
    document.getElementById('modalRating').textContent = details.vote_average ? details.vote_average.toFixed(1) : 'N/A';
    document.getElementById('modalYear').textContent = (details.release_date || details.first_air_date || '').split('-')[0];
    document.getElementById('modalRuntime').textContent = details.runtime ? `${details.runtime} min` : '';
    document.getElementById('modalOverview').textContent = details.overview;

    // Load Sections
    loadTrailer(details.videos);
    loadGenres(details.genres);
    loadCast(details.credits);
    loadReviews(details.reviews);
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
    }); // Simple active class matching
}

function loadTrailer(videos) {
    const container = document.getElementById('modalTrailer');
    if (!videos || !videos.results || videos.results.length === 0) {
        container.innerHTML = '';
        return;
    }
    const trailer = videos.results.find(v => v.type === 'Trailer' && v.site === 'YouTube') || videos.results[0];
    if (trailer) {
        container.innerHTML = `
            <div style="margin-bottom: 2rem;">
                <h3>Trailer</h3>
                <iframe width="100%" height="300" src="https://www.youtube.com/embed/${trailer.key}" 
                    frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen style="border-radius: 12px; margin-top: 1rem;"></iframe>
            </div>
        `;
    } else {
        container.innerHTML = '';
    }
}

function loadGenres(genres) {
    const container = document.getElementById('modalGenres');
    if (!genres || genres.length === 0) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = `<strong>Genres:</strong> ${genres.map(g => g.name).join(', ')}`;
}

function loadCast(credits) {
    const container = document.getElementById('modalCast');
    if (!credits || !credits.cast || credits.cast.length === 0) {
        container.innerHTML = '<p>No cast information available.</p>';
        return;
    }
    const imgBase = (window.PUBLIC_CONFIG && window.PUBLIC_CONFIG.TMDB_IMAGE_SMALL_URL) || "https://image.tmdb.org/t/p/w500";
    container.innerHTML = credits.cast.slice(0, 10).map(person => `
        <div class="cast-card" style="min-width: 100px;">
            <img src="${person.profile_path ? imgBase + person.profile_path : 'https://via.placeholder.com/150x225?text=No+Image'}" 
                alt="${person.name}" style="width:100%; border-radius:8px;">
            <div style="font-weight: 600; font-size: 0.9rem; margin-top:0.5rem;">${person.name}</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">${person.character}</div>
        </div>
    `).join('');
}

function loadReviews(reviews) {
    const container = document.getElementById('modalReviews');
    if (!reviews || !reviews.results || reviews.results.length === 0) {
        container.innerHTML = '<p>No reviews yet.</p>';
        return;
    }
    container.innerHTML = reviews.results.slice(0, 3).map(review => `
        <div class="review-card" style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                <strong>${review.author}</strong>
                <span style="color: #ffd700;">\u2605 ${review.author_details.rating || 'N/A'}</span>
            </div>
            <p style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.5;">
                ${review.content.substring(0, 200)}${review.content.length > 200 ? '...' : ''}
            </p>
        </div>
    `).join('');
}

function loadSimilar(similar) {
    const container = document.getElementById('modalSimilar');
    if (!similar || !similar.results || similar.results.length === 0) {
        container.innerHTML = '<p>No similar titles found.</p>';
        return;
    }
    const imgBase = (window.PUBLIC_CONFIG && window.PUBLIC_CONFIG.TMDB_IMAGE_SMALL_URL) || "https://image.tmdb.org/t/p/w500";

    container.innerHTML = '';
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'media-scroller'; // Use scroll style
    scrollContainer.style.display = 'flex';
    scrollContainer.style.overflowX = 'auto';
    scrollContainer.style.gap = '1rem';
    scrollContainer.style.paddingBottom = '1rem';

    similar.results.slice(0, 10).forEach(item => {
        if (!item.poster_path) return;
        const card = document.createElement('div');
        card.className = 'media-card';
        card.style.minWidth = '140px';
        card.style.width = '140px';

        card.innerHTML = `
            <div class="media-poster-container">
                <img class="media-poster" src="${imgBase}${item.poster_path}" loading="lazy" alt="${item.title}">
            </div>
            <div class="media-title" style="font-size: 0.9rem; margin-top: 0.5rem;">${item.title || item.name}</div>
        `;
        card.onclick = () => openMovieModal(item.id, item.media_type || 'movie');
        scrollContainer.appendChild(card);
    });
    container.appendChild(scrollContainer);
}

function rateMovie(rating) {
    userRating = rating;
    document.querySelectorAll('.rating-btn').forEach(btn => btn.classList.remove('selected'));
    document.querySelector(`.rating-btn[data-rating="${rating}"]`).classList.add('selected');
}

async function submitReview() {
    const reviewText = document.getElementById('reviewText').value;
    if (!userRating) { alert('Please select a rating!'); return; }
    if (!reviewText.trim()) { alert('Please write a review!'); return; }
    if (!currentUser) {
        alert('Please log in first!');
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
        alert('Review submitted!');
        document.getElementById('reviewText').value = '';
        userRating = null;
        document.querySelectorAll('.rating-btn').forEach(btn => btn.classList.remove('selected'));
    } catch (e) {
        console.error("Review Error:", e);
        alert('Failed to submit review.');
    }
}

async function markAsWatched() {
    if (!currentUser) { alert('Login required'); window.location.href = 'login.html'; return; }
    try {
        await setDoc(doc(db, 'users', currentUser.uid, 'watched', String(currentMovieId)), {
            movieId: currentMovieId,
            movieTitle: currentMovieData.title || currentMovieData.name,
            posterPath: currentMovieData.poster_path,
            rating: currentMovieData.vote_average,
            mediaType: currentMovieData.media_type || 'movie',
            timestamp: serverTimestamp()
        });
        alert('Added to Watched List');
    } catch (e) { console.error(e); alert('Error adding to watched'); }
}

async function addToWatchLater() {
    if (!currentUser) { alert('Login required'); window.location.href = 'login.html'; return; }
    try {
        await setDoc(doc(db, 'users', currentUser.uid, 'watchlist', String(currentMovieId)), {
            movieId: currentMovieId,
            movieTitle: currentMovieData.title || currentMovieData.name,
            posterPath: currentMovieData.poster_path,
            rating: currentMovieData.vote_average,
            mediaType: currentMovieData.media_type || 'movie',
            timestamp: serverTimestamp()
        });
        alert('Added to Watchlist');
    } catch (e) { console.error(e); alert('Error adding to watchlist'); }
}

function watchNow() {
    if (currentMovieId) {
        window.location.href = `watchanddownload.html?id=${currentMovieId}&type=${currentMovieData?.media_type || 'movie'}`;
    }
}

function askAI() {
    const q = document.getElementById('aiQuestion').value;
    if (!q) return;
    const chat = document.getElementById('aiChat');
    chat.innerHTML += `<div style="margin-bottom:0.5rem;"><strong>You:</strong> ${q}</div>`;
    chat.innerHTML += `<div style="margin-bottom:0.5rem; color:var(--accent-color);"><strong>AI:</strong> That's a great question about ${currentMovieData.title}! (AI Connection Placeholder)</div>`;
    document.getElementById('aiQuestion').value = '';
}
