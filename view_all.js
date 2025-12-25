import { auth, db, addDoc, setDoc, doc, getDoc, serverTimestamp, collection, onAuthStateChanged, query, where, orderBy, getDocs } from './firebase-wrapper.js';

let currentPage = 1;
let currentCategory = '';
let isLoading = false;
let hasMore = true;
let currentMovieId = null;
let currentMovieData = null;
let userRating = null;
let currentUser = auth.currentUser;

// Listen for auth state
onAuthStateChanged(auth, user => {
    currentUser = user;
});

document.addEventListener('DOMContentLoaded', () => {
    // Default Configuration Fallback
    if (!window.APP_CONFIG) {
        // Try to recover config if possible or rely on public-config
        if (window.PUBLIC_CONFIG) {
            window.APP_CONFIG = window.PUBLIC_CONFIG;
        } else {
            console.warn("Config not found in view_all, using default configuration.");
            window.APP_CONFIG = {
                TMDB_IMAGE_BASE_URL: "https://image.tmdb.org/t/p/original",
                TMDB_IMAGE_SMALL_URL: "https://image.tmdb.org/t/p/w500",
                TMDB_BASE_URL: "https://api.themoviedb.org/3",
                TMDB_API_KEY: "798ae7de540b25e908c68ea2ca408347"
            };
        }
    }

    const urlParams = new URLSearchParams(window.location.search);
    currentCategory = urlParams.get('category');

    if (!currentCategory) {
        currentCategory = 'trending';
    }

    updateTitle(currentCategory);

    // Initial Load
    loadContent(currentCategory, currentPage);

    // Setup Intersection Observer for Infinite Scroll
    const sentinel = document.getElementById('loadingSentinel');
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !isLoading && hasMore) {
            currentPage++;
            loadContent(currentCategory, currentPage);
        }
    }, { rootMargin: '200px' });

    if (sentinel) observer.observe(sentinel);
});

// Expose functions to window
window.closeModal = closeModal;
window.switchTab = switchTab;
window.rateMovie = rateMovie;
window.submitReview = submitReview;
window.markAsWatched = markAsWatched;
window.addToWatchLater = addToWatchLater;
window.watchNow = watchNow;
window.askAI = askAI;
window.openMovieModal = openMovieModal;
window.toggleReview = toggleReview;
window.openAddToCollectionModal = openAddToCollectionModal;
window.closeAddToCollectionModal = closeAddToCollectionModal;
window.addToCollectionConfirm = addToCollectionConfirm;

// Toggle review read more/less
// Toggle review read more/less
function toggleReview(reviewId) {
    const card = document.getElementById(reviewId);
    if (!card) return;

    const short = card.querySelector('.content-short');
    const full = card.querySelector('.content-full');
    const btn = card.querySelector('.read-more-btn');

    if (!short || !full || !btn) return;

    if (full.style.display === 'none') {
        full.style.display = 'inline';
        short.style.display = 'none';
        btn.textContent = 'Read Less';
    } else {
        full.style.display = 'none';
        short.style.display = 'inline';
        btn.textContent = 'Read More';
    }
}

function updateTitle(category) {
    const titles = {
        'trending': 'Trending Now',
        'popular': 'Popular Movies',
        'top_rated': 'Top Rated',
        'upcoming': 'Coming Soon',
        'now_playing': 'Now in Theaters',
        'nepali': 'Nepali Hits 🇳🇵',
        'hindi': 'Bollywood & Hindi 🇮🇳',
        'new_to_stream': 'New to Stream',
        'highest_grossing': 'Highest Grossing',
        'cult_classics': 'Cult Classics',
        'underrated_gems': 'Underrated Gems',
        'action_thrillers': 'Action & Thrillers',
        'drama_romance': 'Drama & Romance'
    };
    document.getElementById('pageTitle').textContent = titles[category] || category.replace(/_/g, ' ').toUpperCase();
}

