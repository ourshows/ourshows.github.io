
// Mobile Navigation & Header Manager
document.addEventListener('DOMContentLoaded', () => {
    const isMobile = window.innerWidth <= 768;

    // --- 1. Bottom Navigation Bar ---
    // Only inject on Mobile
    if (isMobile) {
        // Clear existing if any
        const existingNav = document.querySelector('.bottom-nav');
        if (existingNav) existingNav.remove();

        const navItems = [
            { name: 'Discover', icon: 'fa-compass', link: 'discover.html' },
            { name: 'AI Chat', icon: 'fa-robot', link: 'ai.html' },
            { name: 'Collections', icon: 'fa-bookmark', link: 'collection.html' },
            { name: 'Watchlist', icon: 'fa-list-check', link: 'watchlater.html' },
            { name: 'Chat', icon: 'fa-comments', link: 'communitychat.html' }
        ];

        const navContainer = document.createElement('div');
        navContainer.className = 'bottom-nav';

        const currentPage = window.location.pathname.split('/').pop() || 'index.html';

        navItems.forEach(item => {
            const link = document.createElement('a');
            link.href = item.link;
            link.className = 'nav-item';
            if (currentPage === item.link) link.classList.add('active');
            link.innerHTML = `<i class="fas ${item.icon}"></i><span>${item.name}</span>`;
            navContainer.appendChild(link);
        });

        document.body.appendChild(navContainer);
        document.body.style.paddingBottom = '80px';
    }

    // --- 2. Top Header Customization ---
    const navContent = document.querySelector('.nav-content');
    if (navContent) {
        // Hide Desktop Nav Links & Old Mobile Elements
        const navLinks = document.querySelector('.nav-links');
        if (navLinks) navLinks.style.display = 'none';

        const menuBtn = document.querySelector('.mobile-menu-btn');
        if (menuBtn) menuBtn.style.setProperty('display', 'none', 'important');

        const oldActions = document.querySelector('.nav-actions');
        if (oldActions) oldActions.style.display = 'none';

        const existingMobileActions = document.querySelector('.mobile-actions');
        if (existingMobileActions) existingMobileActions.remove();

        // Create Mobile Actions Container
        const mobileActions = document.createElement('div');
        mobileActions.className = 'mobile-actions';

        // A. Search Bar (Compact with Suggestions)
        const searchContainer = document.createElement('div');
        searchContainer.className = 'mobile-search-wrapper';
        searchContainer.innerHTML = `
                <input type="text" id="mobileSearchInput" placeholder="Search..." autocomplete="off">
                <button class="mobile-search-btn"><i class="fas fa-search"></i></button>
                <div class="mobile-suggestions-dropdown" style="display:none;"></div>
            `;

        const mInput = searchContainer.querySelector('input');
        const mBtn = searchContainer.querySelector('button');
        const suggestionsBox = searchContainer.querySelector('.mobile-suggestions-dropdown');

        // Search Submit
        const performSearch = () => {
            if (mInput.value.trim()) {
                window.location.href = `search.html?q=${encodeURIComponent(mInput.value.trim())}`;
            } else {
                mInput.focus();
            }
        };

        mBtn.addEventListener('click', performSearch);
        mInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performSearch();
        });

        // Live Suggestions Logic
        let debounceTimer;
        mInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            const query = mInput.value.trim();

            if (query.length < 2) {
                suggestionsBox.style.display = 'none';
                return;
            }

            debounceTimer = setTimeout(async () => {
                const results = await fetchSuggestions(query);
                renderSuggestions(results, suggestionsBox);
            }, 300);
        });

        // Close suggestions on click outside
        document.addEventListener('click', (e) => {
            if (!searchContainer.contains(e.target)) {
                suggestionsBox.style.display = 'none';
            }
        });

        // B. Theme Toggle (Fixed Class Logic)
        const themeBtn = document.createElement('button');
        themeBtn.className = 'mobile-icon-btn';

        // Sync Initial State
        const html = document.documentElement;
        const currentTheme = localStorage.getItem('theme') || 'dark';

        // Apply correctly on load
        html.setAttribute('data-theme', currentTheme);
        if (currentTheme === 'light') {
            html.classList.add('theme-light');
            html.classList.remove('theme-dark');
            themeBtn.innerHTML = '<i class="fas fa-sun"></i>';
        } else {
            html.classList.add('theme-dark');
            html.classList.remove('theme-light');
            themeBtn.innerHTML = '<i class="fas fa-moon"></i>';
        }

        themeBtn.addEventListener('click', () => {
            const oldTheme = html.getAttribute('data-theme') || 'dark';
            const newTheme = oldTheme === 'light' ? 'dark' : 'light';

            // Set Attribute
            html.setAttribute('data-theme', newTheme);

            // Set Class (Critical for themes.css)
            html.classList.remove(`theme-${oldTheme}`);
            html.classList.add(`theme-${newTheme}`);

            // Save
            localStorage.setItem('theme', newTheme);

            // Update Icon
            themeBtn.innerHTML = newTheme === 'light' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        });

        // C. Profile Button
        const profileBtn = document.createElement('a');
        profileBtn.href = 'profile.html';
        profileBtn.className = 'mobile-profile-btn'; // Changed class to match styles
        profileBtn.innerHTML = '<i class="fas fa-user-circle"></i>';

        // Append All
        mobileActions.appendChild(searchContainer);
        mobileActions.appendChild(themeBtn);
        mobileActions.appendChild(profileBtn);

        navContent.style.justifyContent = 'space-between';
        navContent.appendChild(mobileActions);
    }
});

