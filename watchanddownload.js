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

    let linkHTML = '';

    // Helper to create link button
    const createLink = (url, label, subLabel, icon, colorStart, colorEnd) => `
        <a href="${url}" target="_blank" class="action-btn"
            style="background: linear-gradient(135deg, ${colorStart}, ${colorEnd}); padding: 1rem; border-radius: 10px;">
            <i class="fas ${icon}"></i> ${label}
            <div style="font-size: 0.7rem; opacity: 0.85; margin-top: 0.3rem;">${subLabel}</div>
        </a>
    `;

    // 1. Hollywood / International Links
    if (isHollywood) {
        linkHTML += createLink('https://netmirror.app/', 'NetMirror', 'Netflix & Prime Free', 'fa-tv', '#e50914', '#b20710');
        linkHTML += createLink('https://katmoviehd.pictures/', 'Hollywood', 'KatMovieHD', 'fa-film', '#ef4444', '#dc2626');
    }

    // 2. Desi Links
    if (isDesi) {
        linkHTML += createLink('https://moviesbaba.net/', 'Desi Content', 'MoviesBaba', 'fa-star', '#f59e0b', '#d97706');
        linkHTML += createLink('https://desicinema.pk/', 'Desi Content', 'DesiCinema', 'fa-star', '#f59e0b', '#d97706');
        // Optional: Show NetMirror for Desi too if needed, but strictly requested mostly for Hollywood/Stranger Things context.
        // Adding NetMirror as backup for major Indian content on Netflix
        linkHTML += createLink('https://netmirror.app/', 'NetMirror', 'Netflix & Prime Free', 'fa-tv', '#e50914', '#b20710');
    }

    // 3. Anime Links
    if (isAnime) {
        linkHTML += createLink('https://pikahd.eu/', 'Anime Only', 'PikaHD', 'fa-dragon', '#8b5cf6', '#7c3aed');
    }

    // 4. Asian Drama Links
    if (isAsianDrama) {
        linkHTML += createLink('https://katdrama.net/', 'Drama Series', 'KatDrama', 'fa-heart', '#ec4899', '#db2777');
        linkHTML += createLink('https://kisskh.co/List?type=History', 'KissKH', 'Asian Drama', 'fa-heart', '#d946ef', '#c026d3');
        linkHTML += createLink('https://kissasian.com.vc/', 'KissAsian', 'Asian Drama', 'fa-heart', '#be185d', '#9d174d');
        linkHTML += createLink('https://netmirror.app/', 'NetMirror', 'K-Dramas on Netflix', 'fa-tv', '#e50914', '#b20710');
    }

    // Render
    if (linkHTML) {
        container.innerHTML = `
            <h4 style="font-size: 1rem; color: #94a3b8; margin-bottom: 1rem; font-weight: 500;">
                <i class="fas fa-globe"></i> Streaming Options
            </h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem;">
                ${linkHTML}
            </div>
        `;
    } else {
        container.innerHTML = '<p style="color: #64748b;">No specific streaming links supported for this content type.</p>';
    }
}
