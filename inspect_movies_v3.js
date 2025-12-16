
const https = require('https');

const queries = ["Japanese Mom", "When a Hot Night Opens"];
const apiKey = "798ae7de540b25e908c68ea2ca408347";

function fetchJson(url) {
    return new Promise((resolve) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { resolve({}); }
            });
        }).on('error', () => resolve({}));
    });
}

async function run() {
    const results = [];
    for (const query of queries) {
        const searchData = await fetchJson(`https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(query)}&include_adult=true`);
        if (searchData.results && searchData.results.length > 0) {
            const m = searchData.results[0];
            const keyData = await fetchJson(`https://api.themoviedb.org/3/movie/${m.id}/keywords?api_key=${apiKey}`);
            results.push({
                title: m.title,
                id: m.id,
                vote_count: m.vote_count,
                vote_average: m.vote_average,
                genres: m.genre_ids,
                keywords: keyData.keywords ? keyData.keywords.map(k => `${k.name}(${k.id})`) : []
            });
        }
    }
    console.log(JSON.stringify(results, null, 2));
}

run();
