import { auth, db, onAuthStateChanged, collection, addDoc, getDocs, getDoc, deleteDoc, updateDoc, doc, setDoc, serverTimestamp, query, where, orderBy } from './firebase-wrapper.js';
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

// Expose to window
window.openMovieModal = openMovieModal;
window.closeModal = closeModal;
window.switchTab = switchTab;

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
        console.log("Search listener attaching to:", navInput);

        // Remove old listeners by cloning (simple reset)
        const newNavInput = navInput.cloneNode(true);
        navInput.parentNode.replaceChild(newNavInput, navInput);

        newNavInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                const newQuery = newNavInput.value.trim();
                console.log("Search Enter pressed:", newQuery);
                if (newQuery) {
                    // Update URL without full reload if possible, for smoother UX
                    const newUrl = `search.html?q=${encodeURIComponent(newQuery)}`;
                    window.history.pushState({ path: newUrl }, '', newUrl);

                    // Manually trigger search logic
                    const queryDisplay = document.getElementById('queryDisplay');
                    if (queryDisplay) queryDisplay.textContent = newQuery;
                    await performSearch(newQuery);
                }
            }
        });

        // Handle Back/Forward buttons
        window.addEventListener('popstate', async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const query = urlParams.get('q');
            if (query) {
                const queryDisplay = document.getElementById('queryDisplay');
                if (queryDisplay) queryDisplay.textContent = query;
                await performSearch(query);
            }
        });

        // Mobile search is handled by mobile-nav.js globally

    } // End if (navInput)

});


// --- Filter Logic ---
window.filterResults = function (filter) {
    currentFilter = filter;

    // Update active button state
    document.querySelectorAll('.filter-chip').forEach(btn => {
        const btnText = btn.textContent.toLowerCase();
        if (filter === 'all' && btnText.includes('all')) btn.classList.add('active');
        else if (filter === 'movie' && btnText.includes('movies')) btn.classList.add('active');
        else if (filter === 'tv' && btnText.includes('tv')) btn.classList.add('active');
        else if (filter === 'person' && btnText.includes('actors')) btn.classList.add('active');
        else btn.classList.remove('active');
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
        // Filter out incomplete data, allow person type
        const validResults = data.results.filter(item =>
            (item.media_type === 'movie' || item.media_type === 'tv' || item.media_type === 'person') &&
            (item.poster_path || item.profile_path)
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

        const isPerson = item.media_type === 'person';
        const title = item.title || item.name;
        // Use profile_path for person, poster_path for others
        const posterPath = isPerson ? item.profile_path : item.poster_path;
        const posterUrl = posterPath
            ? `${window.APP_CONFIG.TMDB_IMAGE_SMALL_URL}${posterPath}`
            : 'https://placehold.co/200x300?text=No+Image';

        const year = isPerson ? 'Cast' : ((item.release_date || item.first_air_date || '').split('-')[0]);

        let verdictHTML = '';
        let overlayButtons = '';

        if (!isPerson) {
            const verdict = calculateVerdict(item, null, []);
            verdictHTML = `<div class="card-rating-badge" style="color: ${getVerdictColor(verdict.text)};">${verdict.text}</div>`;
            overlayButtons = `
                <div class="card-overlay">
                    <button class="card-download-btn" onclick="event.stopPropagation(); window.location.href='watchanddownload.html?id=${item.id}&type=${item.media_type}'">
                        <i class="fas fa-play"></i> Watch
                    </button>
                    <button class="card-download-btn" style="margin-top: 0.5rem;" onclick="event.stopPropagation(); openMovieModal('${item.id}', '${item.media_type}')">
                        <i class="fas fa-info-circle"></i> Details
                    </button>
                </div>`;
        } else {
            // Person Overlay (maybe just view profile)
            overlayButtons = `
                <div class="card-overlay">
                    <button class="card-download-btn" onclick="event.stopPropagation(); window.location.href='cast.html?id=${item.id}'">
                        <i class="fas fa-user"></i> View Profile
                    </button>
                </div>`;
        }

        card.innerHTML = `
            <div class="media-poster-container">
                <img class="media-poster" src="${posterUrl}" loading="lazy" alt="${title}">
                ${verdictHTML}
                ${overlayButtons}
            </div>
            <div class="media-info">
                <div class="media-title" title="${title}">${title}</div>
                <div class="media-meta">
                    <span>${year}</span>
                    <span>${isPerson ? 'Person' : (item.media_type === 'tv' ? 'TV Show' : 'Movie')}</span>
                </div>
            </div>
        `;

        if (isPerson) {
            card.onclick = () => window.location.href = `cast.html?id=${item.id}`;
        } else {
            card.onclick = () => openMovieModal(item.id, item.media_type);
        }

        container.appendChild(card);
    });
}

// --- Full Modal Logic (Synced with main.js) ---



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
        console.log('Submitting review for movieId:', String(currentMovieId), 'Type:', typeof String(currentMovieId));

        if (editingReviewId) {
            // Update existing review
            await updateDoc(doc(db, 'reviews', editingReviewId), {
                rating: userRating,
                review: reviewText.trim(),
                timestamp: serverTimestamp()
            });
            alert('Review updated successfully!');
            editingReviewId = null;
        } else {
            // Create new review
            await addDoc(collection(db, 'reviews'), {
                userId: currentUser.uid,
                username: currentUser.displayName || currentUser.email,
                movieId: String(currentMovieId), // Convert to string to match query
                movieTitle: currentMovieData.title || currentMovieData.name,
                rating: userRating,
                review: reviewText.trim(),
                timestamp: serverTimestamp()
            });
            alert('Review submitted!');
        }

        console.log('Review submitted successfully!');
        document.getElementById('reviewText').value = '';
        userRating = null;
        document.querySelectorAll('.rating-btn').forEach(btn => btn.classList.remove('selected'));

        // Reset submit button
        const submitBtn = document.querySelector('.add-review-section button[onclick="submitReview()"]');
        if (submitBtn) {
            submitBtn.textContent = 'Submit Review';
            submitBtn.style.background = '';
        }

        await loadUserReviews(currentMovieId, currentMovieData.reviews, db);
        switchTab('reviews'); // Show the reviews tab to display the new review
    } catch (error) {
        console.error('Error submitting review:', error);
        alert('Failed to submit review.');
    }
}

