
// Logic for fetching news

document.addEventListener('DOMContentLoaded', () => {
    fetchNews();

    const searchInput = document.getElementById('newsSearchInput');
    const searchBtn = document.getElementById('newsSearchBtn');

    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', () => {
            const query = searchInput.value.trim();
            if (query) fetchNews(query);
        });

        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = searchInput.value.trim();
                if (query) fetchNews(query);
            }
        });
    }
});

async function fetchNews(query = '') {
    const grid = document.getElementById('newsGrid');

    // Show loader and clear current if new search
    grid.innerHTML = `
        <div class="loader-container">
            <i class="fas fa-circle-notch fa-spin" style="font-size: 2rem; color: var(--primary-color);"></i>
            <p style="margin-top: 1rem; color: var(--text-secondary);">Fetching latest updates...</p>
        </div>
    `;

    try {
        const API_KEY = '5dcb6530eadd4f7e8e3b273e934a4e45'; // User provided key
        let url;

        if (query) {
            // User searching for specific topic (e.g., "Stranger Things")
            // Use 'everything' to find mentions
            url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=12&apiKey=${API_KEY}`;
        } else {
            // Default: Breaking Entertainment headlines (Variety, Deadline, etc.)
            // This is better for "What is airing tomorrow" / Industry buzz
            url = `https://newsapi.org/v2/top-headlines?country=us&category=entertainment&pageSize=12&apiKey=${API_KEY}`;
        }

        const response = await fetch(url);
        const data = await response.json();

        if (data.status !== 'ok') {
            throw new Error(data.message || 'Failed to fetch news');
        }

        renderNews(data.articles);

    } catch (error) {
        console.error('News Error:', error);
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; color: #ff6b6b;">
                <h3>Unable to load news</h3>
                <p>${error.message}</p>
                <button onclick="fetchNews()" style="margin-top:1rem; padding:0.5rem 1rem; background:var(--glass-border); border:none; color:white; cursor:pointer; border-radius:4px;">Try Again</button>
            </div>
        `;
    }
}

function renderNews(articles) {
    const grid = document.getElementById('newsGrid');
    grid.innerHTML = '';

    // Filter out removed articles
    const validArticles = articles.filter(a => a.title !== '[Removed]' && a.urlToImage);

    if (validArticles.length === 0) {
        grid.innerHTML = '<p>No news found.</p>';
        return;
    }

    validArticles.forEach(article => {
        const date = new Date(article.publishedAt).toLocaleDateString(undefined, {
            month: 'short', day: 'numeric'
        });

        const card = document.createElement('div');
        card.className = 'news-card';
        card.innerHTML = `
            <img src="${article.urlToImage}" alt="News Image" class="news-image" loading="lazy">
            <div class="news-content">
                <div class="news-source">
                    <span>${article.source.name}</span>
                    <span class="news-date">${date}</span>
                </div>
                <div class="news-title">${article.title}</div>
                <div class="news-desc">${article.description || ''}</div>
                <a href="${article.url}" target="_blank" class="read-more-btn">Read Full Story</a>
            </div>
        `;
        grid.appendChild(card);
    });
}
