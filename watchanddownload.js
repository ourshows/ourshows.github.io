document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    const type = urlParams.get('type') || 'movie';

    if (id) {
        loadDetails(id, type);
    } else {
        document.getElementById('title').textContent = "Content not found";
    }

    // Setup Download Button Immediately
    setupDownloadButtons();
});

function setupDownloadButtons() {
    // App Download Button
    const btnApp = document.getElementById('btnApp');
    if (btnApp) {
        btnApp.onclick = async (e) => {
            e.preventDefault();
            const originalText = btnApp.innerHTML;
            btnApp.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Downloading...';
            btnApp.disabled = true;

            try {
                // Fetch the APK file
                const response = await fetch('/app/PP_Cine.apk');

                if (!response.ok) {
                    throw new Error(`File not found (${response.status})`);
                }

                // Convert to blob
                const blob = await response.blob();

                // Create download link
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'PP_Cine.apk'; // Force filename
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);

                // Success feedback
                btnApp.innerHTML = '<i class="fas fa-check"></i> Download Started';
                setTimeout(() => {
                    btnApp.innerHTML = originalText;
                    btnApp.disabled = false;
                }, 3000);

            } catch (error) {
                console.error('Download error:', error);
                alert('Download failed! Please check connection.\nError: ' + error.message);
                btnApp.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Retry Download';
                btnApp.disabled = false;
            }
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
    if (!window.APP_CONFIG) return;

    // Fetch Details
    const detailsUrl = new URL(`${window.APP_CONFIG.TMDB_BASE_URL}/${type}/${id}`);
    detailsUrl.searchParams.append('api_key', window.APP_CONFIG.TMDB_API_KEY);

    try {
        const res = await fetch(detailsUrl);
        const data = await res.json();
        renderDetails(data);

        // Fetch Providers
        loadProviders(id, type);

    } catch (e) {
        console.error("Error loading details:", e);
    }
}

function renderDetails(data) {
    const backdrop = document.getElementById('backdrop');
    const poster = document.getElementById('poster');
    const title = document.getElementById('title');
    const tagline = document.getElementById('tagline');
    const overview = document.getElementById('overview');
    const rating = document.getElementById('rating');
    const date = document.getElementById('releaseDate');
    const runtime = document.getElementById('runtime');

    if (data.backdrop_path) {
        backdrop.style.backgroundImage = `url(${window.APP_CONFIG.TMDB_IMAGE_BASE_URL}${data.backdrop_path})`;
    }

    if (data.poster_path) {
        poster.src = `${window.APP_CONFIG.TMDB_IMAGE_SMALL_URL}${data.poster_path}`;
    }

    title.textContent = data.title || data.name;
    tagline.textContent = data.tagline || '';
    overview.textContent = data.overview;
    rating.textContent = data.vote_average ? data.vote_average.toFixed(1) : 'N/A';

    const releaseDate = data.release_date || data.first_air_date;
    date.textContent = releaseDate ? releaseDate.split('-')[0] : '';

    if (data.runtime || data.episode_run_time) {
        const time = data.runtime || (data.episode_run_time ? data.episode_run_time[0] : 0);
        runtime.textContent = `${time} min`;
    } else {
        runtime.style.display = 'none';
    }
}

async function loadProviders(id, type) {
    const url = new URL(`${window.APP_CONFIG.TMDB_BASE_URL}/${type}/${id}/watch/providers`);
    url.searchParams.append('api_key', window.APP_CONFIG.TMDB_API_KEY);

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