// Helper: Fetch Suggestions
async function fetchSuggestions(query) {
    // Try to get config from window
    const config = window.PUBLIC_CONFIG || {};
    const apiKey = config.TMDB_KEY || config.TMDB_API_KEY || '1e448e0dfcdbb565f5d329820065b4d2'; // Fallback key just in case
    const baseUrl = config.TMDB_BASE_URL || 'https://api.themoviedb.org/3';

    try {
        const url = `${baseUrl}/search/multi?api_key=${apiKey}&query=${encodeURIComponent(query)}&page=1&include_adult=false`;
        const res = await fetch(url);
        const data = await res.json();
        return (data.results || []).slice(0, 5); // Limit to top 5
    } catch (e) {
        console.error("Search suggestion error", e);
        return [];
    }
}

// Helper: Render Suggestions
function renderSuggestions(results, container) {
    if (!results.length) {
        container.style.display = 'none';
        return;
    }

    container.innerHTML = '';
    container.style.display = 'block';

    // Style the container dynamically if not in CSS
    container.style.position = 'absolute';
    container.style.top = '100%';
    container.style.right = '0'; // Align right due to flex
    container.style.width = '250px';
    container.style.background = 'rgba(15, 23, 42, 0.95)';
    container.style.backdropFilter = 'blur(10px)';
    container.style.border = '1px solid var(--glass-border)';
    container.style.borderRadius = '12px';
    container.style.overflow = 'hidden';
    container.style.zIndex = '1000';
    container.style.marginTop = '10px';
    container.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';

    results.forEach(item => {
        if (item.media_type === 'person') return; // Skip people

        const div = document.createElement('div');
        div.style.padding = '10px';
        div.style.display = 'flex';
        div.style.gap = '10px';
        div.style.alignItems = 'center';
        div.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        div.style.cursor = 'pointer';

        // Hover effect
        div.onmouseover = () => div.style.background = 'rgba(255,255,255,0.1)';
        div.onmouseout = () => div.style.background = 'transparent';

        const posterPath = item.poster_path ? `https://image.tmdb.org/t/p/w92${item.poster_path}` : 'https://via.placeholder.com/92x138?text=No+Img';
        const title = item.title || item.name;
        const year = (item.release_date || item.first_air_date || '').split('-')[0];

        div.innerHTML = `
            <img src="${posterPath}" style="width: 30px; height: 45px; object-fit: cover; border-radius: 4px;">
            <div style="flex:1; min-width:0;">
                <div style="color: var(--text-primary); font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</div>
                <div style="color: var(--text-secondary); font-size: 0.75rem;">${item.media_type === 'tv' ? 'TV' : 'Movie'} • ${year}</div>
            </div>
        `;

        div.onclick = () => {
            // Open Modal Logic via global function if available, else redirect
            if (window.openMovieModal) {
                window.openMovieModal(item.id, item.media_type || 'movie');
                container.style.display = 'none'; // Close dropdown
            } else {
                window.location.href = `index.html?id=${item.id}&type=${item.media_type || 'movie'}`;
            }
        };

        container.appendChild(div);
    });
}
