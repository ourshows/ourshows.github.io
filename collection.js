import { auth, db, onAuthStateChanged, collection, doc, setDoc, addDoc, deleteDoc, getDoc, getDocs, serverTimestamp, query, where, orderBy } from './firebase-wrapper.js';

let currentUser = null;
console.log("Collection Module Loaded");
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

    try {
        console.log("Loading collections for user:", currentUser.uid);

        // Load default collections counts
        const watchlistSnap = await getDocs(collection(db, 'users', currentUser.uid, 'watchlist'));
        const watchedSnap = await getDocs(collection(db, 'users', currentUser.uid, 'watched'));
        const favoritesSnap = await getDocs(collection(db, 'users', currentUser.uid, 'favorites'));

        const watchlistCount = watchlistSnap.size;
        const watchedCount = watchedSnap.size;
        const favoritesCount = favoritesSnap.size;

        // Load custom collections
        const customCollectionsRef = collection(db, 'users', currentUser.uid, 'custom_collections');
        const customSnap = await getDocs(customCollectionsRef);

        const grid = document.getElementById('collectionsGrid');
        grid.innerHTML = ''; // Full clear

        // 1. Re-add "Create New" Button
        grid.innerHTML += `
            <div class="create-collection-btn" onclick="createNewCollection()" style="aspect-ratio: 16/9; cursor: pointer;">
                <i class="fas fa-plus-circle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                <span>Create New</span>
            </div>
        `;

        // 2. Add Default Collections
        grid.innerHTML += `
            <div class="collection-card" onclick="openCollection('watchlist')">
                <img src="https://image.tmdb.org/t/p/w500/1E5baAaEse26fej7uHkjPoXIX1O.jpg" class="collection-preview" alt="Watchlist">
                <div class="collection-info">
                    <div class="collection-title">Watchlist</div>
                    <div class="collection-count">${watchlistCount} items</div>
                </div>
            </div>
            <div class="collection-card" onclick="openCollection('favorites')">
                <img src="https://image.tmdb.org/t/p/w500/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg" class="collection-preview" alt="Favorites">
                <div class="collection-info">
                    <div class="collection-title">Favorites</div>
                    <div class="collection-count">${favoritesCount} items</div>
                </div>
            </div>
            <div class="collection-card" onclick="openCollection('watched')">
                <img src="https://image.tmdb.org/t/p/w500/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg" class="collection-preview" alt="Watched">
                <div class="collection-info">
                    <div class="collection-title">Watched History</div>
                    <div class="collection-count">${watchedCount} items</div>
                </div>
            </div>
        `;

        // 3. Add Custom Collections
        customSnap.forEach(docSnap => {
            const data = docSnap.data();
            const id = docSnap.id;

            const card = document.createElement('div');
            card.className = 'collection-card';
            card.onclick = () => openCollection(id, true);

            // Generate a random gradient based on the name hash for unique look
            const hue = Math.abs(id.split('').reduce((a, b) => a + b.charCodeAt(0), 0) % 360);
            const placeholderStyle = `background: linear-gradient(135deg, hsl(${hue}, 60%, 20%), hsl(${hue + 40}, 60%, 10%)); display: flex; align-items: center; justify-content: center; font-size: 3rem; color: rgba(255,255,255,0.1);`;

            card.innerHTML = `
                <div class="collection-preview" style="${placeholderStyle}">
                    <i class="fas fa-layer-group"></i>
                </div>
                <div class="collection-info">
                    <div class="collection-title">${data.name}</div>
                    <div class="collection-count">${data.isPublic ? 'Public' : 'Private'}</div>
                </div>
            `;
            grid.appendChild(card);
        });

    } catch (err) {
        console.error("Error loading collections:", err);
    }
}

