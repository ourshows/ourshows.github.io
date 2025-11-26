// Custom curated lists for OurShow
// These are manually selected TMDB IDs for special categories

export const CUSTOM_LISTS = {
    // Cult Classics - Iconic films with dedicated followings
    cultClassics: [
        550,    // Fight Club
        13,     // Forrest Gump
        680,    // Pulp Fiction
        769,    // Goodfellas
        278,    // The Shawshank Redemption
        129,    // Spirited Away
        429,    // The Good, the Bad and the Ugly
        240,    // The Godfather
        389,    // 12 Angry Men
        496243  // Parasite
    ],

    // Nepali Hits - Manually curated Nepali cinema
    nepaliHits: [
        // Note: TMDB has limited Nepali content, these are examples
        // You may need to add actual TMDB IDs for Nepali films
    ],

    // Underrated Gems - Hidden treasures
    underratedGems: [
        77,     // Memento
        77,     // Moon
        293660, // Deadpool
        324857, // Spider-Man: Into the Spider-Verse
        335984, // Blade Runner 2049
        424,    // Schindler's List
        155,    // The Dark Knight
        497,    // The Green Mile
        372058, // Your Name
        372058  // Arrival
    ],

    // Action & Thrillers
    actionThrillers: [
        155,    // The Dark Knight
        27205,  // Inception
        603,    // The Matrix
        245891, // John Wick
        324857, // Spider-Man: Into the Spider-Verse
        299536, // Avengers: Infinity War
        299534, // Avengers: Endgame
        76341,  // Mad Max: Fury Road
        198663, // The Maze Runner
        207703  // Kingsman: The Secret Service
    ],

    // Drama & Romance
    dramaRomance: [
        13,     // Forrest Gump
        19404,  // Dilwale Dulhania Le Jayenge (DDLJ)
        19,     // Metropolis
        597,    // Titanic
        11216,  // Cinema Paradiso
        637,    // Life is Beautiful
        329865, // Arrival
        372058, // Your Name
        372754, // Dunkirk
        398818  // Call Me by Your Name
    ]
};

// Regional content priority settings
export const REGIONAL_CONFIG = {
    languages: {
        nepali: 'ne',
        hindi: 'hi'
    },
    // Number of regional items to inject into each standard row
    regionalItemsPerRow: 5,
    // Position to start injecting (0-indexed)
    injectionStartPosition: 2
};
