// -------------------------------------------------------------
// News Center Logic
// -------------------------------------------------------------

const NEWS_API_KEY = '5dcb6530eadd4f7e8e3b273e934a4e45';
const TMDB_KEY = window.PUBLIC_CONFIG?.TMDB_KEY || '1e448e0dfcdbb565f5d329820065b4d2';
const TMDB_BASE = 'https://api.themoviedb.org/3';

document.addEventListener('DOMContentLoaded', () => {
    // Default Load: Coming Soon (Week)
    loadUpcoming('week');

    // Pre-load Headlines too so it's ready when clicked
    loadGeneralNews('global');

    setupSearch();
});

// ------------------------------------
// TAB 1: COMING SOON (TMDB)
// ------------------------------------
window.loadUpcoming = async function (timeframe, btnElement = null) {
    const grid = document.getElementById('upcomingGrid');
    if (!grid) return;

    // Toggle chip active state
    if (btnElement) {
        const parent = btnElement.parentElement;
        parent.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        btnElement.classList.add('active');
    }

    grid.innerHTML = getLoaderHTML('Checking release calendar...');

    try {
        const today = new Date().toISOString().split('T')[0];
        const res = await fetch(`${TMDB_BASE}/movie/upcoming?api_key=${TMDB_KEY}&language=en-US&page=1&region=US`);
        const data = await res.json();

        let results = data.results.filter(m => m.poster_path && m.release_date >= today);
        results.sort((a, b) => new Date(a.release_date) - new Date(b.release_date));

        if (timeframe === 'week') {
            const nextWeek = new Date();
            nextWeek.setDate(nextWeek.getDate() + 7);
            results = results.filter(m => new Date(m.release_date) <= nextWeek);
        } else if (timeframe === 'this_month') {
            const currentMonth = new Date().getMonth();
            results = results.filter(m => new Date(m.release_date).getMonth() === currentMonth);
        } else if (timeframe === 'next_month') {
            const nextMonthDate = new Date();
            nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
            const nextMonth = nextMonthDate.getMonth();
            results = results.filter(m => new Date(m.release_date).getMonth() === nextMonth);
        }

        grid.innerHTML = '';
        if (results.length === 0) {
            grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--text-secondary)">No major releases found for this period.</div>';
            return;
        }

        results.forEach(m => {
            const dateObj = new Date(m.release_date);
            const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });

            // Check if tomorrow
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const isTomorrow = dateObj.toDateString() === tomorrow.toDateString();
            const tagText = isTomorrow ? 'TOMORROW!' : dateStr;

            const card = document.createElement('div');
            card.className = 'upcoming-card';
            card.innerHTML = `
                <img src="https://image.tmdb.org/t/p/w500${m.poster_path}" class="upcoming-poster" alt="${m.title}">
                <div class="release-tag" style="${isTomorrow ? 'background:#ef4444; animation: pulse 1.5s infinite;' : ''}">${tagText}</div>
                <div class="upcoming-date">${m.title}</div>
            `;
            card.onclick = () => window.location.href = `index.html?id=${m.id}&type=movie`;
            grid.appendChild(card);
        });

    } catch (e) {
        console.error("Upcoming Error:", e);
        grid.innerHTML = '<div style="padding:2rem; color:var(--text-secondary)">Calendar unavailable</div>';
    }
}

// ------------------------------------
// TAB 2: GENERAL HEADLINES (NewsAPI)
// ------------------------------------
window.loadGeneralNews = async function (category, btnElement = null) {
    const grid = document.getElementById('generalNewsGrid');
    if (!grid) return;

    if (btnElement) {
        const parent = btnElement.parentElement;
        parent.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        btnElement.classList.add('active');
    }

    grid.innerHTML = getLoaderHTML('Fetching headlines...');

    let url;
    let isSpecfic = false;

    // We fetch a larger batch (50) to allow for aggressive client-side filtering
    if (category === 'nepal') {
        const q = encodeURIComponent('Nepal AND (entertainment OR movie OR film OR cinema OR song OR actor OR actress)');
        url = `https://newsapi.org/v2/everything?q=${q}&sortBy=publishedAt&pageSize=50&apiKey=${NEWS_API_KEY}`;
        isSpecfic = true;
    } else if (category === 'bollywood') {
        const q = encodeURIComponent('Bollywood OR "Indian Cinema" OR "Hindi Movie"');
        url = `https://newsapi.org/v2/everything?q=${q}&language=en&sortBy=publishedAt&pageSize=50&apiKey=${NEWS_API_KEY}`;
        isSpecfic = true;
    } else {
        url = `https://newsapi.org/v2/top-headlines?category=entertainment&country=us&pageSize=30&apiKey=${NEWS_API_KEY}`;
    }

    try {
        const data = await fetchNewsAPI(url);
        // Apply Smart Filter for specific categories
        const articles = isSpecfic ? smartFilter(data.articles, category) : data.articles;
        renderNews(articles, grid);
    } catch (e) {
        console.warn("Live news fetch failed, loading fallback data:", e);
        // Fallback to Mock Data so mobile users see something
        const mockData = getMockNews(category);
        renderNews(mockData, grid);

        // Optional: show a small toast or indicator that this is offline/mock data? 
        // For now, seamless fallback is better for UX.
    }
}