async function loadContent(category, page) {
    if (isLoading || !hasMore) return;
    isLoading = true;

    const sentinel = document.getElementById('loadingSentinel');
    if (sentinel) sentinel.style.opacity = '1';

    try {
        let endpoint = '';
        let params = { page: page };

        // Logic matched from main.js/custom_lists.js logic would be better, but we simplify here
        // If it's a known non-standard list, we might need custom logic.
        // For standard TMDB endpoints:
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
            // Add other cases like 'new_to_stream' etc. if we can dynamically build them
            case 'new_to_stream':
                endpoint = '/discover/movie';
                const threeMonthsAgo = new Date();
                threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
                params['primary_release_date.gte'] = threeMonthsAgo.toISOString().split('T')[0];
                params.sort_by = 'popularity.desc';
                break;
            case 'highest_grossing':
                endpoint = '/discover/movie';
                params['primary_release_date.gte'] = '2020-01-01';
                params.sort_by = 'revenue.desc';
                break;
            default:
                // For custom lists (cult_classics etc), we can't easily pagination without the ID list.
                // If it's a manual list, view_all fails unless we pass the list.
                // Currently, we'll default to discovery if unknown.
                if (!endpoint) {
                    endpoint = '/discover/movie';
                    params.sort_by = 'popularity.desc';
                }
        }

        const data = await fetchTMDB(endpoint, params);

        if (data && data.results && data.results.length > 0) {
            renderGrid(data.results);
            if (page >= data.total_pages) {
                hasMore = false;
                if (sentinel) sentinel.style.display = 'none';
            }
        } else {
            hasMore = false;
            if (sentinel) sentinel.style.display = 'none';
        }
    } catch (error) {
        console.error("Error loading content:", error);
    } finally {
        isLoading = false;
        if (sentinel && hasMore) sentinel.style.opacity = '0';
    }
}

async function fetchTMDB(endpoint, params = {}) {
    // 1. Priority: Client-Side Direct Call (Public/App Config)
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

    // 2. Fallback: Dev/Local Direct Call
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal && window.APP_CONFIG && window.APP_CONFIG.TMDB_API_KEY) {
        const baseUrl = window.APP_CONFIG.TMDB_BASE_URL || "https://api.themoviedb.org/3";
        const url = new URL(`${baseUrl}${endpoint}`);
        url.searchParams.append('api_key', window.APP_CONFIG.TMDB_API_KEY);
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

    // 3. Fallback: Proxy
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
}

function renderGrid(items) {
    const container = document.getElementById('mediaGrid');

    items.forEach(item => {
        if (!item.poster_path) return;

        const card = document.createElement('div');
        card.className = 'media-card';

        // Calculate verdict for poster
        const verdict = calculateVerdict(item);

        const title = item.title || item.name;
        // const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A'; // Replaced by Verdict
        const year = (item.release_date || item.first_air_date || '').split('-')[0];
        const mediaType = item.media_type || 'movie';

        card.innerHTML = `
            <div class="media-poster-container">
                <img class="media-poster" src="${window.APP_CONFIG.TMDB_IMAGE_SMALL_URL}${item.poster_path}" loading="lazy" alt="${title}">
                <div class="card-rating-badge" style="color: ${getVerdictColor(verdict.text)};">${verdict.text}</div>
                 <div class="card-overlay">
                    <button class="card-download-btn" onclick="event.stopPropagation(); window.location.href='watchanddownload.html?id=${item.id}&type=${mediaType}'">
                        <i class="fas fa-play"></i> Watch
                    </button>
                    <button class="card-download-btn" style="margin-top: 0.5rem;" onclick="event.stopPropagation(); openMovieModal('${item.id}', '${mediaType}')">
                        <i class="fas fa-info-circle"></i> Details
                    </button>
                </div>
            </div>
            <div class="media-info">
                <div class="media-title" title="${title}">${title}</div>
                <div class="media-year" style="display:flex; justify-content:space-between;">
                    <span>${year}</span>
                    <span>${mediaType === 'tv' ? 'TV' : 'Movie'}</span>
                </div>
            </div>
        `;

        card.onclick = () => openMovieModal(item.id, mediaType);
        container.appendChild(card);
    });
}

// --- Modal Logic ---

