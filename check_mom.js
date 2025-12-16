
const https = require('https');
const apiKey = "798ae7de540b25e908c68ea2ca408347";
async function run() {
    // Only Japanese Mom
    const d = await fetchJson(`https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=Japanese+Mom`);
    if (d.results && d.results[0]) {
        const m = d.results[0];
        console.log(`Title: ${m.title}`);
        console.log(`Votes: ${m.vote_count}`);
        console.log(`Rating: ${m.vote_average}`);
    }
}
function fetchJson(url) { return new Promise(r => https.get(url, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => r(JSON.parse(d))); })); }
run();
