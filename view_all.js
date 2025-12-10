import { auth, db, addDoc, setDoc, doc, serverTimestamp, collection } from './firebase-config.js';

let currentPage = 1;
let currentCategory = '';
let isLoading = false;
let currentMovieId = null;
let currentMovieData = null;
let userRating = null;
let currentUser = auth.currentUser;

// Listen for auth state
auth.onAuthStateChanged(user => {
    currentUser = user;
});

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentCategory = urlParams.get('category');

    if (!currentCategory) {
        currentCategory = 'trending';
    }

    updateTitle(currentCategory);
    loadContent(currentCategory, currentPage);

    document.getElementById('loadMoreBtn').addEventListener('click', () => {
        if (!isLoading) {
            currentPage++;
            loadContent(currentCategory, currentPage);
        }
    });
});

// Expose functions to window for onclick handlers in HTML
window.closeModal = closeModal;
window.switchTab = switchTab;
window.rateMovie = rateMovie;
window.submitReview = submitReview;
window.markAsWatched = markAsWatched;
window.addToWatchLater = addToWatchLater;
window.watchNow = watchNow;
window.askAI = askAI;

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

        card.onclick = () => openMovieModal(item.id, item.media_type || 'movie');
        container.appendChild(card);
    });
}

// --- Modal Logic (Duplicated from main.js) ---

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
    document.getElementById('modalOverview').textContent = details.overview;

    // Load sections
    loadTrailer(details.videos);
    loadGenres(details.genres);
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

    // Activate button
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
    // Reuse renderGrid but target the similar container
    // We can't reuse renderGrid directly because it targets 'mediaGrid'.
    // Let's make a mini render function or just inline it.
    similarContainer.innerHTML = '';
    similar.results.slice(0, 10).forEach(item => {
        if (!item.poster_path) return;
        const card = document.createElement('div');
        card.className = 'media-card';
        card.style.minWidth = '160px'; // Ensure horizontal scrolling works
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
    } catch (error) {
        console.error('Error adding to watch later:', error);
        alert('Failed to add to watch later. Please try again.');
    }
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
