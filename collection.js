import { auth, db, onAuthStateChanged, collection, collectionGroup, doc, setDoc, addDoc, deleteDoc, getDoc, getDocs, serverTimestamp, query, where, orderBy, limit } from './firebase-wrapper.js';

console.log("Collection Script Module Loaded");

let currentUser = null;

// --- INITIALIZATION & EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    if (window.ourShowLoader) window.ourShowLoader.show();
    console.log("DOM Loaded - Attaching Listeners");
    setupEventListeners();
});

if (document.readyState === 'interactive' || document.readyState === 'complete') {
    setupEventListeners();
}

function setupEventListeners() {
    // Tabs
    const myTab = document.getElementById('tabMyCollections');
    const commTab = document.getElementById('tabCommunity');

    if (myTab) myTab.addEventListener('click', () => switchTab('myCollections'));
    if (commTab) commTab.addEventListener('click', () => switchTab('community'));

    // Create Collection Form
    const createForm = document.getElementById('createCollectionForm');
    if (createForm) {
        createForm.addEventListener('submit', handleCreateCollection);
    }

    // Delete Button
    const delBtn = document.getElementById('deleteCollectionBtn');
    if (delBtn) delBtn.addEventListener('click', deleteCurrentCollection);

    console.log("Listeners Attached");
}


// --- CORE FUNCTIONS ---

function switchTab(tabName) {
    console.log("Switching tab to:", tabName);
    const myTab = document.getElementById('tabMyCollections');
    const commTab = document.getElementById('tabCommunity');
    const myView = document.getElementById('viewMyCollections');
    const commView = document.getElementById('viewCommunity');

    if (!myTab || !commTab || !myView || !commView) {
        console.error("Tab elements not found!");
        return;
    }

    if (tabName === 'myCollections') {
        myTab.classList.add('active');
        commTab.classList.remove('active');
        myView.style.display = 'block';
        commView.style.display = 'none';
    } else {
        myTab.classList.remove('active');
        commTab.classList.add('active');
        myView.style.display = 'none';
        commView.style.display = 'block';

        // Lazy load community if empty
        const commGrid = document.getElementById('communityCollectionsGrid');
        if (commGrid && commGrid.children.length <= 1) {
            loadCommunityCollections();
        }
    }
}

window.closeCollection = function () {
    const detail = document.getElementById('collectionDetailView');
    const list = document.getElementById('collectionsListView');
    if (detail) detail.classList.remove('active');
    if (list) list.style.display = 'block';
};

window.createNewCollection = function () {
    const modal = document.getElementById('createCollectionModal');
    if (modal) modal.style.display = 'block';
};

window.closeCreateCollectionModal = function () {
    const modal = document.getElementById('createCollectionModal');
    if (modal) modal.style.display = 'none';
    const form = document.getElementById('createCollectionForm');
    if (form) form.reset();
};


async function handleCreateCollection(e) {
    e.preventDefault();
    if (!currentUser) return;

    const name = document.getElementById('collectionName').value;
    const desc = document.getElementById('collectionDesc').value;
    const isPublic = document.getElementById('collectionPublic').checked;

    console.log("Creating collection:", name, "Public:", isPublic);

    try {
        const docRef = await addDoc(collection(db, 'users', currentUser.uid, 'custom_collections'), {
            name: name,
            description: desc,
            isPublic: isPublic,
            createdAt: serverTimestamp()
        });

        console.log("Created collection:", docRef.id);
        window.closeCreateCollectionModal();
        loadCollections();
    } catch (err) {
        console.error("Error creating collection:", err);
        alert("Failed to create collection.");
    }
}

async function deleteCurrentCollection() {
    const btn = document.getElementById('deleteCollectionBtn');
    if (!btn || !btn.dataset.id) return;
    const id = btn.dataset.id;

    if (confirm("Are you sure you want to delete this collection?")) {
        try {
            await deleteDoc(doc(db, 'users', currentUser.uid, 'custom_collections', id));
            alert("Collection deleted.");
            window.closeCollection();
            loadCollections();
        } catch (err) {
            console.error("Error deleting collection:", err);
            alert("Failed deletion.");
        }
    }
}

window.removeFromCollection = async function (event, collectionId, docId) {
    event.stopPropagation();
    if (!confirm("Remove this item?")) return;

    try {
        await deleteDoc(doc(db, 'users', currentUser.uid, 'custom_collections', collectionId, 'items', docId));
        openCollection(collectionId, true);
    } catch (err) {
        console.error("Error removing item:", err);
    }
};