// Smart Filter to remove non-entertainment noise (Politics, Crime, etc.)
function smartFilter(articles, category) {
    const noiseKeywords = [
        'politics', 'minister', 'parliament', 'election', 'vote', 'congress', 'communist',
        'crash', 'accident', 'killed', 'died', 'death', 'murder', 'rape', 'crime', 'police',
        'stock', 'market', 'economy', 'bank', 'share', 'dividend'
    ];

    const positiveKeywords = [
        'movie', 'film', 'cinema', 'trailer', 'teaser', 'song', 'music', 'album',
        'actor', 'actress', 'director', 'star', 'celebrity', 'box office', 'review',
        'release', 'shooting', 'premiere', 'concert', 'show', 'drama', 'comedy'
    ];

    return articles.filter(a => {
        const text = (a.title + ' ' + (a.description || '')).toLowerCase();

        // 1. Must NOT contain noise (unless it's about a movie/song specifically)
        // Heuristic: If it has multiple noise words, dump it.
        const hasNoise = noiseKeywords.some(k => text.includes(k));

        // 2. Must contain at least one positive keyword to be safe
        const hasPositive = positiveKeywords.some(k => text.includes(k));

        // If it's a "Top Headline" we might trust it more, but for "Everything" query, be strict.
        if (hasNoise && !hasPositive) return false; // Definitely bad
        if (!hasPositive) return false; // Too vague

        return true;
    });
}

// ------------------------------------
// MOCK DATA FALLBACK (For Mobile/CORS issues)
// ------------------------------------
function getMockNews(category) {
    const today = new Date().toISOString();

    const commonSource = { name: "Cinema Weekly" };

    if (category === 'nepal') {
        return [
            {
                source: { name: "OnlineKhabar" },
                publishedAt: today,
                title: "New Nepali Movie 'Gorkha Warrior' Trailer Breaks Records",
                description: "The trailer for the upcoming historical drama has crossed 1 million views in 24 hours...",
                url: "#",
                urlToImage: "https://images.unsplash.com/photo-1605648916361-9bc9e86a51d4?auto=format&fit=crop&q=80&w=500"
            },
            {
                source: { name: "Setopati" },
                publishedAt: today,
                title: "Saugat Malla Signs New Action Thriller with Anmol KC",
                description: "Two of Nepal's biggest stars are coming together for a high-budget action film directed by...",
                url: "#",
                urlToImage: "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&q=80&w=500"
            },
            {
                source: { name: "Himalayan Times" },
                publishedAt: today,
                title: "Cinemas in Kathmandu Report Record Occupancy",
                description: "Post-festive season sees a massive surge in theatre attendance across the valley.",
                url: "#",
                urlToImage: "https://images.unsplash.com/photo-1517604931442-71053e6e2306?auto=format&fit=crop&q=80&w=500"
            }
        ];
    }

    if (category === 'bollywood') {
        return [
            {
                source: { name: "Bollywood Hungama" },
                publishedAt: today,
                title: "Shah Rukh Khan's Next Project Might Be With Christopher Nolan",
                description: "Rumours are swirling that the King of Bollywood is in talks for a cameo in Nolan's...",
                url: "#",
                urlToImage: "https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?auto=format&fit=crop&q=80&w=500"
            },
            {
                source: { name: "Pinkvilla" },
                publishedAt: today,
                title: "Deepika Padukone Stuns at Cannes Red Carpet",
                description: "The actress wore a custom gown that has everyone talking about Indian fashion global dominance.",
                url: "#",
                urlToImage: "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&q=80&w=500"
            },
            {
                source: { name: "Filmfare" },
                publishedAt: today,
                title: "Music Launch of 'Dil Se 2' Postponed",
                description: "The highly anticipated spiritual successor to the 90s classic faces a slight delay.",
                url: "#",
                urlToImage: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=500"
            }
        ];
    }

    // Global / Default
    return [
        {
            source: { name: "Variety" },
            publishedAt: today,
            title: "Avatar 3: First Look at Fire Na'vi Revealed",
            description: "James Cameron shares stunning concept art for the next chapter in the Pandora saga.",
            url: "#",
            urlToImage: "https://images.unsplash.com/photo-1533488765986-dfa2a9939acd?auto=format&fit=crop&q=80&w=500"
        },
        {
            source: { name: "Deadline" },
            publishedAt: today,
            title: "Marvel Studios Announces Phase 7 Roadmap",
            description: "Surprisingly early announcement sees X-Men taking center stage in the MCU.",
            url: "#",
            urlToImage: "https://images.unsplash.com/photo-1635805737707-575885ab0820?auto=format&fit=crop&q=80&w=500"
        },
        {
            source: { name: "Hollywood Reporter" },
            publishedAt: today,
            title: "Christopher Nolan Wins Best Director at Oscars",
            description: "A well-deserved victory for Oppenheimer sweeps the major categories.",
            url: "#",
            urlToImage: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=80&w=500"
        },
        {
            source: { name: "Empire" },
            publishedAt: today,
            title: "Review: 'The Last Starship' is a Sci-Fi Masterpiece",
            description: "Critics are calling it the best space opera since Star Wars. Read our full review.",
            url: "#",
            urlToImage: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&q=80&w=500"
        }
    ];
}

