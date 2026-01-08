import { auth, db, onAuthStateChanged, collection, getDocs, doc, deleteDoc, setDoc, serverTimestamp } from './firebase-wrapper.js';
import { openMovieModal as sharedOpenStats, closeModal as sharedClose, switchTab as sharedSwitch, calculateVerdict, getVerdictColor, loadUserReviews, watchNow, startWatchParty, addToWatchLater, markAsWatched, openAddToCollectionModal, closeAddToCollectionModal, addToCollectionConfirm } from './public/modal-logic.js';



// Theme Toggle
window.toggleTheme = function () {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    const icon = document.querySelector('.theme-toggle i');
    if (icon) icon.className = newTheme === 'light' ? 'fas fa-sun' : 'fas fa-moon';
}
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

// Auth State
let currentItems = []; // Store loaded items for filtering

onAuthStateChanged(auth, async (user) => {
    updateAuthUI(user);
    // Set Shared Context
    window.currentModalContext = { currentUser: user, fetchTMDB, db };
    if (user) {
        await loadWatchLaterList(user.uid);
    } else {
        showEmptyState();
        document.getElementById('loading').style.display = 'none';
    }
    if (window.ourShowLoader) window.ourShowLoader.hide();
});

function updateAuthUI(user) {
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
}

async function loadWatchLaterList(userId) {
    const loading = document.getElementById('loading');
    const container = document.getElementById('watchLaterContainer');
    const emptyState = document.getElementById('emptyState');

    loading.style.display = 'block';
    container.innerHTML = '';
    emptyState.style.display = 'none';

    try {
        const querySnapshot = await getDocs(collection(db, 'users', userId, 'watchlist'));

        if (querySnapshot.empty) {
            loading.style.display = 'none';
            emptyState.style.display = 'block';
            currentItems = [];
            return;
        }

        currentItems = [];
        querySnapshot.forEach((doc) => {
            currentItems.push({ id: doc.id, ...doc.data() });
        });

        // Sort by timestamp if available
        currentItems.sort((a, b) => {
            if (b.timestamp && a.timestamp) return b.timestamp.seconds - a.timestamp.seconds;
            return 0;
        });

        loading.style.display = 'none';
        renderCards(currentItems);

    } catch (error) {
        console.error("Error loading watch later list:", error);
        loading.style.display = 'none';
        container.innerHTML = `<p style="color: red; width: 100%; text-align: center;">Error loading content. Please try again.</p>`;
    }
}

window.filterItems = function (type) {
    // Update Active Class
    document.querySelectorAll('.glass-button').forEach(btn => btn.classList.remove('active'));
    if (type === 'all') document.getElementById('filterAll').classList.add('active');
    else if (type === 'movie') document.getElementById('filterMovies').classList.add('active');
    else if (type === 'tv') document.getElementById('filterSeries').classList.add('active');

    if (type === 'all') {
        renderCards(currentItems);
    } else {
        const filtered = currentItems.filter(item => (item.mediaType || 'movie') === type);
        renderCards(filtered);
    }
}

function renderCards(items) {
    const container = document.getElementById('watchLaterContainer');
    container.innerHTML = '';

    if (items.length === 0) {
        // If empty state due to filter, show text, if due to empty account loaded elsewhere
        if (currentItems.length > 0) {
            container.innerHTML = `<div style="width:100%; text-align:center; padding:2rem; color:var(--text-secondary);">No items match this filter.</div>`;
        } else {
            document.getElementById('emptyState').style.display = 'block';
        }
        return;
    } else {
        document.getElementById('emptyState').style.display = 'none';
    }

    // Config Fallback Logic
    const baseUrl = window.PUBLIC_CONFIG?.TMDB_IMAGE_SMALL_URL ||
        window.APP_CONFIG?.TMDB_IMAGE_SMALL_URL ||
        'https://image.tmdb.org/t/p/w500';

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'media-card';

        const posterUrl = item.posterPath ? `${baseUrl}${item.posterPath}` : 'https://placehold.co/200x300?text=No+Poster';
        const rating = item.rating ? Number(item.rating).toFixed(1) : 'N/A';
        const mediaType = item.mediaType || 'movie';

        card.innerHTML = `
            <div class="media-poster-container">
                <img class="media-poster" src="${posterUrl}" loading="lazy" alt="${item.movieTitle}" onerror="this.src='https://placehold.co/200x300?text=No+Image'">
                <div class="card-rating-badge">★ ${rating}</div>
                <div class="card-overlay">
                     <button class="card-download-btn" onclick="event.stopPropagation(); window.location.href='watchanddownload.html?id=${item.movieId}&type=${mediaType}'">
                        <i class="fas fa-play"></i> Watch
                    </button>
                    <button class="card-download-btn" style="margin-top: 0.5rem; background: rgba(220, 38, 38, 0.8);" onclick="event.stopPropagation(); removeItem('${item.id}')">
                        <i class="fas fa-trash"></i> Remove
                    </button>
                </div>
            </div>
            <div class="media-info">
                <div class="media-title" title="${item.movieTitle}">${item.movieTitle}</div>
            </div>
        `;

        card.onclick = () => openMovieModal(item.movieId, item.mediaType || 'movie');

        container.appendChild(card);
    });
}

// Modal Logic
// --- Shared Modal Wrappers ---
async function openMovieModal(id, type = 'movie') {
    const context = { currentUser: auth.currentUser, fetchTMDB, db };
    await sharedOpenStats(id, type, context);
}

function closeModal() { sharedClose(); }
function switchTab(name) { sharedSwitch(name); }

// Expose to window
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

// --- API Helper (Required for Shared Modal) ---
async function fetchTMDB(endpoint, params = {}) {
    if (window.PUBLIC_CONFIG && (window.PUBLIC_CONFIG.TMDB_KEY || window.PUBLIC_CONFIG.TMDB_API_KEY)) {
        const apiKey = window.PUBLIC_CONFIG.TMDB_KEY || window.PUBLIC_CONFIG.TMDB_API_KEY;
        const baseUrl = window.PUBLIC_CONFIG.TMDB_BASE_URL || "https://api.themoviedb.org/3";
        const url = new URL(`${baseUrl}${endpoint}`);
        url.searchParams.append('api_key', apiKey);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(res.status);
            return await res.json();
        } catch (e) {
            console.error(e);
            return null;
        }
    }
    const url = new URL('/api/tmdb', window.location.origin);
    url.searchParams.append('endpoint', endpoint);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    try {
        const res = await fetch(url);
        return await res.json();
    } catch (e) { return null; }
}

window.removeItem = async function (docId) {
    if (!auth.currentUser) return;
    if (!confirm('Remove from Watch Later?')) return;

    try {
        await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'watchlist', docId));
        loadWatchLaterList(auth.currentUser.uid);
    } catch (error) {
        console.error('Error removing item:', error);
    }
}

// Mobile Menu
const mobileBtn = document.getElementById('mobileMenuBtn');
const navRight = document.getElementById('navRight');
if (mobileBtn && navRight) {
    mobileBtn.addEventListener('click', () => {
        navRight.classList.toggle('active');
        const icon = mobileBtn.querySelector('i');
        icon.classList.toggle('fa-bars');
        icon.classList.toggle('fa-times');
    });
}
