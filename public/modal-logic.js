
import { doc, getDoc, collection, query, where, orderBy, getDocs, setDoc, deleteDoc, serverTimestamp, addDoc } from '../firebase-wrapper.js';

// Configuration
const IMG_BASE_SMALL = (window.PUBLIC_CONFIG && window.PUBLIC_CONFIG.TMDB_IMAGE_SMALL_URL) || "https://image.tmdb.org/t/p/w500";

/**
 * SHARED MODAL LOGIC
 * Exports: openMovieModal, closeModal, switchTab, calculateVerdict, getVerdictColor
 * Actions: watchNow, startWatchParty, addToWatchLater, markAsWatched, openAddToCollectionModal, closeAddToCollectionModal, addToCollectionConfirm
 */

export async function openMovieModal(id, type = 'movie', context) {
    const { currentUser, fetchTMDB, db } = context;
    if (!fetchTMDB) { console.error("fetchTMDB required in context"); return; }

    // Set Global Context for actions
    window.currentMovieId = id;
    window.currentModalContext = context;

    const modal = document.getElementById('movieModal');
    if (!modal) return;

    // 1. Reset UI State
    resetModalState();

    // 2. Show Modal
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';

    // 3. Switch to Overview IMMEDIATELY
    switchTab('overview');

    // 4. Fetch Data
    const details = await fetchTMDB(`/${type}/${id}`, { append_to_response: 'videos,credits,reviews,similar,external_ids' });
    if (!details) {
        closeModal();
        return;
    }

    window.currentMovieData = details;
    window.currentMovieData.media_type = type;

    // 5. Populate UI
    populateModal(details, type, context);

    // 6. Async Loads (Franchise, User Reviews, User Stats)
    if (type === 'movie' && details.belongs_to_collection) {
        loadFranchise(details.belongs_to_collection.id, id, fetchTMDB);
    }

    // Internal Reviews (FireStore)
    loadUserReviews(id, details.reviews, db);

    // User Interactions (Watchlist/Watched)
    if (currentUser && db) {
        checkUserInteractions(id, currentUser.uid, db);
    }
}

export function closeModal() {
    const modal = document.getElementById('movieModal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = 'auto';
    window.currentMovieId = null;
    window.currentMovieData = null;

    // Stop Videos
    const trailerContainer = document.getElementById('modalTrailer');
    if (trailerContainer) trailerContainer.innerHTML = '';
}

export function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    const selected = document.getElementById(`tab-${tabName}`);
    if (selected) selected.style.display = 'block';

    document.querySelectorAll('.tab-btn').forEach(btn => {
        const txt = btn.textContent.toLowerCase();
        if (txt.includes(tabName.toLowerCase()) ||
            (tabName === 'overview' && txt === 'overview') ||
            (tabName === 'ai' && txt === 'ask ai')) {
            btn.classList.add('active');
        }
    });
}

// --- Actions ---

export function watchNow() {
    const { currentMovieData, currentMovieId } = window;
    if (!currentMovieId || !currentMovieData) {
        alert('Movie information not available');
        return;
    }
    const mediaType = currentMovieData.media_type || 'movie';
    window.location.href = `watchanddownload.html?id=${currentMovieId}&type=${mediaType}`;
}

export function startWatchParty() {
    // Open Cineby.gd in new tab
    window.open('https://cineby.gd', '_blank');
}

export async function addToWatchLater() {
    const { currentUser, db } = window.currentModalContext || {};
    if (!currentUser || !db) {
        alert('Please log in to add to watch later!');
        window.location.href = 'login.html';
        return;
    }
    const { currentMovieId, currentMovieData } = window;

    const btn = document.getElementById('modalWatchLaterBtn');
    try {
        const docRef = doc(db, 'users', currentUser.uid, 'watchlist', String(currentMovieId));
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            // UNDO: Remove from watchlist
            await deleteDoc(docRef);
            if (btn) {
                btn.style.background = 'rgba(255, 255, 255, 0.1)';
                btn.style.color = 'white';
                btn.innerHTML = '<i class="fas fa-plus"></i> My List';
                btn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }
        } else {
            // DO: Add to watchlist
            await setDoc(docRef, {
                movieId: currentMovieId,
                movieTitle: currentMovieData.title || currentMovieData.name,
                posterPath: currentMovieData.poster_path,
                rating: currentMovieData.vote_average,
                mediaType: currentMovieData.media_type || 'movie',
                genres: currentMovieData.genres || [],
                timestamp: serverTimestamp()
            });
            if (btn) {
                btn.style.background = '#eab308'; // Yellow
                btn.style.color = '#000';
                btn.innerHTML = '<i class="fas fa-check"></i> Added';
                btn.style.borderColor = '#eab308';
            }
        }
    } catch (error) {
        console.error('Error toggling watch later status:', error);
    }
}

