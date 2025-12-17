import { auth, db, onAuthStateChanged, collection, getDocs, doc, deleteDoc } from './firebase-wrapper.js';

// Initialize Theme
window.toggleTheme = function () {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    // Update icon
    const icon = document.querySelector('.theme-toggle i');
    if (icon) {
        icon.className = newTheme === 'light' ? 'fas fa-sun' : 'fas fa-moon';
    }
}

// Load saved theme
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

let watchedItemsGlobal = []; // Store loaded items for filtering

// Auth State
onAuthStateChanged(auth, (user) => {
    updateAuthUI(user);
    if (user) {
        loadWatchedList(user.uid);
    } else {
        showEmptyState();
        document.getElementById('loading').style.display = 'none';
        // Optionally redirect or show "Login to view"
    }
});

function updateAuthUI(user) {
    const authBtn = document.getElementById('navAuthBtn');
    if (authBtn) {
        if (user) {
            authBtn.innerHTML = '<i class="fas fa-user"></i> ' + (user.displayName || user.email.split('@')[0]);
            authBtn.onclick = (e) => {
                e.preventDefault();
                window.location.href = 'profile.html';
            };
            authBtn.href = 'profile.html';
        } else {
            authBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
            authBtn.onclick = null;
            authBtn.href = 'login.html';
        }
    }
}

async function loadWatchedList(userId) {
    const loading = document.getElementById('loading');
    const container = document.getElementById('watchedContainer');
    const emptyState = document.getElementById('emptyState');

    loading.style.display = 'block';
    container.innerHTML = '';
    emptyState.style.display = 'none';

    try {
        const querySnapshot = await getDocs(collection(db, 'users', userId, 'watched'));

        if (querySnapshot.empty) {
            loading.style.display = 'none';
            emptyState.style.display = 'block';
            watchedItemsGlobal = [];
            return;
        }

        watchedItemsGlobal = [];
        querySnapshot.forEach((doc) => {
            watchedItemsGlobal.push({ id: doc.id, ...doc.data() });
        });

        // Sort by timestamp if available (descending)
        watchedItemsGlobal.sort((a, b) => {
            if (b.timestamp && a.timestamp) {
                return b.timestamp.seconds - a.timestamp.seconds;
            }
            return 0;
        });

        loading.style.display = 'none';
        renderCards(watchedItemsGlobal);

    } catch (error) {
        console.error("Error loading watched list:", error);
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
        renderCards(watchedItemsGlobal);
    } else {
        const filtered = watchedItemsGlobal.filter(item => (item.mediaType || 'movie') === type);
        renderCards(filtered);
    }
}

function renderCards(items) {
    const container = document.getElementById('watchedContainer');
    container.innerHTML = '';

    if (items.length === 0) {
        if (watchedItemsGlobal.length > 0) {
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
                        <i class="fas fa-play"></i> Watch Again
                    </button>
                    <button class="card-download-btn" style="margin-top: 0.5rem; background: rgba(220, 38, 38, 0.8);" onclick="event.stopPropagation(); removeMovie('${item.id}')">
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
let currentItemToRemove = null;

function openLocalModal(item) {
    const modal = document.getElementById('movieModal');
    const baseUrl = window.PUBLIC_CONFIG?.TMDB_IMAGE_SMALL_URL ||
        window.APP_CONFIG?.TMDB_IMAGE_SMALL_URL ||
        'https://image.tmdb.org/t/p/w500';
    const posterUrl = item.posterPath ? `${baseUrl}${item.posterPath}` : 'https://via.placeholder.com/200x300';

    document.getElementById('modalPoster').src = posterUrl;
    document.getElementById('modalTitle').textContent = item.movieTitle;
    document.getElementById('modalRating').textContent = item.rating ? Number(item.rating).toFixed(1) : 'N/A';

    document.getElementById('modalYear').textContent = '';
    document.getElementById('modalOverview').textContent = 'Watched on: ' + (item.timestamp ? new Date(item.timestamp.seconds * 1000).toLocaleDateString() : 'Unknown date');

    currentItemToRemove = item.id;

    // Setup Watch Now button
    const watchBtn = document.querySelector('#movieModal .glass-button.primary');
    if (watchBtn) watchBtn.onclick = () => window.location.href = `watchanddownload.html?id=${item.movieId}&type=${item.mediaType || 'movie'}`;

    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

window.closeModal = function () {
    document.getElementById('movieModal').style.display = 'none';
    document.body.style.overflow = 'auto';
    currentItemToRemove = null;
}

window.removeFromWatched = function () {
    if (currentItemToRemove) {
        removeMovie(currentItemToRemove);
        closeModal();
    }
}

window.removeMovie = async function (docId) {
    if (!auth.currentUser) return;

    if (!confirm('Remove this title from your watched history?')) return;

    try {
        await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'watched', docId));
        // Refresh list
        loadWatchedList(auth.currentUser.uid);
    } catch (error) {
        console.error('Error removing item:', error);
        alert('Failed to remove item.');
    }
}

// Navbar Setup (Mobile)
const mobileBtn = document.getElementById('mobileMenuBtn');
const navRight = document.getElementById('navRight');
if (mobileBtn && navRight) {
    mobileBtn.addEventListener('click', () => {
        navRight.classList.toggle('active');
        const icon = mobileBtn.querySelector('i');
        if (navRight.classList.contains('active')) {
            icon.classList.remove('fa-bars');
            icon.classList.add('fa-times');
        } else {
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
        }
    });
}

const searchInput = document.getElementById('searchInput');
if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            window.location.href = `index.html?search=${encodeURIComponent(searchInput.value)}`;
        }
    });
}
