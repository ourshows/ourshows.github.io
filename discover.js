import { auth, db, onAuthStateChanged, collection, addDoc, getDocs, getDoc, deleteDoc, updateDoc, doc, setDoc, serverTimestamp, query, where, orderBy } from './firebase-wrapper.js';
import { openMovieModal as sharedOpenStats, closeModal as sharedClose, switchTab as sharedSwitch, calculateVerdict, getVerdictColor, loadUserReviews } from './public/modal-logic.js';

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
document.addEventListener('DOMContentLoaded', async () => {
    if (window.ourShowLoader) window.ourShowLoader.show();

    if (!window.PUBLIC_CONFIG) {
        console.error("Public Config not loaded");
        // Could define fallback here if needed
    }

    setupFilters();
    await loadItems(); // Initial Load (Await to ensure loader stays up)
    setupInfiniteScroll();

    if (window.ourShowLoader) window.ourShowLoader.hide();
});

// 3. Setup Filter Listeners
function setupFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const filterType = e.target.dataset.filter;
            const value = e.target.dataset.value;

            // Update UI
            document.querySelectorAll(`.filter - btn[data - filter="${filterType}"]`).forEach(b => b.classList.remove('active'));
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
        if (!response.ok) throw new Error(`TMDB API Error: ${response.status} `);
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
        const watchLink = `watchanddownload.html ? id = ${item.id}& type=${mediaType} `;

        // Calculate verdict for poster
        const verdict = calculateVerdict(item);

        const card = document.createElement('div');
        card.className = 'media-card';
        card.innerHTML = `
            <div class="media-poster-container">
                <img class="media-poster" src="${imgBase}${item.poster_path}" loading="lazy" alt="${title}">
                <div class="card-rating-badge" style="color: ${getVerdictColor(verdict.text)};">${verdict.text}</div>
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



let editingReviewId = null;

window.editReview = function (id, text, rating) {
    editingReviewId = id;
    document.getElementById('reviewText').value = decodeURIComponent(text);
    rateMovie(rating); // Select the rating button
    document.querySelector('.add-review-section h3').textContent = 'Update Your Review';
    const submitBtn = document.querySelector('.add-review-section button[onclick="submitReview()"]');
    submitBtn.textContent = 'Update Review';
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

// Global Toggle (if not already on window from main.js, but safe to redefine or check)
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

window.rateMovie = function (rating) {
    userRating = rating;
    document.querySelectorAll('.rating-btn').forEach(btn => btn.classList.remove('selected'));
    const selectedBtn = document.querySelector(`.rating-btn[data-rating="${rating}"]`);
    if (selectedBtn) selectedBtn.classList.add('selected');
}

window.submitReview = async function () {
    const reviewText = document.getElementById('reviewText').value;
    if (!userRating) { alert('Please select a rating!'); return; }
    if (!reviewText.trim()) { alert('Please write a review!'); return; }
    if (!currentUser) {
        alert('Please log in first!');
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
                timestamp: serverTimestamp(), // Update timestamp? Or keep original? Usually update.
                updatedAt: serverTimestamp()
            }, { merge: true });
            alert('Review updated!');
            editingReviewId = null;
            document.querySelector('.add-review-section h3').textContent = 'Add Your Review';
            document.querySelector('.add-review-section button[onclick="submitReview()"]').textContent = 'Submit Review';
        } else {
            // New review
            await addDoc(collection(db, 'reviews'), {
                userId: currentUser.uid,
                username: currentUser.displayName || currentUser.email,
                movieId: String(currentMovieId),
                movieTitle: currentMovieData.title || currentMovieData.name,
                rating: userRating,
                review: reviewText.trim(),
                timestamp: serverTimestamp()
            });
            alert('Review submitted!');
        }

        document.getElementById('reviewText').value = '';
        userRating = null;
        document.querySelectorAll('.rating-btn').forEach(btn => btn.classList.remove('selected'));
        await loadUserReviews(currentMovieId, currentMovieData.reviews, db);
        switchTab('reviews');
    } catch (e) {
        console.error("Review Error:", e);
        alert('Failed to submit review.');
    }
}

window.markAsWatched = async function () {
    if (!currentUser) { alert('Login required'); window.location.href = 'login.html'; return; }
    try {
        // Prepare Stats Data
        let runtime = currentMovieData.runtime || 0;
        let episodeRuntime = 0;
        let numberOfEpisodes = 0;

        if (currentMovieData.media_type === 'tv') {
            if (currentMovieData.episode_run_time && currentMovieData.episode_run_time.length > 0) {
                episodeRuntime = currentMovieData.episode_run_time[0];
            }
            numberOfEpisodes = currentMovieData.number_of_episodes || 0;
        }

        await setDoc(doc(db, 'users', currentUser.uid, 'watched', String(currentMovieId)), {
            movieId: currentMovieId,
            movieTitle: currentMovieData.title || currentMovieData.name,
            posterPath: currentMovieData.poster_path,
            rating: currentMovieData.vote_average,
            mediaType: currentMovieData.media_type || 'movie',
            genres: currentMovieData.genres || [],
            timestamp: serverTimestamp(),
            runtime: runtime,
            episodeRuntime: episodeRuntime,
            numberOfEpisodes: numberOfEpisodes
        });
        // UI Feedback
        const btn = document.getElementById('modalWatchedBtn');
        if (btn) {
            btn.style.background = '#22c55e';
            btn.style.color = '#fff';
            btn.innerHTML = '<i class="fas fa-check"></i> Watched';
            btn.style.borderColor = '#22c55e';
        }
    } catch (e) { console.error(e); alert('Error adding to watched'); }
}

window.addToWatchLater = async function () {
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
        // UI Feedback
        const btn = document.getElementById('modalWatchLaterBtn');
        if (btn) {
            btn.style.background = '#eab308';
            btn.style.color = '#000';
            btn.innerHTML = '<i class="fas fa-check"></i> Added';
            btn.style.borderColor = '#eab308';
        }
    } catch (e) { console.error(e); alert('Error adding to watchlist'); }
}

// --- Collections ---
window.openAddToCollectionModal = async function () {
    console.log('openAddToCollectionModal called');
    if (!currentUser) {
        console.log('User not logged in');
        alert('Please log in.');
        window.location.href = 'login.html';
        return;
    }

    console.log('Current User:', currentUser.uid);
    const modal = document.getElementById('addToCollectionModal');
    const list = document.getElementById('userCollectionsList');
    if (modal) modal.style.display = 'block';

    if (list) list.innerHTML = '<div>Loading collections...</div>';

    try {
        console.log('Fetching collections from:', `users/${currentUser.uid}/custom_collections`);
        const collectionRef = collection(db, 'users', currentUser.uid, 'custom_collections');
        const snap = await getDocs(collectionRef);
        console.log('Collections snapshot:', snap.size, 'docs found');

        if (list) list.innerHTML = '';
        if (snap.empty) {
            console.log('No collections found');
            // Fix: Add visible color and clearer text
            if (list) list.innerHTML = '<div style="padding:1rem; color: #fff; text-align: center;">You have no custom collections yet.<br><br><a href="collection.html" style="color: var(--primary-color); text-decoration: underline;">Create your first collection</a></div>';
            return;
        }

        snap.forEach(doc => {
            const data = doc.data();
            console.log('Rendering collection:', data.name);
            const btn = document.createElement('button');
            btn.className = 'glass-button';
            btn.style.textAlign = 'left';
            btn.style.width = '100%';
            btn.style.justifyContent = 'flex-start';
            btn.innerHTML = `<i class="fas fa-folder" style="margin-right: 10px; color: #fbbf24;"></i> ${data.name}`;
            btn.onclick = () => addToCollectionConfirm(doc.id);
            if (list) list.appendChild(btn);
        });
    } catch (err) {
        console.error("Error loading collections:", err);
        if (list) list.innerHTML = `<div style="color: #ef4444; padding: 1rem;">Error loading collections: ${err.message}. Please check console.</div>`;
    }
}

window.addToCollectionConfirm = async function (collectionId) {
    if (!currentUser || !currentMovieId) {
        console.error("Missing user or movie ID:", { currentUser, currentMovieId });
        alert("System Error: Use Discover page to set movie ID.");
        return;
    }

    try {
        // Save using currentMovieId from THIS module
        // We use setDoc with specific ID to prevent duplicates
        await setDoc(doc(db, 'users', currentUser.uid, 'custom_collections', collectionId, 'items', String(currentMovieId)), {
            movieId: String(currentMovieId),
            title: currentMovieData.title || currentMovieData.name,
            poster_path: currentMovieData.poster_path,
            vote_average: currentMovieData.vote_average,
            mediaType: currentMovieData.media_type || 'movie',
            addedAt: serverTimestamp()
        });

        alert(`Added to collection!`);
        document.getElementById('addToCollectionModal').style.display = 'none';

    } catch (err) {
        console.error("Error adding to collection:", err);
        alert("Failed to add to collection.");
    }
}

window.watchNow = function () {
    if (currentMovieId) {
        window.location.href = `watchanddownload.html?id=${currentMovieId}&type=${currentMovieData?.media_type || 'movie'}`;
    }
}

window.askAI = async function () {
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

// Expose functions to window (since this is a module)
window.closeModal = closeModal;
window.switchTab = switchTab;
window.rateMovie = rateMovie;
window.submitReview = submitReview;
window.markAsWatched = markAsWatched;
window.addToWatchLater = addToWatchLater;
window.openAddToCollectionModal = openAddToCollectionModal;
window.addToCollectionConfirm = addToCollectionConfirm;
window.watchNow = watchNow;
window.askAI = askAI;
window.openMovieModal = openMovieModal;
