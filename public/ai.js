async function findVibe() {
    const input = document.getElementById('vibeInput').value;
    if (!input) return;

    showLoading(true);

    // Construct Prompt for Gemini
    const prompt = `
        You are a movie recommendation expert. 
        User Request: "${input}".
        
        Return a JSON object with a list of 5 movie recommendations. 
        Format: { "recommendations": [ { "title": "Movie Title", "year": "2020", "reason": "Why it fits" } ] }
        Do not include markdown formatting, just raw JSON.
    `;

    try {
        const response = await callGemini(prompt);
        const data = JSON.parse(cleanJson(response));

        displayResults(data.recommendations);
        document.getElementById('aiTextResponse').style.display = 'none';

    } catch (e) {
        console.error(e);
        document.getElementById('aiTextResponse').textContent = "AI is thinking too hard... try again.";
        document.getElementById('aiTextResponse').style.display = 'block';
    } finally {
        showLoading(false);
    }
}

async function roastMyTaste() {
    // In a real app, we'd fetch the user's watchlist/history here.
    // For now, we'll ask them to input their favorite movies.
    const input = document.getElementById('vibeInput').value;
    if (!input) {
        alert("Enter your favorite movies in the box above to get roasted!");
        return;
    }

    showLoading(true);

    const prompt = `
        User likes these movies: "${input}".
        Roast their taste in movies. Be funny, slightly mean, but playful. Keep it under 50 words.
    `;

    try {
        const response = await callGemini(prompt);
        const textDiv = document.getElementById('aiTextResponse');
        textDiv.textContent = response;
        textDiv.style.display = 'block';
        document.getElementById('aiResults').innerHTML = ''; // Clear movies
    } catch (e) {
        console.error(e);
    } finally {
        showLoading(false);
    }
}

async function callGemini(prompt) {
    if (!window.APP_CONFIG || !window.APP_CONFIG.GEMINI_API_KEY) {
        throw new Error("Gemini Key Missing");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${window.APP_CONFIG.GEMINI_API_KEY}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

function cleanJson(text) {
    // Remove markdown code blocks if present
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

async function displayResults(recommendations) {
    const container = document.getElementById('aiResults');
    container.innerHTML = '';

    for (const rec of recommendations) {
        // Search TMDB to get the poster
        const tmdbData = await searchTMDB(rec.title, rec.year);

        const card = document.createElement('div');
        card.className = 'media-card';

        let posterSrc = 'https://via.placeholder.com/200x300?text=No+Image';
        let id = '';
        let type = 'movie';

        if (tmdbData) {
            posterSrc = `${window.APP_CONFIG.TMDB_IMAGE_SMALL_URL}${tmdbData.poster_path}`;
            id = tmdbData.id;
            type = tmdbData.media_type || 'movie';
        }

        card.innerHTML = `
            <img class="media-poster" src="${posterSrc}" alt="${rec.title}">
            <div class="media-info">
                <div class="media-title">${rec.title}</div>
                <div class="media-year" style="font-size: 0.7rem; opacity: 0.8;">${rec.reason}</div>
            </div>
        `;

        if (id) {
            card.onclick = () => window.location.href = `watchanddownload.html?id=${id}&type=${type}`;
        }

        container.appendChild(card);
    }
}

async function searchTMDB(query, year) {
    const url = new URL(`${window.APP_CONFIG.TMDB_BASE_URL}/search/movie`);
    url.searchParams.append('api_key', window.APP_CONFIG.TMDB_API_KEY);
    url.searchParams.append('query', query);
    if (year) url.searchParams.append('year', year);

    try {
        const res = await fetch(url);
        const data = await res.json();
        return data.results[0];
    } catch {
        return null;
    }
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
}
