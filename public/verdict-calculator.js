// Verdict Calculator Utility
// Combines TMDB ratings with OurShow community reviews

// Convert text ratings to numeric scores
const RATING_TO_NUMERIC = {
    'Perfection': 10,
    'Go for it': 8,
    'Go For It': 8,
    'One time watch': 6,
    'One Time Watch': 6,
    'Pass': 3,
    'Skip': 3
};

// Calculate average OurShow rating from reviews
function calculateOurShowAverage(reviews) {
    if (!reviews || reviews.length === 0) return null;

    const numericRatings = reviews
        .filter(r => r.source === 'ourshow' && r.rating)
        .map(r => {
            // If already numeric, use it
            if (typeof r.rating === 'number') return r.rating;
            // Convert text rating to numeric
            return RATING_TO_NUMERIC[r.rating] || 0;
        })
        .filter(r => r > 0);

    if (numericRatings.length === 0) return null;

    const sum = numericRatings.reduce((a, b) => a + b, 0);
    return sum / numericRatings.length;
}

// Calculate combined verdict
function calculateCombinedVerdict(tmdbRating, imdbRating, reviews) {
    const ourshowAvg = calculateOurShowAverage(reviews);
    const ourshowCount = reviews ? reviews.filter(r => r.source === 'ourshow').length : 0;

    let finalRating;
    let source = 'TMDB';

    // Normalize IMDb rating (IMDb uses 0-10, same as TMDB)
    const normalizedImdb = imdbRating && imdbRating > 0 ? imdbRating : null;

    // Three-way calculation: 40% TMDB + 40% IMDb + 20% OurShow
    if (tmdbRating && normalizedImdb && ourshowAvg !== null && ourshowCount >= 1) {
        finalRating = (tmdbRating * 0.4) + (normalizedImdb * 0.4) + (ourshowAvg * 0.2);
        source = 'Combined (TMDB + IMDb + OurShow)';
    }
    // Two-way: TMDB + IMDb (no OurShow reviews)
    else if (tmdbRating && normalizedImdb) {
        finalRating = (tmdbRating * 0.5) + (normalizedImdb * 0.5);
        source = 'TMDB + IMDb';
    }
    // Two-way: TMDB + OurShow (no IMDb)
    else if (tmdbRating && ourshowAvg !== null && ourshowCount >= 1) {
        finalRating = (tmdbRating * 0.7) + (ourshowAvg * 0.3);
        source = 'TMDB + OurShow';
    }
    // Two-way: IMDb + OurShow (no TMDB)
    else if (normalizedImdb && ourshowAvg !== null && ourshowCount >= 1) {
        finalRating = (normalizedImdb * 0.7) + (ourshowAvg * 0.3);
        source = 'IMDb + OurShow';
    }
    // Single source fallbacks
    else if (tmdbRating) {
        finalRating = tmdbRating;
        source = 'TMDB';
    }
    else if (normalizedImdb) {
        finalRating = normalizedImdb;
        source = 'IMDb';
    }
    else if (ourshowAvg !== null) {
        finalRating = ourshowAvg;
        source = 'OurShow';
    }
    else {
        finalRating = 0;
        source = 'N/A';
    }

    // Determine verdict text and class
    let verdict = { text: 'N/A', class: 'verdict-na' };
    if (finalRating >= 8.5) {
        verdict = { text: 'Perfection', class: 'verdict-perfection' };
    } else if (finalRating >= 7.0) {
        verdict = { text: 'Go for it', class: 'verdict-go' };
    } else if (finalRating >= 5.0) {
        verdict = { text: 'One time watch', class: 'verdict-once' };
    } else if (finalRating > 0) {
        verdict = { text: 'Pass', class: 'verdict-pass' };
    }

    return {
        ...verdict,
        finalRating: finalRating.toFixed(1),
        tmdbRating: tmdbRating ? tmdbRating.toFixed(1) : 'N/A',
        imdbRating: normalizedImdb ? normalizedImdb.toFixed(1) : 'N/A',
        ourshowRating: ourshowAvg ? ourshowAvg.toFixed(1) : 'N/A',
        ourshowCount,
        source
    };
}

// Export for use in modal files
if (typeof window !== 'undefined') {
    window.calculateCombinedVerdict = calculateCombinedVerdict;
}
