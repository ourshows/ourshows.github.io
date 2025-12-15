
// 1. Data Structure: MASTER_DISCOVER_ITEMS (50+ items)
const MASTER_DISCOVER_ITEMS = [
    // 2025 English Action Movies
    { id: 101, title: "Cyber Justice", type: "Movie", genre: "Action", language: "English", release_year: 2025, poster_path: "/1.jpg" },
    { id: 102, title: "The Last Horizon", type: "Movie", genre: "Sci-Fi", language: "English", release_year: 2025, poster_path: "/2.jpg" },
    { id: 103, title: "Spy Games 2025", type: "Movie", genre: "Thriller", language: "English", release_year: 2025, poster_path: "/3.jpg" },

    // 2024 Hindi Drama
    { id: 201, title: "Mumbai Dreams", type: "Movie", genre: "Drama", language: "Hindi", release_year: 2024, poster_path: "/4.jpg" },
    { id: 202, title: "Family Ties", type: "TV", genre: "Drama", language: "Hindi", release_year: 2024, poster_path: "/5.jpg" },
    { id: 203, title: "Laugh Riot", type: "Movie", genre: "Comedy", language: "Hindi", release_year: 2024, poster_path: "/6.jpg" },

    // Nepali Content
    { id: 301, title: "Himalayan Hero", type: "Movie", genre: "Action", language: "Nepali", release_year: 2023, poster_path: "/7.jpg" },
    { id: 302, title: "Kathmandu Valley", type: "TV", genre: "Drama", language: "Nepali", release_year: 2024, poster_path: "/8.jpg" },
    { id: 303, title: "Village Life", type: "TV", genre: "Comedy", language: "Nepali", release_year: 2025, poster_path: "/9.jpg" },

    // Korean & Chinese
    { id: 401, title: "Seoul Nights", type: "TV", genre: "Drama", language: "Korean", release_year: 2024, poster_path: "/10.jpg" },
    { id: 402, title: "Dragon Warrior", type: "Movie", genre: "Action", language: "Chinese", release_year: 2023, poster_path: "/11.jpg" },
    { id: 403, title: "K-Pop Star", type: "TV", genre: "Comedy", language: "Korean", release_year: 2025, poster_path: "/12.jpg" },

    // More Mock Data to reach 50+
    { id: 501, title: "Space Odyssey", type: "Movie", genre: "Sci-Fi", language: "English", release_year: 2023, poster_path: "/13.jpg" },
    { id: 502, title: "Dark Matter", type: "TV", genre: "Sci-Fi", language: "English", release_year: 2024, poster_path: "/14.jpg" },
    { id: 503, title: "The Detective", type: "Movie", genre: "Thriller", language: "Chinese", release_year: 2024, poster_path: "/15.jpg" },
    { id: 504, title: "Chasing Shadows", type: "Movie", genre: "Thriller", language: "Korean", release_year: 2023, poster_path: "/16.jpg" },
    { id: 505, title: "Love in Tokyo", type: "Movie", genre: "Drama", language: "English", release_year: 2025, poster_path: "/17.jpg" },
    { id: 506, title: "Action Jackson", type: "Movie", genre: "Action", language: "Hindi", release_year: 2023, poster_path: "/18.jpg" },
    { id: 507, title: "Comedy Central", type: "TV", genre: "Comedy", language: "English", release_year: 2024, poster_path: "/19.jpg" },
    { id: 508, title: "Future War", type: "Movie", genre: "Sci-Fi", language: "Hindi", release_year: 2025, poster_path: "/20.jpg" },
    { id: 509, title: "Mountain Peak", type: "TV", genre: "Drama", language: "Nepali", release_year: 2023, poster_path: "/21.jpg" },
    { id: 510, title: "City Lights", type: "Movie", genre: "Drama", language: "English", release_year: 2024, poster_path: "/22.jpg" },

    // Generating logical fillers
    ...Array.from({ length: 30 }, (_, i) => ({
        id: 600 + i,
        title: `Mock Title ${i + 1}`,
        type: i % 2 === 0 ? "Movie" : "TV",
        genre: ["Action", "Comedy", "Drama", "Sci-Fi", "Thriller"][i % 5],
        language: ["Hindi", "English", "Nepali", "Korean", "Chinese"][i % 5],
        release_year: 2023 + (i % 3), // 2023, 2024, 2025
        poster_path: `/mock${i}.jpg`
    }))
];

