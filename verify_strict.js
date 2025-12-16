
const https = require('https');

// URL with vote_count.gte=100
const url = "https://api.themoviedb.org/3/discover/movie?api_key=798ae7de540b25e908c68ea2ca408347&with_original_language=ko&include_adult=false&sort_by=popularity.desc&vote_count.gte=100&without_keywords=190370,9838,209700,155465,210065,155477,241932";

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.results) {
                console.log("--- Results with Vote Count >= 100 ---");
                // Check if Japanese Mom is in here (it shouldn't be)
                const junk = json.results.find(m => m.title.includes('Japanese Mom') || m.title.includes('Hot Night'));
                if (junk) {
                    console.log("FAIL: Junk still found:", junk.title);
                } else {
                    console.log("SUCCESS: No junk found in top results.");
                }

                // Show top 5 to ensure quality
                json.results.slice(0, 5).forEach(m => {
                    console.log(`Keep: ${m.title} (${m.vote_count} votes)`);
                });
            } else {
                console.log("No results:", json);
            }
        } catch (e) {
            console.error("Parse error", e);
        }
    });
}).on('error', (err) => {
    console.error("Error: " + err.message);
});
