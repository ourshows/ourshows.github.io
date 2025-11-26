// Main Application Logic
import { auth, db, onAuthStateChanged, collection, addDoc, setDoc, doc, serverTimestamp } from './firebase-config.js';

let currentMovieId = null;
let currentMovieData = null;
let userRating = null;
let currentUser = null;

// Listen for auth state changes
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    console.log('Auth state changed:', user ? user.email : 'Not logged in');
    updateAuthUI(user);
});

function updateAuthUI(user) {
    // Update hero buttons if user is logged in
    const heroListBtn = document.getElementById('heroListBtn');
    if (heroListBtn) {
        if (user) {
            heroListBtn.innerHTML = '<i class="fas fa-user"></i> ' + (user.displayName || user.email);
            heroListBtn.onclick = () => window.location.href = 'profile.html';
        } else {
            heroListBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
            heroListBtn.onclick = () => window.location.href = 'login.html';
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

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    if (!window.APP_CONFIG) {
        console.error("Config not found!");
        return;
    }

    setupNavbar();
    setupSearch();

    await loadHeroContent();
    await loadTrending();
    await loadPopular();
    await loadTopRated();
    await loadUpcoming();
    await loadNowPlaying();
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
    const data = await fetchTMDB('/trending/all/day');
    if (data && data.results.length > 0) {
        const randomHero = data.results[Math.floor(Math.random() * 5)];
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

    watchBtn.onclick = () => openMovieModal(item.id, item.media_type || 'movie');
}

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

async function performSearch(query) {
    const data = await fetchTMDB('/search/multi', { query: query });
    const resultsContainer = document.getElementById('searchResults');
    resultsContainer.innerHTML = '';

    if (data && data.results.length > 0) {
        resultsContainer.classList.add('active');
        data.results.slice(0, 5).forEach(item => {
            if (!item.poster_path && !item.profile_path) return;

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
                openMovieModal(item.id, item.media_type);
                resultsContainer.classList.remove('active');
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
    container.innerHTML = '';

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

        card.onclick = () => openMovieModal(item.id, item.media_type || defaultType);
        container.appendChild(card);
    });
}

// --- Movie Modal ---
async function openMovieModal(id, type = 'movie') {
    currentMovieId = id;
    const modal = document.getElementById('movieModal');

    // Load trailer
    loadTrailer(details.videos);

    // Load genres
    loadGenres(details.genres);

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
    window.location.href = `watchanddownload.html?id=${currentMovieId}&type=movie`;
}

// --- AI Chat ---
async function askAI() {
    const question = document.getElementById('aiQuestion').value.trim();
    if (!question) return;

    const chatContainer = document.getElementById('aiChat');

    // Add user message
    const userMsg = document.createElement('div');
    userMsg.className = 'ai-message user';
    userMsg.textContent = question;
    chatContainer.appendChild(userMsg);

    document.getElementById('aiQuestion').value = '';

    // Call Gemini API
    const prompt = `You are a movie expert. Answer this question about "${currentMovieData.title || currentMovieData.name}": ${question}. Keep the answer concise and informative.`;

    try {
        const response = await callGemini(prompt);
        const aiMsg = document.createElement('div');
        aiMsg.className = 'ai-message ai';
        aiMsg.textContent = response;
        chatContainer.appendChild(aiMsg);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    } catch (error) {
        console.error('AI Error:', error);
        const aiMsg = document.createElement('div');
        aiMsg.className = 'ai-message ai';
        aiMsg.textContent = 'Sorry, I encountered an error. Please try again.';
        chatContainer.appendChild(aiMsg);
    }
}

async function callGemini(prompt) {
    if (!window.APP_CONFIG || !window.APP_CONFIG.GEMINI_API_KEY) {
        throw new Error("Gemini Key Missing");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${window.APP_CONFIG.GEMINI_API_KEY}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

// Close modal on outside click
window.onclick = function (event) {
    const modal = document.getElementById('movieModal');
    if (event.target == modal) {
        closeModal();
    }
}