async function openMovieModal(id, type = 'movie') {
    currentMovieId = id;
    const modal = document.getElementById('movieModal');
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';

    // Fetch movie details
    const details = await fetchTMDB(`/${type}/${id}`, { append_to_response: 'videos,credits,reviews,similar' });
    if (!details) return;

    currentMovieData = details;
    currentMovieData.media_type = type;

    // Update modal header
    document.getElementById('modalPoster').src = `${window.APP_CONFIG.TMDB_IMAGE_SMALL_URL}${details.poster_path}`;
    document.getElementById('modalTitle').textContent = details.title || details.name;
    document.getElementById('modalRating').textContent = details.vote_average ? details.vote_average.toFixed(1) : 'N/A';
    document.getElementById('modalYear').textContent = (details.release_date || details.first_air_date || '').split('-')[0];
    document.getElementById('modalRuntime').textContent = details.runtime ? `${details.runtime} min` : '';
    // Update Overview (Text version)
    document.getElementById('modalOverviewText').textContent = details.overview;

    // Load sections
    loadTrailer(details.videos);
    loadGenres(details.genres);
    loadCast(details.credits);
    loadReviews(details.reviews, id);
    loadSimilar(details.similar);

    // Initial Verdict Calculation
    const verdict = calculateVerdict(details);
    // Render Gauge (Text Only)
    renderVerdictMeter(details, verdict);

    // Reset Buttons
    const watchLaterBtn = document.getElementById('modalWatchLaterBtn');
    const watchedBtn = document.getElementById('modalWatchedBtn');

    if (watchLaterBtn) {
        watchLaterBtn.style.background = 'rgba(255, 255, 255, 0.1)';
        watchLaterBtn.style.color = 'white';
        watchLaterBtn.innerHTML = '<i class="fas fa-clock"></i> Watch Later';
        watchLaterBtn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    }
    if (watchedBtn) {
        watchedBtn.style.background = 'rgba(255, 255, 255, 0.1)';
        watchedBtn.style.color = 'white';
        watchedBtn.innerHTML = '<i class="fas fa-check"></i> Watched';
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

    // Activate button
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => {
        if (btn.textContent.toLowerCase().includes(tabName.toLowerCase()) ||
            btn.onclick.toString().includes(tabName)) {
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
        <div class="cast-card" style="cursor: pointer;" onclick="window.location.href='cast.html?id=${person.id}'">
            <img src="${person.profile_path ? window.APP_CONFIG.TMDB_IMAGE_SMALL_URL + person.profile_path : 'https://via.placeholder.com/150x225?text=No+Image'}" 
                alt="${person.name}">
            <div style="font-weight: 600; font-size: 0.9rem;">${person.name}</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">${person.character}</div>
        </div>
    `).join('');
}

// Verdict Logic
function calculateVerdict(details) {
    const rating = details.vote_average || 0;
    const votes = details.vote_count || 0;
    const popularity = details.popularity || 0;

    if (rating >= 8.0 && (votes >= 500 || popularity >= 100)) {
        return { text: "Perfection", class: "verdict-perfection" };
    }
    if (rating >= 6.8) {
        return { text: "Go for it", class: "verdict-go" };
    }
    if (rating >= 5.0) {
        return { text: "One time watch", class: "verdict-once" };
    }
    return { text: "Skip", class: "verdict-skip" };
}

function renderVerdictMeter(details, verdict) {
    const containers = [
        document.getElementById('pcVerdictMeter'),
        document.getElementById('mobileVerdictMeter')
    ];

    const rating = details.vote_average || 0;

    // Text-Only Verdict
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

function getVerdictFromRating(rating) {
    const numRating = parseFloat(rating);
    if (isNaN(numRating)) return { text: 'N/A', class: '' };
    if (numRating >= 8.0) return { text: 'Perfection', class: 'verdict-perfection' };
    if (numRating >= 6.8) return { text: 'Go for it', class: 'verdict-go' };
    if (numRating >= 5.0) return { text: 'One time watch', class: 'verdict-once' };
    return { text: 'Skip', class: 'verdict-skip' };
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
        const shortContent = isLong ? content.substring(0, maxLength) + '...' : content;
        const reviewId = `review-viewall-${review.id || Math.random().toString(36).substr(2, 9)}`;

        return `
            <div class="review-card" id="${reviewId}" style="${review.source === 'ourshow' ? 'border-left: 3px solid var(--primary-color);' : ''}">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <strong style="display:flex; gap:0.5rem; align-items:center;">
                        <img class="review-avatar" src="${avatarUrl}" alt="${author}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;"> ${author}
                    </strong>
                    ${verdictHTML}
                </div>
                <div class="review-content" style="color: var(--text-secondary); line-height: 1.6;">
                    <span class="content-short">${shortContent}</span>
                    ${isLong ? `<span class="content-full" style="display:none;">${content}</span>
                                <span class="read-more-btn" style="color:var(--primary-color); cursor:pointer; margin-left:5px;" onclick="toggleReview('${reviewId}')">Read More</span>` : ''}
                </div>
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
    // Reuse renderGrid logic but for similar container. 
    // Since renderGrid targets 'mediaGrid', we inline here or reuse if we made it generic.
    // For simplicity, inline similar rendering:
    similarContainer.innerHTML = '';

    // We want a scrollable row typically, but modalSimilar in view_all.html likely expects a grid or scroller.
    // view_all.html uses "media-scroller" class for modalSimilar. 
    // renderGrid uses grid. Let's make similar a scroller.

    similar.results.slice(0, 10).forEach(item => {
        if (!item.poster_path) return;
        const card = document.createElement('div');
        card.className = 'media-card';
        // card.style.minWidth = '160px'; // Removed for grid layout
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
        const btn = document.getElementById('modalWatchedBtn');
        if (btn) {
            btn.style.background = '#22c55e'; // Green
            btn.style.color = '#fff';
            btn.innerHTML = '<i class="fas fa-check"></i> Watched';
            btn.style.borderColor = '#22c55e';
        }
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
        const btn = document.getElementById('modalWatchLaterBtn');
        if (btn) {
            btn.style.background = '#eab308'; // Yellow
            btn.style.color = '#000';
            btn.innerHTML = '<i class="fas fa-check"></i> Added';
            btn.style.borderColor = '#eab308';
        }
    } catch (error) {
        console.error('Error adding to watch later:', error);
        alert('Failed to add to watch later. Please try again.');
    }
}

function watchNow() {
    if (!currentMovieId || !currentMovieData) {
        alert('Movie information not available');
        return;
    }
    const mediaType = currentMovieData.media_type || 'movie';
    window.location.href = `watchanddownload.html?id=${currentMovieId}&type=${mediaType}`;
}

async function askAI() {
    const questionInput = document.getElementById('aiQuestion');
    const question = questionInput.value.trim();
    if (!question) return;

    const chatContainer = document.getElementById('aiChat');

    // Add User Message
    chatContainer.innerHTML += `
        <div class="ai-message user" style="text-align: right; margin-bottom: 0.5rem;">
            <div style="background: var(--primary-color); display: inline-block; padding: 0.5rem 1rem; border-radius: 12px 12px 0 12px;">${question}</div>
        </div>`;

    questionInput.value = '';
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // Show Loading
    const loadingId = 'ai-loading-' + Date.now();
    chatContainer.innerHTML += `
        <div id="${loadingId}" class="ai-message ai" style="margin-bottom: 0.5rem;">
             <div style="background: rgba(255,255,255,0.1); display: inline-block; padding: 0.5rem 1rem; border-radius: 12px 12px 12px 0;">
                <i class="fas fa-circle-notch fa-spin"></i> Thinking...
             </div>
        </div>`;
    chatContainer.scrollTop = chatContainer.scrollHeight;

    try {
        const movieContext = `Movie: ${currentMovieData.title || currentMovieData.name} (${(currentMovieData.release_date || currentMovieData.first_air_date || '').split('-')[0]}). 
        Overview: ${currentMovieData.overview}. 
        Rating: ${currentMovieData.vote_average}.`;

        const systemPrompt = `You are an intelligent movie assistant. The user is asking about the following movie:
        ${movieContext}
        Keep your answer concise, engaging, and relevant to this specific movie. Avoid spoilers unless asked.`;

        const messages = [{ role: 'user', content: question }];

        // Use window.callAI from ai.js if available, else simulated response
        let reply = "I'm sorry, I can't connect to the analytics engine right now.";

        if (window.callAI) {
            reply = await window.callAI(messages, systemPrompt);
        } else {
            // Fallback if ai.js failed to load
            reply = "AI System Offline. Please check your connection.";
            console.error("ai.js not loaded or callAI not found");
        }

        // Remove loading
        const loader = document.getElementById(loadingId);
        if (loader) loader.remove();

        // Add AI Response
        chatContainer.innerHTML += `
            <div class="ai-message ai" style="margin-bottom: 0.5rem;">
                <div style="background: rgba(255,255,255,0.1); display: inline-block; padding: 0.5rem 1rem; border-radius: 12px 12px 12px 0;">
                    <strong>AI:</strong> ${reply}
                </div>
            </div>`;

    } catch (error) {
        const loader = document.getElementById(loadingId);
        if (loader) loader.remove();

        chatContainer.innerHTML += `
            <div class="ai-message ai error" style="margin-bottom: 0.5rem;">
                <div style="color: #ff6b6b;">Error: ${error.message || "Something went wrong."}</div>
            </div>`;
    }

    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// --- Collections ---
async function openAddToCollectionModal() {
    if (!currentUser) { alert('Please log in.'); window.location.href = 'login.html'; return; }
    const modal = document.getElementById('addToCollectionModal');
    const list = document.getElementById('userCollectionsList');
    if (modal) modal.style.display = 'block';

    if (list) list.innerHTML = '<div>Loading...</div>';

    try {
        const snap = await getDocs(collection(db, 'users', currentUser.uid, 'custom_collections'));
        if (list) list.innerHTML = '';
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

function closeAddToCollectionModal() {
    document.getElementById('addToCollectionModal').style.display = 'none';
}
