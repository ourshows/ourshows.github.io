import { auth, onAuthStateChanged } from './firebase-wrapper.js';

let currentPersonId = null;

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentPersonId = urlParams.get('id');

    if (currentPersonId) {
        loadPersonDetails(currentPersonId);
    } else {
        document.getElementById('castContainer').innerHTML = '<p class="error-msg" style="margin-top:6rem; text-align:center;">No person ID provided.</p>';
    }
});

// Reuse fetchTMDB logic (simplified for this module or imported if shared)
async function fetchTMDB(endpoint, params = {}) {
    const publicConfig = window.PUBLIC_CONFIG || {};
    const appConfig = window.APP_CONFIG || {};

    // Priority check
    const apiKey = publicConfig.TMDB_KEY || publicConfig.TMDB_API_KEY || "798ae7de540b25e908c68ea2ca408347";
    const baseUrl = publicConfig.TMDB_BASE_URL || "https://api.themoviedb.org/3";

    const url = new URL(`${baseUrl}${endpoint}`);
    url.searchParams.append('api_key', apiKey);
    url.searchParams.append('language', 'en-US');

    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`TMDB API Error: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Fetch Error:', error);
        return null;
    }
}

async function loadPersonDetails(personId) {
    try {
        // Parallel fetch for details and credits
        const [details, credits] = await Promise.all([
            fetchTMDB(`/person/${personId}`),
            fetchTMDB(`/person/${personId}/combined_credits`)
        ]);

        if (!details) {
            document.getElementById('castContainer').innerHTML = '<p style="margin-top:6rem; text-align:center;">Person not found.</p>';
            return;
        }

        renderHeader(details);
        renderCredits(credits);

    } catch (error) {
        console.error("Error loading person:", error);
    }
}

function renderHeader(details) {
    const header = document.getElementById('castHeader');
    const imgBase = (window.PUBLIC_CONFIG && window.PUBLIC_CONFIG.TMDB_IMAGE_BASE_URL) || "https://image.tmdb.org/t/p/original";
    const imgSmall = "https://image.tmdb.org/t/p/w500";

    const profilePath = details.profile_path
        ? `${imgSmall}${details.profile_path}`
        : 'https://via.placeholder.com/300x450?text=No+Image';

    const bio = details.biography || "No biography available.";
    const isLongBio = bio.length > 500;
    const shortBio = isLongBio ? bio.substring(0, 500) + '...' : bio;

    header.innerHTML = `
        <img class="cast-profile-img" src="${profilePath}" alt="${details.name}">
        <div class="cast-info">
            <h1 class="cast-name">${details.name}</h1>
            <div class="cast-meta">
                ${details.birthday ? `<span><i class="fas fa-birthday-cake"></i> ${details.birthday}</span>` : ''}
                ${details.place_of_birth ? `<span><i class="fas fa-map-marker-alt"></i> ${details.place_of_birth}</span>` : ''}
                ${details.known_for_department ? `<span><i class="fas fa-film"></i> ${details.known_for_department}</span>` : ''}
            </div>
            
            <div class="cast-bio">
                <span id="bioText">${shortBio}</span>
                ${isLongBio ? `<span id="bioToggle" class="bio-toggle" onclick="toggleBio()">Read More</span>` : ''}
            </div>
            <div style="display:none;" id="fullBio">${bio}</div>
        </div>
    `;
}

window.toggleBio = function () {
    const short = document.getElementById('bioText');
    const full = document.getElementById('fullBio').innerHTML;
    const toggle = document.getElementById('bioToggle');

    if (toggle.textContent === 'Read More') {
        short.innerHTML = full;
        toggle.textContent = 'Read Less';
    } else {
        short.innerHTML = full.substring(0, 500) + '...';
        toggle.textContent = 'Read More';
    }
}

function renderCredits(credits) {
    const grid = document.getElementById('knownForGrid');
    if (!credits || !credits.cast || credits.cast.length === 0) {
        grid.innerHTML = '<p>No known credits.</p>';
        return;
    }

    // Sort by popularity and remove duplicates (sometimes combined_credits has dupes)
    const uniqueCredits = credits.cast.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);
    const sortedCredits = uniqueCredits.sort((a, b) => b.popularity - a.popularity).slice(0, 20); // Top 20

    const imgBase = "https://image.tmdb.org/t/p/w500";

    grid.innerHTML = sortedCredits.map(item => {
        const title = item.title || item.name;
        const year = (item.release_date || item.first_air_date || '').split('-')[0];
        const mediaType = item.media_type || 'movie';

        if (!item.poster_path) return ''; // Skip items without poster

        return `
            <div class="media-card" onclick="window.location.href='watchanddownload.html?id=${item.id}&type=${mediaType}'">
                <div class="media-poster-container">
                    <img class="media-poster" src="${imgBase}${item.poster_path}" loading="lazy" alt="${title}">
                    <div class="card-overlay">
                         <button class="card-download-btn"><i class="fas fa-play"></i> Watch</button>
                    </div>
                </div>
                <div class="media-info">
                    <div class="media-title">${title}</div>
                    <div class="media-year" style="font-size:0.8rem; opacity:0.7;">
                        ${mediaType === 'tv' ? 'TV Series' : 'Movie'} • ${item.character ? 'as ' + item.character : year}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}
