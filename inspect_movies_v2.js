
const https = require('https');

const queries = ["Japanese Mom", "When a Hot Night Opens"];
const apiKey = "798ae7de540b25e908c68ea2ca408347";

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function run() {
    for (const query of queries) {
        try {
            const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(query)}&include_adult=true`;
            const searchData = await fetchJson(searchUrl);

            if (searchData.results && searchData.results.length > 0) {
                const movie = searchData.results[0];
                console.log(`\n========================================`);
                console.log(`Title: ${movie.title}`);
                console.log(`ID: ${movie.id}`);
                console.log(`Adult: ${movie.adult}`); // Likely false even for these
                console.log(`Genre IDs: ${movie.genre_ids}`);
                console.log(`Vote Count: ${movie.vote_count}`);
                console.log(`Vote Average: ${movie.vote_average}`);
                console.log(`Language: ${movie.original_language}`);

                const keywordsUrl = `https://api.themoviedb.org/3/movie/${movie.id}/keywords?api_key=${apiKey}`;
                const keywordsData = await fetchJson(keywordsUrl);
                const keywords = keywordsData.keywords ? keywordsData.keywords.map(k => `${k.name} (${k.id})`).join(', ') : 'None';
                console.log(`Keywords: ${keywords}`);
            } else {
                console.log(`\nNo results for ${query}`);
            }
        } catch (e) {
            console.error(e);
        }
    }
}

run();
