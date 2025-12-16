
const https = require('https');
const apiKey = "798ae7de540b25e908c68ea2ca408347";
async function run() {
    // Japanese Mom ID
    const id = 469721; // From previous run or I'll search again if I missed it, but let's search to be safe.

    // First search to get ID
    const s = await fetchJson(`https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=Japanese+Mom`);
    const m = s.results[0];
    console.log(`Checking: ${m.title} (${m.id})`);

    const d = await fetchJson(`https://api.themoviedb.org/3/movie/${m.id}/release_dates?api_key=${apiKey}`);
    if (d.results) {
        d.results.forEach(r => {
            console.log(`Country: ${r.iso_3166_1}`);
            r.release_dates.forEach(rd => console.log(` - Cert: ${rd.certification}`));
        });
    }
}
function fetchJson(url) { return new Promise(r => https.get(url, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => r(JSON.parse(d))); })); }
run();
