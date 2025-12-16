
const https = require('https');

const queries = ["Japanese Mom", "When a Hot Night Opens"];
const apiKey = "798ae7de540b25e908c68ea2ca408347";

queries.forEach(query => {
    const url = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(query)}&include_adult=true`;

    https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                if (json.results && json.results.length > 0) {
                    const movie = json.results[0]; // best match
                    console.log(`\n--- ${query} ---`);
                    console.log(`Title: ${movie.title}`);
                    console.log(`ID: ${movie.id}`);
                    console.log(`Adult: ${movie.adult}`);
                    console.log(`Genre IDs: ${movie.genre_ids}`);
                    console.log(`Vote Count: ${movie.vote_count}`);
                    console.log(`Vote Average: ${movie.vote_average}`);
                    console.log(`Language: ${movie.original_language}`);

                    // Fetch Keywords for this movie
                    fetchKeywords(movie.id);
                } else {
                    console.log(`\nNo results for ${query}`);
                }
            } catch (e) {
                console.error(e);
            }
        });
    });
});

function fetchKeywords(movieId) {
    const url = `https://api.themoviedb.org/3/movie/${movieId}/keywords?api_key=${apiKey}`;
    https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                const keywords = json.keywords ? json.keywords.map(k => `${k.name} (${k.id})`).join(', ') : 'None';
                console.log(`Keywords for ${movieId}: ${keywords}`);
            } catch (e) {
                console.error(e);
            }
        });
    });
}
