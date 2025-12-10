// Configuration for OurShow
// INSTRUCTIONS: Copy this file to 'config.js' and add your actual API keys

const CONFIG = {
    // TMDB API Configuration
    // Get your API key from: https://www.themoviedb.org/settings/api
    TMDB_API_KEY: 'YOUR_TMDB_API_KEY_HERE',
    TMDB_BASE_URL: 'https://api.themoviedb.org/3',
    TMDB_IMAGE_BASE_URL: 'https://image.tmdb.org/t/p/original',
    TMDB_IMAGE_SMALL_URL: 'https://image.tmdb.org/t/p/w500',

    // Hugging Face API Configuration (for AI features)
    // Get your API key from: https://huggingface.co/settings/tokens
    HUGGINGFACE_API_KEY: 'YOUR_HUGGINGFACE_API_KEY_HERE',

    // Google Gemini API Configuration (for AI assistant)
    // Get your API key from: https://makersuite.google.com/app/apikey
    GEMINI_API_KEY: 'YOUR_GEMINI_API_KEY_HERE'
};

// Make config available globally
window.APP_CONFIG = CONFIG;
console.log('Config loaded successfully');