window.openCollection = async function (type, isCustom = false, ownerId = null) {
    if (!currentUser) return;

    // Default to current user
    const targetUserId = ownerId || currentUser.uid;
    const isOwner = targetUserId === currentUser.uid;

    document.getElementById('collectionsListView').style.display = 'none';
    document.getElementById('collectionDetailView').classList.add('active');

    let collectionRef;
    let collectionName = '';
    let collectionDesc = '';

    if (isCustom) {
        // Fetch metadata
        try {
            const metaDoc = await getDoc(doc(db, 'users', targetUserId, 'custom_collections', type));
            if (metaDoc.exists()) {
                const data = metaDoc.data();
                collectionName = data.name;
                collectionDesc = data.description || '';
                const delBtn = document.getElementById('deleteCollectionBtn');
                if (delBtn) delBtn.dataset.id = type;
            } else {
                alert("Collection not found or deleted.");
                window.closeCollection();
                return;
            }
            collectionRef = collection(db, 'users', targetUserId, 'custom_collections', type, 'items');

            const delBtn = document.getElementById('deleteCollectionBtn');
            if (delBtn) delBtn.style.display = isOwner ? 'block' : 'none';

            if (!isOwner) collectionDesc += ' (by ' + (isOwner ? 'You' : 'User') + ')';
        } catch (e) {
            console.error("Error opening custom collection:", e);
            alert("Error opening collection.");
            window.closeCollection();
            return;
        }
    } else {
        // Standard Lists
        const titleMap = {
            'watchlist': 'Watchlist',
            'watched': 'Watched History',
            'favorites': 'Favorites'
        };
        collectionName = titleMap[type] || 'Collection';
        collectionDesc = `Your ${titleMap[type] || 'collection'} items`;
        collectionRef = collection(db, 'users', targetUserId, type);
        const delBtn = document.getElementById('deleteCollectionBtn');
        if (delBtn) delBtn.style.display = 'none';
    }

    const titleEl = document.getElementById('detailTitle');
    const descEl = document.getElementById('detailDesc');
    if (titleEl) titleEl.textContent = collectionName;
    if (descEl) descEl.textContent = collectionDesc;

    const grid = document.getElementById('detailGrid');
    if (grid) grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center;">Loading...</div>';

    try {
        const querySnapshot = await getDocs(collectionRef);

        const emptyState = document.getElementById('emptyCollectionState');
        if (querySnapshot.empty) {
            if (grid) grid.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';
        if (grid) grid.innerHTML = '';

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
                    <img class="media-poster" src="${window.PUBLIC_CONFIG?.TMDB_IMAGE_SMALL_URL || window.APP_CONFIG?.TMDB_IMAGE_SMALL_URL || 'https://image.tmdb.org/t/p/w500'}${poster}" loading="lazy" alt="${title}" onerror="this.src='https://via.placeholder.com/200x300?text=No+Image'">
                    <div class="card-rating-badge">★ ${rating}</div>
                    ${(isCustom && isOwner) ? `<button class="remove-btn" onclick="removeFromCollection(event, '${type}', '${doc.id}')" style="position: absolute; top: 5px; right: 5px; background: rgba(220, 38, 38, 0.9); border: none; color: white; border-radius: 50%; width: 28px; height: 28px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; box-shadow: 0 2px 5px rgba(0,0,0,0.5);"><i class="fas fa-trash-alt" style="font-size: 12px;"></i></button>` : ''}
                </div>
                <div class="media-info">
                    <div class="media-title" title="${title}">${title}</div>
                    <div class="media-year">(${year})</div>
                </div>
            `;

            card.onclick = (e) => {
                if (!e.target.closest('.remove-btn')) {
                    if (window.openMovieModalGlobal) window.openMovieModalGlobal(item.movieId || item.id, item.mediaType || 'movie');
                    else console.warn("Layout modal not found");
                }
            };
            if (grid) grid.appendChild(card);
        });

    } catch (error) {
        console.error("Error loading collection items:", error);
        if (grid) grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: red;">Error loading items.</div>';
    }
};

// --- AUTH LISTENER ---
// --- AUTH LISTENER ---
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        await loadCollections();
    } else {
        const grid = document.getElementById('collectionsGrid');
        if (grid) grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem;">Please <a href="login.html" style="color: var(--primary-color);">log in</a> to view your collections.</div>';
    }
    if (window.ourShowLoader) window.ourShowLoader.hide();
});

// --- CORE LOAD FUNCTIONS ---
async function loadCollections() {
    const grid = document.getElementById('collectionsGrid');
    if (!currentUser || !grid) return;

    grid.innerHTML = '';

    // Create "Create New" Button
    const createBtn = document.createElement('div');
    createBtn.className = 'create-collection-btn';
    createBtn.onclick = () => window.createNewCollection();
    createBtn.style.cssText = 'aspect-ratio: 16/9; cursor: pointer;';
    createBtn.innerHTML = `
        <i class="fas fa-plus-circle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
        <span>Create New</span>
    `;
    grid.appendChild(createBtn);

    const emptyGradient = 'background: linear-gradient(135deg, #1e293b, #0f172a); display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.1); font-size: 3rem;';

    const getPoster = (snap) => {
        if (snap.empty) return null;
        const first = snap.docs[0].data();
        const path = first.posterPath || first.poster_path;
        if (path) return (window.PUBLIC_CONFIG?.TMDB_IMAGE_SMALL_URL || window.APP_CONFIG?.TMDB_IMAGE_SMALL_URL || 'https://image.tmdb.org/t/p/w500') + path;
        return null;
    };

    // 1. Watchlist
    try {
        const snap = await getDocs(collection(db, 'users', currentUser.uid, 'watchlist'));
        const div = document.createElement('div');
        div.className = 'collection-card';
        div.onclick = () => window.location.href = 'watchlater.html';
        const img = getPoster(snap);
        div.innerHTML = `
            ${img ? `<img src="${img}" class="collection-preview" alt="Watchlist">` : `<div class="collection-preview" style="${emptyGradient}"><i class="fas fa-list"></i></div>`}
            <div class="collection-info">
                <div class="collection-title">Watchlist</div>
                <div class="collection-count">${snap.size} items</div>
            </div>
        `;
        grid.appendChild(div);
    } catch (e) {
        console.error("Watchlist error:", e);
    }

    // 2. Watched History
    try {
        const snap = await getDocs(collection(db, 'users', currentUser.uid, 'watched'));
        const div = document.createElement('div');
        div.className = 'collection-card';
        div.onclick = () => window.location.href = 'watchedlist.html';
        const img = getPoster(snap);
        div.innerHTML = `
            ${img ? `<img src="${img}" class="collection-preview" alt="Watched">` : `<div class="collection-preview" style="${emptyGradient}"><i class="fas fa-check-circle"></i></div>`}
            <div class="collection-info">
                <div class="collection-title">Watched History</div>
                <div class="collection-count">${snap.size} items</div>
            </div>
        `;
        grid.appendChild(div);
    } catch (e) {
        console.error("Watched error:", e);
    }

    // 3. Custom Collections
    try {
        const snap = await getDocs(collection(db, 'users', currentUser.uid, 'custom_collections'));
        snap.forEach(docSnap => {
            const data = docSnap.data();
            const id = docSnap.id;
            const card = document.createElement('div');
            card.className = 'collection-card';
            card.onclick = () => window.openCollection(id, true, currentUser.uid);

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
    } catch (e) {
        console.error("Custom collections error:", e);
    }
}

async function loadCommunityCollections() {
    const grid = document.getElementById('communityCollectionsGrid');
    if (!grid) return;

    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 1rem;"><i class="fas fa-circle-notch fa-spin"></i> Loading...</div>';

    try {
        const q = query(
            collectionGroup(db, 'custom_collections'),
            where('isPublic', '==', true),
            limit(20)
        );
        const snap = await getDocs(q);
        grid.innerHTML = '';

        if (snap.empty) {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 1rem;">No community collections found.</div>';
            return;
        }

        let count = 0;
        snap.forEach(docSnap => {
            const data = docSnap.data();
            const ownerId = docSnap.ref.parent.parent?.id;
            // REMOVED OWNER FILTER: Now you can see your own public collections here too!

            count++;
            const id = docSnap.id;
            const isMe = ownerId === currentUser.uid;

            const card = document.createElement('div');
            card.className = 'collection-card';
            card.onclick = () => window.openCollection(id, true, ownerId);

            const hue = Math.abs(id.split('').reduce((a, b) => a + b.charCodeAt(0), 0) % 360);
            const placeholderStyle = `background: linear-gradient(135deg, hsl(${hue}, 60%, 20%), hsl(${hue + 40}, 60%, 10%)); display: flex; align-items: center; justify-content: center; font-size: 3rem; color: rgba(255,255,255,0.1);`;

            card.innerHTML = `
                <div class="collection-preview" style="${placeholderStyle}">
                    <i class="fas fa-${isMe ? 'user' : 'globe'}"></i>
                </div>
                <div class="collection-info">
                    <div class="collection-title">${data.name}</div>
                    <div class="collection-count">${isMe ? ' (You)' : 'by User'}</div>
                </div>
            `;
            grid.appendChild(card);
        });

        if (count === 0) {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 1rem;">No other community collections found.</div>';
        }

    } catch (e) {
        console.error("Community Load Error:", e);
        // More specific error if index is missing
        if (e.code === 'failed-precondition') {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 1rem;">Setup Required: Database Indexes Building (Wait a few minutes)</div>';
        } else {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 1rem;">Error loading community lists.</div>';
        }
    }
}
