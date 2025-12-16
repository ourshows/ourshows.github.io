
const https = require('https');
const apiKey = "798ae7de540b25e908c68ea2ca408347";
async function run() {
    // Check legitimate erotic/romance movies
    const q = ["Obsessed", "The Handmaiden", "A Man and A Woman"];
    for (const t of q) {
        const d = await fetchJson(`https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(t)}`);
        if (d.results && d.results[0]) {
            const m = d.results[0];
            console.log(`${m.title} | Votes: ${m.vote_count}`);
        }
    }
}
function fetchJson(url) { return new Promise(r => https.get(url, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => r(JSON.parse(d))); })); }
run();
