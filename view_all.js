import { auth, db, addDoc, setDoc, doc, getDoc, serverTimestamp, collection, onAuthStateChanged, query, where, orderBy, getDocs } from './firebase-wrapper.js';
import { openMovieModal as sharedOpenStats, closeModal as sharedClose, switchTab as sharedSwitch, calculateVerdict, getVerdictColor, loadUserReviews, watchNow, startWatchParty, addToWatchLater, markAsWatched, openAddToCollectionModal, closeAddToCollectionModal, addToCollectionConfirm } from './public/modal-logic.js';

// --- MODAL WRAPPERS ---
async function openMovieModal(id, type = 'movie') {
    const context = {
        currentUser: currentUser,
        fetchTMDB: fetchTMDB,
        db: db
    };
    await sharedOpenStats(id, type, context);
}

function closeModal() {
    sharedClose();
    currentMovieId = null;
    currentMovieData = null;
}

function switchTab(tabName) {
    sharedSwitch(tabName);
}

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

// Enhanced Rating Display (Verdict)
// The actual change for verdict display in modal should be within openMovieModal.
// The following lines are likely intended to replace or augment the modal rating display.
// I will place them in openMovieModal where the modalRating is updated.

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
            < div class="media-poster-container" >
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


let editingReviewId = null;

window.editReview = function (id, text, rating) {
    editingReviewId = id;
    document.getElementById('reviewText').value = decodeURIComponent(text);
    rateMovie(rating); // Select the rating button
    const header = document.querySelector('.add-review-section h3');
    if (header) header.textContent = 'Update Your Review';
    const submitBtn = document.querySelector('.add-review-section button[onclick="submitReview()"]');
    if (submitBtn) submitBtn.textContent = 'Update Review';
    window.location.hash = 'reviewText'; // Scroll to form
    document.getElementById('reviewText').focus();
};

window.deleteReview = async function (id) {
    if (!confirm('Are you sure you want to delete this review?')) return;
    try {
        await deleteDoc(doc(db, 'reviews', id));
        alert('Review deleted.');
        await loadUserReviews(currentMovieId, currentMovieData.reviews, db);
    } catch (e) {
        console.error("Delete Error:", e);
        alert("Failed to delete review.");
    }
};




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
        if (editingReviewId) {
            // Update existing review
            await setDoc(doc(db, 'reviews', editingReviewId), {
                userId: currentUser.uid,
                username: currentUser.displayName || currentUser.email,
                movieId: String(currentMovieId),
                movieTitle: currentMovieData.title || currentMovieData.name,
                rating: userRating,
                review: reviewText.trim(),
                timestamp: serverTimestamp(),
                updatedAt: serverTimestamp()
            }, { merge: true });
            alert('Review updated successfully!');
            editingReviewId = null;

            const header = document.querySelector('.add-review-section h3');
            if (header) header.textContent = 'Add Your Review';
            const submitBtn = document.querySelector('.add-review-section button[onclick="submitReview()"]');
            if (submitBtn) submitBtn.textContent = 'Submit Review';
        } else {
            // New review
            await addDoc(collection(db, 'reviews'), {
                userId: currentUser.uid,
                username: currentUser.displayName || currentUser.email,
                movieId: String(currentMovieId), // Convert to string to match query
                movieTitle: currentMovieData.title || currentMovieData.name,
                rating: userRating,
                review: reviewText.trim(),
                timestamp: serverTimestamp()
            });
            alert('Review submitted successfully!');
        }

        document.getElementById('reviewText').value = '';
        userRating = null;
        document.querySelectorAll('.rating-btn').forEach(btn => btn.classList.remove('selected'));

        // Reload reviews
        await loadUserReviews(currentMovieId, currentMovieData.reviews, db);
        switchTab('reviews'); // Show the reviews tab to display the new review
    } catch (error) {
        console.error('Error submitting review:', error);
        alert('Failed to submit review. Please try again.');
    }
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



// Expose functions to window
window.openMovieModal = openMovieModal;
window.closeModal = closeModal;
window.switchTab = switchTab;
window.watchNow = watchNow;
window.startWatchParty = startWatchParty;
window.addToWatchLater = addToWatchLater;
window.markAsWatched = markAsWatched;
window.openAddToCollectionModal = openAddToCollectionModal;
window.addToCollectionConfirm = addToCollectionConfirm;
window.closeAddToCollectionModal = closeAddToCollectionModal;
window.submitReview = submitReview;
window.deleteReview = deleteReview;
window.askAI = askAI;

if (typeof rateMovie !== 'undefined') window.rateMovie = rateMovie;
if (typeof editReview !== 'undefined') window.editReview = editReview;