// 2. State Management
const appState = {
    filters: {
        type: 'All',
        genre: 'All',
        language: 'All',
        year: 'All'
    },
    loadedCount: 0,
    BATCH_SIZE: 10,
    filteredItems: [], // Cache of currently filtered items
    isLoading: false
};

// 3. Initialization
document.addEventListener('DOMContentLoaded', () => {
    setupFilters();
    applyFilters(); // Initial filter & render
    setupInfiniteScroll();
});

// 4. Setup Filter Listeners
function setupFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const filterType = e.target.dataset.filter; // type, genre, language, year
            const value = e.target.dataset.value;

            // Update UI (Active class)
            document.querySelectorAll(`.filter-btn[data-filter="${filterType}"]`).forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            // Update State
            appState.filters[filterType] = value;

            // Reset list and re-filter
            appState.loadedCount = 0;
            document.getElementById('discoverGrid').innerHTML = '';
            applyFilters();
        });
    });
}

// 5. Apply Filters (Cumulative) and Populate Cache
function applyFilters() {
    // Filter the MASTER list based on ALL state criteria
    appState.filteredItems = MASTER_DISCOVER_ITEMS.filter(item => {
        const f = appState.filters;
        const typeMatch = f.type === 'All' || item.type === f.type; // Matches specific string (e.g. 'Movie' vs 'Movie') - Note: Check case carefully
        const genreMatch = f.genre === 'All' || item.genre === f.genre;
        const langMatch = f.language === 'All' || item.language === f.language;
        const yearMatch = f.year === 'All' || String(item.release_year) === f.year;

        return typeMatch && genreMatch && langMatch && yearMatch;
    });

    // Check data consistency: Ensure Types match exactly (TV vs TV, Movie vs Movie)
    // The Master list uses 'Movie' and 'TV'. The buttons use 'TV' and 'Movies' (singular vs plural mismatch in button maybe?)
    // Let's check HTML. HTML button value says "Movie" (singular) for type. Good.

    // Render first batch
    loadMoreItems();
}

// 6. Load More Items (Infinite Scroll Logic)
function loadMoreItems() {
    if (appState.isLoading) return;
    appState.isLoading = true;

    const sentinel = document.getElementById('sentinel');
    sentinel.style.opacity = '1';

    // Simulate network delay for realism (optional, kept short)
    setTimeout(() => {
        const start = appState.loadedCount;
        const end = start + appState.BATCH_SIZE;
        const batch = appState.filteredItems.slice(start, end);

        if (batch.length > 0) {
            renderGrid(batch);
            appState.loadedCount += batch.length;
        } else {
            // No more items
            sentinel.style.opacity = '0';
        }

        appState.isLoading = false;

        // Hide sentinel if we've shown everything
        if (appState.loadedCount >= appState.filteredItems.length) {
            sentinel.style.opacity = '0';
        }
    }, 300);
}

// 7. Render Grid
function renderGrid(items) {
    const container = document.getElementById('discoverGrid');

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'media-card'; // Reuse global styles

        // Placeholder or real image
        const imgUrl = item.poster_path.startsWith('/')
            ? `https://via.placeholder.com/300x450/1a1a1a/ffffff?text=${encodeURIComponent(item.title)}` // Mock image
            : item.poster_path;

        card.innerHTML = `
            <div class="media-poster-container">
                <img class="media-poster" src="${imgUrl}" alt="${item.title}">
                <div class="card-rating-badge">${item.release_year}</div>
                <div class="card-overlay">
                    <button class="card-download-btn"><i class="fas fa-play"></i> Watch</button>
                </div>
            </div>
            <div class="media-info">
                <div class="media-title">${item.title}</div>
                <div class="media-year" style="display:flex; justify-content:space-between; font-size:0.8rem; opacity:0.7;">
                    <span>${item.language}</span>
                    <span>${item.genre}</span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// 8. Infinite Scroll Observer
function setupInfiniteScroll() {
    const sentinel = document.getElementById('sentinel');
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            // Check if we still have items to load
            if (appState.loadedCount < appState.filteredItems.length) {
                loadMoreItems();
            }
        }
    }, { rootMargin: '200px' });

    observer.observe(sentinel);
}
