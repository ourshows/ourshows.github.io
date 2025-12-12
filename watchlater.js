import { auth, db, onAuthStateChanged, collection, getDocs, doc, deleteDoc, setDoc, serverTimestamp } from './firebase-config.js';

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
onAuthStateChanged(auth, (user) => {
    updateAuthUI(user);
    if (user) {
        loadWatchLaterList(user.uid);
    } else {
        showEmptyState();
        document.getElementById('loading').style.display = 'none';
    }
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
            return;
        }

        const items = [];
        querySnapshot.forEach((doc) => {
            items.push({ id: doc.id, ...doc.data() });
        });

        // Sort by timestamp if available
        items.sort((a, b) => {
            if (b.timestamp && a.timestamp) return b.timestamp.seconds - a.timestamp.seconds;
            return 0;
        });

        loading.style.display = 'none';
        renderCards(items);

    } catch (error) {
        console.error("Error loading watch later list:", error);
        loading.style.display = 'none';
        container.innerHTML = `<p style="color: red; width: 100%; text-align: center;">Error loading content. Please try again.</p>`;
    }
}

function renderCards(items) {
    const container = document.getElementById('watchLaterContainer');
    container.innerHTML = '';

    if (items.length === 0) {
        document.getElementById('emptyState').style.display = 'block';
        return;
    }

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'media-card';

        const posterUrl = item.posterPath ? `${window.APP_CONFIG.TMDB_IMAGE_SMALL_URL}${item.posterPath}` : 'https://via.placeholder.com/200x300?text=No+Poster';
        const rating = item.rating ? Number(item.rating).toFixed(1) : 'N/A';
        const mediaType = item.mediaType || 'movie';

        card.innerHTML = `
            <div class="media-poster-container">
                <img class="media-poster" src="${posterUrl}" loading="lazy" alt="${item.movieTitle}">
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
    const posterUrl = item.posterPath ? `${window.APP_CONFIG.TMDB_IMAGE_SMALL_URL}${item.posterPath}` : 'https://via.placeholder.com/200x300';

    document.getElementById('modalPoster').src = posterUrl;
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
            ...currentItem,
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
