// Import Firebase modules
import { auth, db, onAuthStateChanged, collection, getDocs } from './firebase-config.js';

// Quick prompt function
function usePrompt(promptText) {
    document.getElementById('vibeInput').value = promptText;
    findVibe();
}

async function findVibe() {
    const input = document.getElementById('vibeInput').value;
    if (!input) return;

    showLoading(true);

    const prompt = `
        You are a movie recommendation expert. 
        User Request: "${input}".
        
        Return a JSON object with a list of 5 movie or series recommendations. 
        Format: { "recommendations": [ { "title": "Movie Title", "year": "2020", "reason": "Why it fits" } ] }
        Do not include markdown formatting, just raw JSON.
    `;

    try {
        const response = await callHuggingFace(prompt);
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
        const response = await callHuggingFace(prompt);
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

async function getPersonalizedRecs() {
    showLoading(true);

    try {
        // Get current user
        const user = auth.currentUser;
        if (!user) {
            alert("Please log in to get personalized recommendations!");
            window.location.href = 'login.html';
            return;
        }

        // Fetch user's watchlist from Firebase
        const watchlistRef = collection(db, 'users', user.uid, 'watchlist');
        const watchlistSnapshot = await getDocs(watchlistRef);

        if (watchlistSnapshot.empty) {
            alert("Your watchlist is empty! Add some movies first.");
            showLoading(false);
            return;
        }

        // Extract movie titles from watchlist
        const watchedMovies = [];
        watchlistSnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.movieTitle) {
                watchedMovies.push(data.movieTitle);
            }
        });

        const movieList = watchedMovies.slice(0, 10).join(', ');

        const prompt = `
            Based on these movies in the user's watchlist: ${movieList}.
            
            Recommend 5 similar movies or series they would love.
            Format: { "recommendations": [ { "title": "Movie Title", "year": "2020", "reason": "Why it fits their taste" } ] }
            Do not include markdown formatting, just raw JSON.
        `;

        const response = await callHuggingFace(prompt);
        const data = JSON.parse(cleanJson(response));

        displayResults(data.recommendations);
        document.getElementById('aiTextResponse').style.display = 'none';

    } catch (e) {
        console.error(e);
        document.getElementById('aiTextResponse').textContent = "Couldn't fetch your watchlist. Try again!";
        document.getElementById('aiTextResponse').style.display = 'block';
    } finally {
        showLoading(false);
    }
}

async function callHuggingFace(prompt) {
    if (!window.APP_CONFIG || !window.APP_CONFIG.HUGGINGFACE_API_KEY) {
        throw new Error("Hugging Face API key not configured");
    }

    const HF_API_KEY = window.APP_CONFIG.HUGGINGFACE_API_KEY;
    const HF_MODEL = "meta-llama/Llama-3.2-3B-Instruct";
    const url = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${HF_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            inputs: prompt,
            parameters: {
                max_new_tokens: 300,
                temperature: 0.7,
                top_p: 0.9,
                return_full_text: false
            }
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error('Hugging Face API Error:', errorData);

        if (errorData.error && errorData.error.includes('loading')) {
            throw new Error('AI model is warming up. Please try again in a few seconds.');
        }

        throw new Error(`API Error: ${errorData.error || response.statusText}`);
    }

    const data = await response.json();

    // Hugging Face returns an array with generated text
    if (Array.isArray(data) && data[0]?.generated_text) {
        return data[0].generated_text;
    } else if (typeof data === 'string') {
        return data;
    } else {
        console.error('Unexpected API response:', data);
        throw new Error('Invalid response format from AI.');
    }
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
    const url = new URL(`${window.APP_CONFIG.TMDB_BASE_URL}/search/multi`);
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

// Expose functions to window for onclick handlers
window.usePrompt = usePrompt;
window.findVibe = findVibe;
window.roastMyTaste = roastMyTaste;
window.getPersonalizedRecs = getPersonalizedRecs;
