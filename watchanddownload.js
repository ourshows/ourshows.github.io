document.addEventListener('DOMContentLoaded', () => {
    if (window.ourShowLoader) window.ourShowLoader.show();

    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    const type = urlParams.get('type') || 'movie';

    if (id) {
        loadDetails(id, type);
    } else {
        document.getElementById('title').textContent = "Content not found";
        if (window.ourShowLoader) window.ourShowLoader.hide();
    }

    // Setup Download Button Immediately
    setupDownloadButtons();
});

function setupDownloadButtons() {
    // App Download Button - Native HTML handling is sufficient
    // const btnApp = document.getElementById('btnApp');
    // if (btnApp) { ... }

    // Web Watch Button
    const btnWeb = document.getElementById('btnWeb');
    if (btnWeb) {
        btnWeb.href = `https://net2025.cc/login2`;
        btnWeb.target = '_blank';
    }
}

async function loadDetails(id, type) {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    let url;

    if (window.PUBLIC_CONFIG && (window.PUBLIC_CONFIG.TMDB_KEY || window.PUBLIC_CONFIG.TMDB_API_KEY)) {
        const apiKey = window.PUBLIC_CONFIG.TMDB_KEY || window.PUBLIC_CONFIG.TMDB_API_KEY;
        const baseUrl = window.PUBLIC_CONFIG.TMDB_BASE_URL || "https://api.themoviedb.org/3";
        url = new URL(`${baseUrl}/${type}/${id}`);
        url.searchParams.append('api_key', apiKey);
    } else {
        url = new URL('/api/tmdb', window.location.origin);
        url.searchParams.append('endpoint', `/${type}/${id}`);
    }

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();

        if (typeof renderDetails === 'function') {
            renderDetails(data);
        } else {
            console.warn("renderDetails function not found!");
            // Fallback basic render if missing
            document.getElementById('title').textContent = data.title || data.name;
            document.getElementById('backdrop').style.backgroundImage = `url(https://image.tmdb.org/t/p/original${data.backdrop_path})`;
            document.getElementById('poster').src = `https://image.tmdb.org/t/p/w500${data.poster_path}`;
            document.getElementById('overview').textContent = data.overview;
            document.getElementById('rating').textContent = `★ ${data.vote_average.toFixed(1)}`;
            document.getElementById('releaseDate').textContent = (data.release_date || data.first_air_date || '').split('-')[0];
        }

        // Fetch Providers
        await loadProviders(id, type);

        // Render Dynamic Streaming Links
        renderStreamingLinks(data);

    } catch (e) {
        console.error("Error loading details:", e);
        const container = document.getElementById('dynamicLinksContainer');
        if (container) {
            container.innerHTML = '<p style="color: #ef4444; text-align: center;">Error loading content details. Please try refreshing.</p>';
        }
    } finally {
        if (window.ourShowLoader) window.ourShowLoader.hide();
    }
}

// ... renderDetails ...

async function loadProviders(id, type) {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    let url;

    if (window.PUBLIC_CONFIG && window.PUBLIC_CONFIG.TMDB_KEY) {
        const baseUrl = window.PUBLIC_CONFIG.TMDB_BASE_URL || "https://api.themoviedb.org/3";
        url = new URL(`${baseUrl}/${type}/${id}/watch/providers`);
        url.searchParams.append('api_key', window.PUBLIC_CONFIG.TMDB_KEY);
    } else {
        url = new URL('/api/tmdb', window.location.origin);
        url.searchParams.append('endpoint', `/${type}/${id}/watch/providers`);
    }

    // Providers doesn't need extra params usually, but if so add here

    // ... (existing loadProviders function) ...

    try {
        const res = await fetch(url);
        const data = await res.json();
        const locale = 'US';
        const providers = data.results[locale];
        // ... (existing provider logic) ...
    } catch (e) {
        console.error("Error fetching providers:", e);
    }
}

