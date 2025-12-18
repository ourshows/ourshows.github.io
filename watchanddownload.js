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
    // App Download Button
    const btnApp = document.getElementById('btnApp');
    if (btnApp) {
        btnApp.onclick = (e) => {
            e.preventDefault();
            // Direct download trigger - Instant start
            const link = document.createElement('a');
            link.href = '/app/PP_Cine.apk';
            link.download = 'PP_Cine.apk';
            link.target = '_blank'; // Fail-safe to prevent page navigation
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };
    }

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

    if (window.PUBLIC_CONFIG && window.PUBLIC_CONFIG.TMDB_KEY) {
        const baseUrl = window.PUBLIC_CONFIG.TMDB_BASE_URL || "https://api.themoviedb.org/3";
        url = new URL(`${baseUrl}/${type}/${id}`);
        url.searchParams.append('api_key', window.PUBLIC_CONFIG.TMDB_KEY);
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

    } catch (e) {
        console.error("Error loading details:", e);
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

    try {
        const res = await fetch(url);
        const data = await res.json();

        // Default to US for now, or detect locale
        const locale = 'US';
        const providers = data.results[locale];

        if (providers && (providers.flatrate || providers.rent || providers.buy)) {
            const container = document.getElementById('providersList');
            const section = document.getElementById('providersSection');
            section.style.display = 'block';

            const uniqueProviders = new Map();

            ['flatrate', 'rent', 'buy'].forEach(method => {
                if (providers[method]) {
                    providers[method].forEach(p => {
                        if (!uniqueProviders.has(p.provider_id)) {
                            uniqueProviders.set(p.provider_id, p);
                        }
                    });
                }
            });

            uniqueProviders.forEach(p => {
                const img = document.createElement('img');
                img.src = `${window.APP_CONFIG.TMDB_IMAGE_SMALL_URL}${p.logo_path}`;
                img.className = 'provider-logo';
                img.title = p.provider_name;
                container.appendChild(img);
            });
        }
    } catch (e) {
        console.error("Error fetching providers:", e);
    }
}