export async function markAsWatched() {
    const { currentUser, db } = window.currentModalContext || {};
    if (!currentUser || !db) {
        alert('Please log in to mark as watched!');
        window.location.href = 'login.html';
        return;
    }
    const { currentMovieId, currentMovieData } = window;

    const btn = document.getElementById('modalWatchedBtn');
    try {
        const docRef = doc(db, 'users', currentUser.uid, 'watched', String(currentMovieId));
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            // UNDO: Remove from watched
            await deleteDoc(docRef);
            if (btn) {
                btn.style.background = 'rgba(255, 255, 255, 0.1)';
                btn.style.color = 'white';
                btn.innerHTML = '<i class="fas fa-check"></i> Mark Watched';
                btn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }
        } else {
            // Prepare Data
            let runtime = currentMovieData.runtime || 0;
            let episodeRuntime = 0;
            let numberOfEpisodes = 0;

            if (currentMovieData.media_type === 'tv') {
                if (currentMovieData.episode_run_time && currentMovieData.episode_run_time.length > 0) {
                    episodeRuntime = currentMovieData.episode_run_time[0];
                }
                numberOfEpisodes = currentMovieData.number_of_episodes || 0;
            }

            // DO: Add to watched
            await setDoc(docRef, {
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
            if (btn) {
                btn.style.background = '#22c55e'; // Green
                btn.style.color = '#fff';
                btn.innerHTML = '<i class="fas fa-check"></i> Watched';
                btn.style.borderColor = '#22c55e';
            }
        }
    } catch (error) {
        console.error('Error toggling watched status:', error);
    }
}

export async function openAddToCollectionModal() {
    const { currentUser, db } = window.currentModalContext || {};
    if (!currentUser) {
        alert('Please log in.');
        window.location.href = 'login.html';
        return;
    }

    const modal = document.getElementById('addToCollectionModal');
    const list = document.getElementById('userCollectionsList');
    if (modal) modal.style.display = 'block';

    if (list) list.innerHTML = '<div>Loading collections...</div>';

    try {
        const collectionRef = collection(db, 'users', currentUser.uid, 'custom_collections');
        const snap = await getDocs(collectionRef);

        if (list) list.innerHTML = '';
        if (snap.empty) {
            if (list) list.innerHTML = '<div style="padding:1rem;">No custom collections. <a href="collection.html">Create one</a></div>';
            return;
        }

        snap.forEach(doc => {
            const data = doc.data();
            const btn = document.createElement('button');
            btn.className = 'glass-button';
            btn.style.textAlign = 'left';
            btn.innerHTML = `<i class="fas fa-folder"></i> ${data.name}`;
            btn.onclick = () => addToCollectionConfirm(doc.id);
            if (list) list.appendChild(btn);
        });
    } catch (err) {
        console.error("Error loading collections:", err);
        if (list) list.innerHTML = `<div style="color:red;">Error loading collections: ${err.message}</div>`;
    }
}

export function closeAddToCollectionModal() {
    const modal = document.getElementById('addToCollectionModal');
    if (modal) modal.style.display = 'none';
}

export async function addToCollectionConfirm(collectionId) {
    const { currentUser, db } = window.currentModalContext || {};
    const { currentMovieId, currentMovieData } = window;

    if (!currentUser || !currentMovieId) {
        alert('Error: Missing required data');
        return;
    }

    try {
        await setDoc(doc(db, 'users', currentUser.uid, 'custom_collections', collectionId, 'items', String(currentMovieId)), {
            movieId: String(currentMovieId),
            movieTitle: currentMovieData.title || currentMovieData.name,
            posterPath: currentMovieData.poster_path,
            rating: currentMovieData.vote_average,
            mediaType: currentMovieData.media_type || 'movie',
            addedAt: serverTimestamp()
        });

        alert('Added to collection!');
        closeAddToCollectionModal();
    } catch (err) {
        console.error("Error adding to collection:", err);
        alert('Failed to add to collection: ' + err.message);
    }
}


// --- Internal Helpers ---

function resetModalState() {
    setHTML('modalSeasons', '');
    setHTML('modalFranchise', '');
    setHTML('modalGenres', '');
    setHTML('modalSimilar', '');
    setHTML('modalReviews', '<p style="text-align:center;">Loading...</p>');
    setHTML('modalCast', '');
    setHTML('modalTrailer', '');
    setHTML('mobileVerdictMeter', '');
    setHTML('pcVerdictMeter', '');

    setDisplay('tabBtnSeasons', 'none');
    setDisplay('tabBtnFranchise', 'none');

    resetBtn('modalWatchLaterBtn', '<i class="fas fa-plus"></i> My List');
    resetBtn('modalWatchedBtn', '<i class="fas fa-check"></i> Mark Watched');

    setText('modalTitle', 'Loading...');
    setText('modalOverview', '');
    setText('modalRuntime', '');
    setText('modalYear', '');
    setHTML('modalRating', 'N/A');
}

function populateModal(details, type, context) {
    // Header
    const poster = document.getElementById('modalPoster');
    if (poster) poster.src = details.poster_path ? `${IMG_BASE_SMALL}${details.poster_path}` : 'https://placehold.co/300x450';

    setText('modalTitle', details.title || details.name);
    setText('modalYear', (details.release_date || details.first_air_date || '').split('-')[0]);
    setText('modalRuntime', details.runtime ? `${details.runtime} min` : '');
    const overviewText = document.getElementById('modalOverview');
    if (overviewText) overviewText.textContent = details.overview;
    else setText('modalOverview', details.overview);

    // Verdict
    const imdbRating = details.external_ids?.imdb_rating || null;
    const verdict = calculateVerdict(details, imdbRating);

    const ratingContainer = document.getElementById('modalRating')?.parentElement;
    if (ratingContainer) {
        ratingContainer.innerHTML = `<span class="${verdict.class}">${verdict.text}</span> <span style="font-size:0.8rem; opacity:0.7; vertical-align: middle;">(${verdict.finalRating})</span>`;
    }
    renderVerdictMeter(details, verdict);

    // Sections
    loadTrailer(details.videos);
    loadGenres(details.genres);
    loadCast(details.credits);
    loadSimilar(details.similar, context.openMovieModal);

    // Seasons (TV)
    if (type === 'tv' && details.seasons) {
        setDisplay('tabBtnSeasons', 'block');
        const seasonContent = details.seasons.filter(s => s.season_number > 0).map(s => `
            <div class="season-card glass-panel" style="display: flex; gap: 1rem; padding: 1rem;">
                <img src="${s.poster_path ? IMG_BASE_SMALL + s.poster_path : 'https://placehold.co/100x150'}" 
                     style="width: 100px; height: 150px; object-fit: cover; border-radius: 8px;">
                <div class="season-info">
                    <h3>${s.name}</h3>
                    <p>${s.air_date ? s.air_date.substring(0, 4) : 'TBA'} | ${s.episode_count} Episodes</p>
                    <p style="font-size: 0.9rem; color: #ccc; margin-top: 0.5rem;">${s.overview || 'No overview available.'}</p>
                </div>
            </div>
        `).join('');
        setHTML('modalSeasons', seasonContent);
    }
}

async function loadFranchise(collectionId, currentId, fetchTMDB) {
    try {
        const data = await fetchTMDB(`/collection/${collectionId}`);
        if (data && data.parts && data.parts.length > 0) {
            setDisplay('tabBtnFranchise', 'block');
            const sorted = data.parts.sort((a, b) => {
                const d1 = a.release_date ? new Date(a.release_date) : new Date('2099-12-31');
                const d2 = b.release_date ? new Date(b.release_date) : new Date('2099-12-31');
                return d1 - d2;
            });

            const html = sorted.map(m => `
                <div class="movie-card" onclick="window.openMovieModal(${m.id}, 'movie')" style="cursor: pointer; position: relative;">
                     <img src="${m.poster_path ? IMG_BASE_SMALL + m.poster_path : 'https://placehold.co/150x225'}" 
                          style="width: 100%; border-radius: 8px;">
                     <div style="margin-top: 5px; font-size: 0.9rem;">${m.title} (${m.release_date ? m.release_date.split('-')[0] : 'TBA'})</div>
                     ${m.id === currentId ? '<span style="position: absolute; top: 10px; right: 10px; background: var(--primary-color); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem;">Current</span>' : ''}
                </div>
            `).join('');
            setHTML('modalFranchise', html);
        }
    } catch (e) { console.error("Franchise Error", e); }
}

async function checkUserInteractions(movieId, uid, db) {
    try {
        if (!movieId) {
            console.warn("checkUserInteractions: No movieId provided");
            return;
        }
        console.log(`Checking status for: ${movieId} (User: ${uid})`);
        const docPath = `users/${uid}/watched/${String(movieId)}`;
        const watchedDoc = await getDoc(doc(db, 'users', uid, 'watched', String(movieId)));
        console.log(`Watched Status for ${movieId}: ${watchedDoc.exists()}`);

        if (watchedDoc.exists()) {
            const btn = document.getElementById('modalWatchedBtn');
            if (btn) {
                btn.style.background = '#22c55e';
                btn.style.color = '#fff';
                btn.innerHTML = '<i class="fas fa-check"></i> Watched';
                btn.style.borderColor = '#22c55e';
            }
        }

        const watchlistDoc = await getDoc(doc(db, 'users', uid, 'watchlist', String(movieId)));
        if (watchlistDoc.exists()) {
            const btn = document.getElementById('modalWatchLaterBtn');
            if (btn) {
                btn.style.background = '#eab308';
                btn.style.color = '#000';
                btn.innerHTML = '<i class="fas fa-check"></i> Added';
                btn.style.borderColor = '#eab308';
            }
        }
    } catch (e) { console.error("Interaction Check Error", e); }
}

// Verdict Logic
export function calculateVerdict(details, imdbRating) {
    const tmdbRating = details.vote_average || 0;
    // Combine logic could go here
    const rating = tmdbRating;
    const votes = details.vote_count || 0;
    const pop = details.popularity || 0;

    let v = { text: "Skip", class: "verdict-skip", finalRating: rating.toFixed(1) };
    if (rating >= 8.0 && (votes >= 500 || pop >= 100)) v = { text: "Perfection", class: "verdict-perfection", finalRating: rating.toFixed(1) };
    else if (rating >= 6.8) v = { text: "Go for it", class: "verdict-go", finalRating: rating.toFixed(1) };
    else if (rating >= 5.0) v = { text: "One time watch", class: "verdict-once", finalRating: rating.toFixed(1) };
    return v;
}

export function getVerdictColor(text) {
    if (text === 'Perfection') return '#ffd700';
    if (text === 'Go for it') return '#22c55e';
    if (text === 'One time watch') return '#f59e0b';
    return '#ef4444';
}

function renderVerdictMeter(details, verdict) {
    const rating = details.vote_average || 0;
    const html = `
        <div class="verdict-label" style="color: ${getVerdictColor(verdict.text)}">${verdict.text}</div>
        <div class="verdict-subtext">${rating.toFixed(1)}/10 based on TMDB</div>
    `;
    ['pcVerdictMeter', 'mobileVerdictMeter'].forEach(id => setHTML(id, html));
}

// Content Loaders
function loadTrailer(videos) {
    if (!videos?.results?.length) { setHTML('modalTrailer', ''); return; }
    const trailer = videos.results.find(v => v.type === 'Trailer' && v.site === 'YouTube') || videos.results[0];
    if (trailer) {
        setHTML('modalTrailer', `
            <div style="margin-bottom: 2rem;">
                <h3>Trailer</h3>
                <iframe width="100%" height="400" src="https://www.youtube.com/embed/${trailer.key}" 
                    frameborder="0" allowfullscreen style="border-radius: 12px; margin-top: 1rem;"></iframe>
            </div>`);
    }
}

function loadGenres(genres) {
    if (!genres?.length) { setHTML('modalGenres', ''); return; }
    setHTML('modalGenres', `<div style="margin-bottom: 1.5rem;"><strong>Genres:</strong> ${genres.map(g => g.name).join(', ')}</div>`);
}

function loadCast(credits) {
    if (!credits?.cast?.length) { setHTML('modalCast', '<p>No cast info.</p>'); return; }
    const html = credits.cast.slice(0, 12).map(p => `
        <div class="cast-card" style="cursor: pointer;" onclick="window.location.href='cast.html?id=${p.id}'">
            <img src="${p.profile_path ? IMG_BASE_SMALL + p.profile_path : 'https://placehold.co/150x225?text=No+Image'}" alt="${p.name}">
            <div style="font-weight: 600; font-size: 0.9rem;">${p.name}</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">${p.character}</div>
        </div>
    `).join('');
    setHTML('modalCast', html);
}

function loadSimilar(similar) {
    const container = document.getElementById('modalSimilar');
    if (!container) return;

    if (!similar?.results?.length) {
        container.innerHTML = '<p>No similar titles.</p>';
        return;
    }

    // Create heading
    container.innerHTML = '<h3 style="margin-bottom: 1rem;">Similar Movies</h3>';

    // Create grid container WITHOUT className to avoid CSS conflicts
    const gridContainer = document.createElement('div');
    gridContainer.style.cssText = `
        display: grid !important;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)) !important;
        gap: 1rem !important;
        width: 100% !important;
    `;

    similar.results.slice(0, 12).forEach(item => {
        if (!item.poster_path) return;

        const card = document.createElement('div');
        card.style.cssText = 'cursor: pointer; transition: transform 0.2s; width: 100%;';

        card.innerHTML = `
            <div style="position: relative; overflow: hidden; border-radius: 8px;">
                <img src="${IMG_BASE_SMALL}${item.poster_path}" 
                     loading="lazy" 
                     alt="${item.title || item.name}"
                     style="width: 100%; height: auto; display: block; border-radius: 8px;">
            </div>
            <div style="font-size: 0.85rem; margin-top: 0.5rem; font-weight: 500; line-height: 1.3;">${item.title || item.name}</div>
            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
                ${item.vote_average ? '⭐ ' + item.vote_average.toFixed(1) : ''}
            </div>
        `;

        card.onmouseover = () => card.style.transform = 'scale(1.05)';
        card.onmouseout = () => card.style.transform = 'scale(1)';
        card.onclick = () => window.openMovieModal(item.id, item.media_type || 'movie');

        gridContainer.appendChild(card);
    });

    container.appendChild(gridContainer);
}

export async function loadUserReviews(movieId, tmdbReviews, db) {
    const container = document.getElementById('modalReviews');
    if (!container) return;
    container.innerHTML = '<p style="text-align:center;">Loading reviews...</p>';

    let fbReviews = [];
    if (db && movieId) {
        try {
            const q = query(collection(db, 'reviews'), where('movieId', '==', String(movieId)), orderBy('timestamp', 'desc'));
            const snap = await getDocs(q);
            fbReviews = snap.docs.map(d => ({ id: d.id, ...d.data(), source: 'ourshow' }));
        } catch (e) { console.error("FB Reviews Error", e); }
    }

    const tmdbData = (tmdbReviews && tmdbReviews.results) ? tmdbReviews.results.map(r => ({
        id: r.id, author: r.author, content: r.content, rating: r.author_details.rating, source: 'tmdb'
    })) : [];

    const combined = [...fbReviews, ...tmdbData];
    if (combined.length === 0) {
        container.innerHTML = '<p>No reviews yet.</p>';
        return;
    }

    container.innerHTML = combined.slice(0, 10).map(r => {
        const isOur = r.source === 'ourshow';
        const name = isOur ? r.username : r.author;
        const txt = isOur ? r.review : r.content;
        const rating = r.rating ? `★ ${r.rating}` : '';
        return `
            <div class="review-card glass-panel" style="padding:1rem; margin-bottom:1rem;">
                <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                    <strong>${name}</strong>
                    <span style="color:#ffd700;">${rating}</span>
                </div>
                <p style="font-size:0.9rem; line-height:1.4;">${txt.substring(0, 200)}${txt.length > 200 ? '...' : ''}</p>
            </div>
        `;
    }).join('');
}


// Utils
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function setHTML(id, val) { const el = document.getElementById(id); if (el) el.innerHTML = val; }
function setDisplay(id, val) { const el = document.getElementById(id); if (el) el.style.display = val; }
function resetBtn(id, html) {
    const btn = document.getElementById(id);
    if (btn) {
        btn.style.background = 'rgba(255, 255, 255, 0.1)';
        btn.style.color = 'white';
        btn.innerHTML = html;
        btn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    }
}