function renderStreamingLinks(data) {
    const container = document.getElementById('dynamicLinksContainer');
    if (!container) return;

    // Metadata
    const originalLang = data.original_language;
    const originCountries = data.origin_country || (data.production_countries ? data.production_countries.map(c => c.iso_3166_1) : []);
    const genres = data.genres ? data.genres.map(g => g.name.toLowerCase()) : [];
    const title = data.title || data.name || '';

    // Categories
    const isNepali = originalLang === 'ne' || originCountries.includes('NP');
    const isAnime = (originalLang === 'ja' && genres.includes('animation')) || genres.includes('anime');
    const isDesi = !isNepali && (['hi', 'ta', 'te', 'ml', 'kn', 'pa', 'ur'].includes(originalLang) || originCountries.some(c => ['IN', 'PK'].includes(c)));
    const isAsianDrama = !isAnime && !isNepali && (['ko', 'zh', 'th'].includes(originalLang) || originCountries.some(c => ['KR', 'CN', 'TW', 'TH'].includes(c)) || (originalLang === 'ja' && !genres.includes('animation')));
    const isHollywood = !isDesi && !isAnime && !isAsianDrama && !isNepali;

    // Special Case: Nepali Content
    if (isNepali) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; background: rgba(255,255,255,0.05); border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
                <i class="fas fa-exclamation-circle" style="font-size: 2rem; color: #f59e0b; margin-bottom: 1rem;"></i>
                <h3 style="color: white; margin-bottom: 0.5rem;">Stream Unavailable</h3>
                <p style="color: #94a3b8;">Sorry, we currently don't have streaming providers for Nepali content.</p>
            </div>
        `;
        return;
    }

    // --- Helper to create link button ---
    const createLink = (url, label, subLabel, icon, colorStart, colorEnd) => `
        <a href="${url}" target="_blank" class="action-btn"
            style="background: linear-gradient(135deg, ${colorStart}, ${colorEnd}); padding: 1rem; border-radius: 10px;">
            <i class="fas ${icon}"></i> ${label}
            <div style="font-size: 0.7rem; opacity: 0.85; margin-top: 0.3rem;">${subLabel}</div>
        </a>
    `;

    // --- Define ALL Sources ---
    const allSources = {
        hollywood: [
            { url: 'https://netmirror.app/', label: 'NetMirror', sub: 'Netflix & Prime Free', icon: 'fa-tv', cs: '#e50914', ce: '#b20710' },
            { url: 'https://cineb.rs/', label: 'Cineb.gg', sub: 'Hollywood & Series', icon: 'fa-play-circle', cs: '#3b82f6', ce: '#2563eb' },
            { url: 'https://katmoviehd.pictures/', label: 'KatMovieHD', sub: 'Download Quality', icon: 'fa-film', cs: '#ef4444', ce: '#dc2626' }
        ],
        desi: [
            { url: 'https://moviesbaba.net/', label: 'MoviesBaba', sub: 'Desi Movies & Web Series', icon: 'fa-star', cs: '#f59e0b', ce: '#d97706' },
            { url: 'https://desicinema.pk/', label: 'DesiCinema', sub: 'Bollywood & Punjabi', icon: 'fa-star', cs: '#f59e0b', ce: '#d97706' },
            { url: 'https://netmirror.app/', label: 'NetMirror', sub: 'Netflix & Prime Free', icon: 'fa-tv', cs: '#e50914', ce: '#b20710' }
        ],
        anime: [
            { url: 'https://pikahd.eu/', label: 'PikaHD', sub: 'Best for Anime', icon: 'fa-dragon', cs: '#8b5cf6', ce: '#7c3aed' }
        ],
        drama: [
            { url: 'https://katdrama.net/', label: 'KatDrama', sub: 'Drama Series', icon: 'fa-heart', cs: '#ec4899', ce: '#db2777' },
            { url: 'https://kisskh.co/List?type=History', label: 'KissKH', sub: 'Asian Drama', icon: 'fa-heart', cs: '#d946ef', ce: '#c026d3' },
            { url: 'https://kissasian.com.vc/', label: 'KissAsian', sub: 'Asian Drama', icon: 'fa-heart', cs: '#be185d', ce: '#9d174d' },
            { url: 'https://netmirror.app/', label: 'NetMirror', sub: 'K-Dramas on Netflix', icon: 'fa-tv', cs: '#e50914', ce: '#b20710' }
        ]
    };

    // --- Build Recommended Links (Top Section) ---
    let recommendedHTML = '';

    // Logic for what to show in "Top recommendations"
    if (isHollywood) {
        recommendedHTML += createLink(allSources.hollywood[0].url, allSources.hollywood[0].label, allSources.hollywood[0].sub, allSources.hollywood[0].icon, allSources.hollywood[0].cs, allSources.hollywood[0].ce);
        recommendedHTML += createLink(allSources.hollywood[1].url, allSources.hollywood[1].label, allSources.hollywood[1].sub, allSources.hollywood[1].icon, allSources.hollywood[1].cs, allSources.hollywood[1].ce);
        // Showing NetMirror and Cineb as top picks
    } else if (isDesi) {
        recommendedHTML += createLink(allSources.desi[0].url, allSources.desi[0].label, allSources.desi[0].sub, allSources.desi[0].icon, allSources.desi[0].cs, allSources.desi[0].ce);
        recommendedHTML += createLink(allSources.desi[1].url, allSources.desi[1].label, allSources.desi[1].sub, allSources.desi[1].icon, allSources.desi[1].cs, allSources.desi[1].ce);
    } else if (isAnime) {
        recommendedHTML += createLink(allSources.anime[0].url, allSources.anime[0].label, allSources.anime[0].sub, allSources.anime[0].icon, allSources.anime[0].cs, allSources.anime[0].ce);
    } else if (isAsianDrama) {
        recommendedHTML += createLink(allSources.drama[0].url, allSources.drama[0].label, allSources.drama[0].sub, allSources.drama[0].icon, allSources.drama[0].cs, allSources.drama[0].ce);
        recommendedHTML += createLink(allSources.drama[3].url, allSources.drama[3].label, allSources.drama[3].sub, allSources.drama[3].icon, allSources.drama[3].cs, allSources.drama[3].ce); // NetMirror
    }

    // --- Build "All Sources" Section (Hidden by Default) ---
    const generateSection = (title, sourceList) => `
        <div style="margin-top: 1.5rem;">
            <h5 style="color: #cbd5e1; font-size: 0.9rem; margin-bottom: 0.8rem; border-left: 3px solid var(--primary-color); padding-left: 0.8rem;">${title}</h5>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem;">
                ${sourceList.map(s => createLink(s.url, s.label, s.sub, s.icon, s.cs, s.ce)).join('')}
            </div>
        </div>
    `;

    const allSourcesHTML = `
        <div id="allSourcesContainer" style="display: none; margin-top: 2rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1rem;">
            ${generateSection('Hollywood & International', allSources.hollywood)}
            ${generateSection('Indian & Desi Web Series', allSources.desi)}
            ${generateSection('Anime & Animation', allSources.anime)}
            ${generateSection('Asian Dramas (K-Drama, C-Drama)', allSources.drama)}
        </div>
    `;

    // --- Combine & Render ---
    container.innerHTML = `
        <h4 style="font-size: 1rem; color: #94a3b8; margin-bottom: 1rem; font-weight: 500;">
            <i class="fas fa-globe"></i> Streaming Options
        </h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem;">
            ${recommendedHTML}
        </div>

        <button id="btnShowAllSources" style="
            display: block; width: 100%; margin-top: 1.5rem; background: rgba(255,255,255,0.08); 
            border: 1px solid rgba(255,255,255,0.1); color: #e2e8f0; padding: 0.8rem; border-radius: 8px; 
            cursor: pointer; font-size: 0.9rem; transition: background 0.2s;">
            <i class="fas fa-chevron-down"></i> Show All Sources
        </button>

        ${allSourcesHTML}
    `;

    // --- Add Event Listener for Toggle ---
    const btnToggle = document.getElementById('btnShowAllSources');
    const allContainer = document.getElementById('allSourcesContainer');

    if (btnToggle && allContainer) {
        btnToggle.addEventListener('click', () => {
            const isHidden = allContainer.style.display === 'none';
            allContainer.style.display = isHidden ? 'block' : 'none';
            btnToggle.innerHTML = isHidden
                ? '<i class="fas fa-chevron-up"></i> Hide All Sources'
                : '<i class="fas fa-chevron-down"></i> Show All Sources';
            btnToggle.style.background = isHidden ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)';
        });
    }
}