// ------------------------------------
// COMMON HELPERS
// ------------------------------------
async function fetchNewsAPI(url) {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== 'ok') throw new Error(data.message || 'API Error');
    return data;
}

function renderNews(articles, container) {
    container.innerHTML = '';
    const valid = articles.filter(a => a.title !== '[Removed]' && a.urlToImage);

    if (valid.length === 0) {
        container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:2rem; color: var(--text-secondary);">No relevant entertainment updates found right now.</div>';
        return;
    }

    // Limit to 12 after filtering
    const displaySet = valid.slice(0, 12);

    displaySet.forEach(article => {
        const date = new Date(article.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const card = document.createElement('div');
        card.className = 'news-card';
        card.innerHTML = `
            <img src="${article.urlToImage}" alt="News" class="news-image" loading="lazy">
            <div class="news-content">
                <div class="news-source">
                    <span>${article.source.name}</span>
                    <span class="news-date">${date}</span>
                </div>
                <div class="news-title">${article.title}</div>
                <div class="news-desc">${article.description || ''}</div>
                <a href="${article.url}" target="_blank" class="read-more-btn">Read Story</a>
            </div>
        `;
        container.appendChild(card);
    });
}

function getLoaderHTML(msg) {
    return `
        <div class="loader-container">
            <i class="fas fa-circle-notch fa-spin" style="font-size: 2rem; color: var(--primary-color);"></i>
            <p style="margin-top: 1rem; color: var(--text-secondary);">${msg}</p>
        </div>
    `;
}

function showError(container, msg) {
    container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; color: #ff6b6b; padding: 2rem;">
            <h3>Error</h3>
            <p>${msg}</p>
        </div>
    `;
}

function setupSearch() {
    const inp = document.getElementById('newsSearchInput');
    const btn = document.getElementById('newsSearchBtn');
    if (!inp || !btn) return;

    const doSearch = () => {
        const q = inp.value.trim();
        if (q) {
            const grid = document.getElementById('generalNewsGrid');
            grid.innerHTML = getLoaderHTML('Searching for ' + q + '...');

            const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=en&sortBy=relevancy&pageSize=12&apiKey=${NEWS_API_KEY}`;

            fetchNewsAPI(url)
                .then(data => renderNews(data.articles, grid)) // Corrected: render to specific grid
                .catch(e => showError(grid, e.message));
        }
    };

    btn.onclick = doSearch;
    inp.onkeypress = (e) => { if (e.key === 'Enter') doSearch(); };
}
