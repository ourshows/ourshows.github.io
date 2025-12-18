import { auth, db, onAuthStateChanged, collection, getDocs, doc, deleteDoc, setDoc, serverTimestamp } from './firebase-wrapper.js';

document.addEventListener('DOMContentLoaded', () => {
    if (window.ourShowLoader) window.ourShowLoader.show();
});

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

        const posterUrl = item.posterPath ? `${baseUrl}${item.posterPath}` : 'https://via.placeholder.com/200x300?text=No+Poster';
        const rating = item.rating ? Number(item.rating).toFixed(1) : 'N/A';
        const mediaType = item.mediaType || 'movie';

        card.innerHTML = `
            <div class="media-poster-container">
                <img class="media-poster" src="${posterUrl}" loading="lazy" alt="${item.movieTitle}" onerror="this.src='https://via.placeholder.com/200x300?text=No+Image'">
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

        card.onclick = () => openLocalModal(item);

        container.appendChild(card);
    });
}

// Modal Logic
let currentItem = null;

function openLocalModal(item) {
    const modal = document.getElementById('movieModal');
    const baseUrl = window.PUBLIC_CONFIG?.TMDB_IMAGE_SMALL_URL ||
        window.APP_CONFIG?.TMDB_IMAGE_SMALL_URL ||
        'https://image.tmdb.org/t/p/w500';
    const posterUrl = item.posterPath ? `${baseUrl}${item.posterPath}` : 'https://via.placeholder.com/200x300';

    // Fix: Only use standard DOM methods
    const mp = document.getElementById('modalPoster');
    if (mp) mp.src = posterUrl;

    document.getElementById('modalTitle').textContent = item.movieTitle;
    document.getElementById('modalRating').textContent = item.rating ? Number(item.rating).toFixed(1) : 'N/A';
    document.getElementById('modalYear').textContent = '';
    document.getElementById('modalOverview').textContent = 'Added on: ' + (item.timestamp ? new Date(item.timestamp.seconds * 1000).toLocaleDateString() : 'Unknown date');

    currentItem = item;

    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

window.closeModal = function () {
    document.getElementById('movieModal').style.display = 'none';
    document.body.style.overflow = 'auto';
    currentItem = null;
}

window.watchNow = function () {
    if (currentItem) {
        window.location.href = `watchanddownload.html?id=${currentItem.movieId}&type=${currentItem.mediaType || 'movie'}`;
    }
}

window.removeFromWatchLater = function () {
    if (currentItem) {
        removeItem(currentItem.id);
        closeModal();
    }
}

window.moveToWatched = async function () {
    if (!currentItem || !auth.currentUser) return;

    try {
        // Add to watched
        const docId = `${currentItem.mediaType || 'movie'}_${currentItem.movieId}`;
        await setDoc(doc(db, 'users', auth.currentUser.uid, 'watched', docId), {
            ...currentItem, // Copies all props, including mediaType
            timestamp: serverTimestamp()
        });

        // Remove from watch later
        await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'watchlist', currentItem.id));

        alert('Moved to Watched History!');
        closeModal();
        loadWatchLaterList(auth.currentUser.uid);
    } catch (error) {
        console.error("Error moving to watched:", error);
        alert('Failed to move item.');
    }
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
