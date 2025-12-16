
const https = require('https');
const apiKey = "798ae7de540b25e908c68ea2ca408347";

async function run() {
    console.log("Checking Nepali movies...");
    const url = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_original_language=ne&sort_by=popularity.desc&include_adult=false`;

    https.get(url, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            const json = JSON.parse(data);
            if (json.results) {
                json.results.slice(0, 10).forEach(m => {
                    console.log(`${m.title} : ${m.vote_count}`);
                });
            }
        });
    });
}
run();