// Delete Review
async function deleteReview(reviewId) {
    if (!confirm('Are you sure you want to delete this review?')) return;

    try {
        await deleteDoc(doc(db, 'reviews', reviewId));
        alert('Review deleted successfully!');
        await loadUserReviews(currentMovieId, currentMovieData.reviews, db);
    } catch (error) {
        console.error('Error deleting review:', error);
        alert('Failed to delete review.');
    }
}

// Edit Review
let editingReviewId = null;
function editReview(reviewId, currentRating, currentText) {
    editingReviewId = reviewId;
    userRating = currentRating;

    // Set the rating button as selected
    document.querySelectorAll('.rating-btn').forEach(btn => {
        btn.classList.remove('selected');
        if (btn.getAttribute('data-rating') === currentRating) {
            btn.classList.add('selected');
        }
    });

    // Set the review text
    document.getElementById('reviewText').value = currentText;

    // Change submit button text
    const submitBtn = document.querySelector('.add-review-section button[onclick="submitReview()"]');
    if (submitBtn) {
        submitBtn.textContent = 'Update Review';
        submitBtn.style.background = '#f59e0b';
    }

    // Switch to reviews tab and scroll to review section
    switchTab('reviews');
    setTimeout(() => {
        document.querySelector('.add-review-section').scrollIntoView({ behavior: 'smooth' });
    }, 100);
}





// --- AI Features ---
// askAI is now attached to window, we ensure it's defined only once.
if (!window.askAI) {
    window.askAI = async function () {
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
        console.log('Loading reviews for movieId:', String(movieId), 'Type:', typeof String(movieId));
        const q = query(
            collection(db, 'reviews'),
            where('movieId', '==', String(movieId)),
            orderBy('timestamp', 'desc')
        );
        const snapshot = await getDocs(q);
        console.log('Firebase reviews found:', snapshot.docs.length);
        firebaseReviews = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            source: 'ourshow'
        }));
        console.log('Firebase reviews:', firebaseReviews);
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

        // Check if this is the current user's review
        const isOwnReview = review.source === 'ourshow' && currentUser && review.userId === currentUser.uid;
        const actionButtons = isOwnReview ? `
            <div style="display: flex; gap: 0.5rem; margin-left: auto;">
                <button class="glass-button" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;" onclick="editReview('${review.id}', '${rating}', \`${content.replace(/`/g, '\\`')}\`)">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="glass-button" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; background: rgba(239, 68, 68, 0.2);" onclick="deleteReview('${review.id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        ` : '';

        return `
        <div class="review-card" id="${reviewId}" style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; ${review.source === 'ourshow' ? 'border-left: 3px solid var(--primary-color);' : ''}">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <strong>${author}</strong>
                    ${verdictHTML}
                </div>
                ${actionButtons}
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



// Window Assignments
window.switchTab = switchTab;
window.closeModal = closeModal;
window.switchTab = switchTab;
window.openMovieModal = openMovieModal;
window.watchNow = watchNow;
window.startWatchParty = startWatchParty;
window.addToWatchLater = addToWatchLater;
window.markAsWatched = markAsWatched;
window.openAddToCollectionModal = openAddToCollectionModal;
window.addToCollectionConfirm = addToCollectionConfirm;
window.closeAddToCollectionModal = closeAddToCollectionModal;
window.rateMovie = rateMovie;
window.submitReview = submitReview;
window.deleteReview = deleteReview;
window.editReview = editReview;
// No redundant askAI here