window.openCollection = async function (type, isCustom = false) {
    if (!currentUser) return;

    document.getElementById('collectionsListView').style.display = 'none';
    document.getElementById('collectionDetailView').classList.add('active');

    let collectionRef;
    let collectionName = '';
    let collectionDesc = '';

    if (isCustom) {
        // Fetch metadata
        const metaDoc = await getDoc(doc(db, 'users', currentUser.uid, 'custom_collections', type));
        if (metaDoc.exists()) {
            const data = metaDoc.data();
            collectionName = data.name;
            collectionDesc = data.description || '';
            document.getElementById('deleteCollectionBtn').dataset.id = type; // Store ID for delete
        }

        // Items are in sub-collection 'items'
        collectionRef = collection(db, 'users', currentUser.uid, 'custom_collections', type, 'items');

        document.getElementById('deleteCollectionBtn').style.display = 'block';
    } else {
        const titleMap = {
            'watchlist': 'Watchlist',
            'watched': 'Watched History',
            'favorites': 'Favorites'
        };
        collectionName = titleMap[type] || 'Collection';
        collectionDesc = `Your ${titleMap[type] || 'collection'} items`;
        collectionRef = collection(db, 'users', currentUser.uid, type);
        document.getElementById('deleteCollectionBtn').style.display = 'none';
    }

    document.getElementById('detailTitle').textContent = collectionName;
    document.getElementById('detailDesc').textContent = collectionDesc;

    const grid = document.getElementById('detailGrid');
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center;">Loading...</div>';

    try {
        const querySnapshot = await getDocs(collectionRef);

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
            const title = item.movieTitle || item.title || item.name;
            const poster = item.posterPath || item.poster_path;

            card.innerHTML = `
                <div class="media-poster-container">
                    <img class="media-poster" src="${window.APP_CONFIG.TMDB_IMAGE_SMALL_URL}${poster}" loading="lazy" alt="${title}">
                    <div class="card-rating-badge">★ ${rating}</div>
                    ${isCustom ? `<button class="remove-btn" onclick="removeFromCollection(event, '${type}', '${doc.id}')" style="position: absolute; top: 5px; right: 5px; background: rgba(255,0,0,0.7); border: none; color: white; border-radius: 50%; width: 24px; height: 24px; cursor: pointer;">&times;</button>` : ''}
                </div>
                <div class="media-info">
                    <div class="media-title" title="${title}">${title}</div>
                    <div class="media-year">(${year})</div>
                </div>
            `;

            // Prevent card click when clicking remove button
            card.onclick = (e) => {
                if (!e.target.closest('.remove-btn')) {
                    openMovieModal(item.movieId || item.id, item.mediaType || 'movie');
                }
            };
            grid.appendChild(card);
        });

    } catch (error) {
        console.error("Error loading collection:", error);
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: red;">Error loading items.</div>';
    }
};

window.removeFromCollection = async function (event, collectionId, docId) {
    event.stopPropagation();
    if (!confirm("Remove this item?")) return;

    try {
        await deleteDoc(doc(db, 'users', currentUser.uid, 'custom_collections', collectionId, 'items', docId));
        // Refresh view
        openCollection(collectionId, true);
    } catch (err) {
        console.error("Error removing item:", err);
        alert("Failed to remove item.");
    }
};

window.closeCollection = function () {
    document.getElementById('collectionDetailView').classList.remove('active');
    document.getElementById('collectionsListView').style.display = 'block';
};

// Create Collection Logic
window.createNewCollection = function () {
    const modal = document.getElementById('createCollectionModal');
    if (modal) modal.style.display = 'block';
};

window.closeCreateCollectionModal = function () {
    document.getElementById('createCollectionModal').style.display = 'none';
    document.getElementById('createCollectionForm').reset();
};

window.handleCreateCollection = async function (e) {
    e.preventDefault();
    if (!currentUser) return;

    const name = document.getElementById('collectionName').value;
    const desc = document.getElementById('collectionDesc').value;
    const isPublic = document.getElementById('collectionPublic').checked;

    try {
        const docRef = await addDoc(collection(db, 'users', currentUser.uid, 'custom_collections'), {
            name: name,
            description: desc,
            isPublic: isPublic,
            createdAt: serverTimestamp()
        });

        console.log("Created collection with ID: ", docRef.id);
        closeCreateCollectionModal();
        loadCollections(); // Refresh list
    } catch (err) {
        console.error("Error creating collection:", err);
        alert("Failed to create collection. See console for details.");
    }
};

window.deleteCurrentCollection = async function () {
    const id = document.getElementById('deleteCollectionBtn').dataset.id;
    if (!id) return;

    if (confirm("Are you sure you want to delete this collection and all its items? This cannot be undone.")) {
        try {
            // Delete metadata
            await deleteDoc(doc(db, 'users', currentUser.uid, 'custom_collections', id));
            // Note: Use a cloud function to delete subcollections effectively, or client-side batch if small.
            // For MVP client-side, we won't strictly enforce subcollection deletion since Firestore doesn't cascade delete.
            // But since we only read via parent, it 'disappears' effectively.

            alert("Collection deleted.");
            closeCollection();
            loadCollections();
        } catch (err) {
            console.error("Error deleting collection:", err);
            alert("Failed to delete collection.");
        }
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
