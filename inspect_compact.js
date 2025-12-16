
const https = require('https');
const apiKey = "798ae7de540b25e908c68ea2ca408347";
async function run() {
    const q = ["Japanese Mom", "When a Hot Night Opens"];
    for (const t of q) {
        const d = await fetchJson(`https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(t)}`);
        if (d.results && d.results[0]) {
            const m = d.results[0];
            const k = await fetchJson(`https://api.themoviedb.org/3/movie/${m.id}/keywords?api_key=${apiKey}`);
            console.log(`${m.title} | Votes: ${m.vote_count} | Keys: ${k.keywords.map(i => i.id).join(',')}`);
        }
    }
}
function fetchJson(url) { return new Promise(r => https.get(url, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => r(JSON.parse(d))); })); }
run();
