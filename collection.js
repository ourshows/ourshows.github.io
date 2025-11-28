import { auth, db, onAuthStateChanged, collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, where } from './firebase-config.js';

let currentUser = null;
let userCollections = {};

// Listen for auth state
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        loadCollections();
    } else {
        // Redirect to login if not logged in
        // window.location.href = 'login.html';
        document.getElementById('collectionsGrid').innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem;">Please <a href="login.html" style="color: var(--primary-color);">log in</a> to view your collections.</div>';
    }
});

async function loadCollections() {
    if (!currentUser) return;

    // Load default collections counts
    const watchlistSnap = await getDocs(collection(db, 'users', currentUser.uid, 'watchlist'));
    const watchedSnap = await getDocs(collection(db, 'users', currentUser.uid, 'watched'));
    // Favorites is usually a subset of watched or separate, let's assume separate for now
    const favoritesSnap = await getDocs(collection(db, 'users', currentUser.uid, 'favorites'));

    document.getElementById('watchlistCount').textContent = `${watchlistSnap.size} items`;
    document.getElementById('watchedCount').textContent = `${watchedSnap.size} items`;
    document.getElementById('favoritesCount').textContent = `${favoritesSnap.size} items`;

    // Load custom collections (if implemented in DB schema)
    // For now, we'll just stick to the defaults + maybe a demo custom one
}

window.openCollection = async function (type) {
    if (!currentUser) return;

    document.getElementById('collectionsListView').style.display = 'none';
    document.getElementById('collectionDetailView').classList.add('active');

    const titleMap = {
        'watchlist': 'Watchlist',
        'watched': 'Watched History',
        'favorites': 'Favorites'
    };

    document.getElementById('detailTitle').textContent = titleMap[type] || 'Collection';
    document.getElementById('detailDesc').textContent = `Your ${titleMap[type] || 'collection'} items`;

    // Hide delete button for default collections
    const isDefault = ['watchlist', 'watched', 'favorites'].includes(type);
    document.getElementById('deleteCollectionBtn').style.display = isDefault ? 'none' : 'block';

    const grid = document.getElementById('detailGrid');
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center;">Loading...</div>';

    try {
        const querySnapshot = await getDocs(collection(db, 'users', currentUser.uid, type));

        if (querySnapshot.empty) {
            grid.innerHTML = '';
            document.getElementById('emptyCollectionState').style.display = 'block';
            return;
        }

        document.getElementById('emptyCollectionState').style.display = 'none';
        grid.innerHTML = '';

        querySnapshot.forEach((doc) => {
            const item = doc.data();
            const card = document.createElement('div');
            card.className = 'media-card';

            const rating = item.rating ? Number(item.rating).toFixed(1) : 'N/A';
            const year = (item.release_date || item.first_air_date || '').split('-')[0];
            const title = item.movieTitle || item.title || item.name; // Handle different field names
            const poster = item.posterPath || item.poster_path;

            card.innerHTML = `
                <div class="media-poster-container">
                    <img class="media-poster" src="${window.APP_CONFIG.TMDB_IMAGE_SMALL_URL}${poster}" loading="lazy" alt="${title}">
                    <div class="card-rating-badge">★ ${rating}</div>
                </div>
                <div class="media-info">
                    <div class="media-title" title="${title}">${title}</div>
                    <div class="media-year">(${year})</div>
                </div>
            `;

            card.onclick = () => openMovieModal(item.movieId || item.id, item.mediaType || 'movie');
            grid.appendChild(card);
        });

    } catch (error) {
        console.error("Error loading collection:", error);
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: red;">Error loading items.</div>';
    }
};

window.closeCollection = function () {
    document.getElementById('collectionDetailView').classList.remove('active');
    document.getElementById('collectionsListView').style.display = 'block';
};

window.createNewCollection = function () {
    const name = prompt("Enter collection name:");
    if (name) {
        alert("Custom collections feature coming soon!");
        // Logic to create new collection in DB would go here
    }
};

window.deleteCurrentCollection = function () {
    if (confirm("Are you sure you want to delete this collection?")) {
        alert("Delete feature coming soon!");
    }
};

// Re-use modal logic (simplified)
window.openMovieModal = function (id, type) {
    // This relies on main.js being loaded or duplicating the modal logic
    // For now, let's assume main.js is loaded in collection.html
    if (window.openMovieModalGlobal) {
        window.openMovieModalGlobal(id, type);
    } else {
        console.warn("Modal function not found. Ensure main.js is loaded.");
    }
};
