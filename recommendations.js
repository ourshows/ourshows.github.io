// recommendations.js - Advanced Recommendation System
// Collaborative filtering, mood-based, seasonal recommendations

let db, auth, currentUser;
let userPreferences = {};
let similarUsers = [];

// Initialize
async function initRecommendations() {
  try {
    if (typeof waitForFirebase === 'function') {
      await waitForFirebase();
    }
    const { getAuth } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js');
    const { getDatabase } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
    
    auth = window.authMod || getAuth();
    db = window.dbMod || getDatabase();
    
    if (auth) {
      auth.onAuthStateChanged((user) => {
        currentUser = user;
        if (user) {
          loadUserPreferences();
          findSimilarUsers();
        }
      });
    }
  } catch (err) {
    console.warn('Firebase not available for recommendations');
  }
}

// Load user preferences from watched items
async function loadUserPreferences() {
  const watchedItems = window.getWatchedItems ? window.getWatchedItems() : [];
  
  // Analyze preferences
  const genres = {};
  const ratings = [];
  const years = [];
  
  watchedItems.forEach(item => {
    // Track genres
    if (item.genres && Array.isArray(item.genres)) {
      item.genres.forEach(genre => {
        const genreName = genre.name || genre;
        genres[genreName] = (genres[genreName] || 0) + 1;
      });
    }
    
    // Track ratings
    if (item.rating) {
      ratings.push(item.rating);
    }
    
    // Track years
    if (item.year) {
      years.push(parseInt(item.year));
    }
  });
  
  userPreferences = {
    favoriteGenres: Object.entries(genres)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([genre]) => genre),
    averageRating: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 7.0,
    preferredYears: years.length > 0 ? {
      min: Math.min(...years),
      max: Math.max(...years)
    } : null
  };
}

// Find users with similar tastes (collaborative filtering)
async function findSimilarUsers() {
  if (!db || !currentUser) return;
  
  try {
    const { ref, get } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
    const usersRef = ref(db, 'ourshow/users');
    const snapshot = await get(usersRef);
    
    if (!snapshot.exists()) return;
    
    const currentWatched = window.getWatchedItems ? window.getWatchedItems() : [];
    const currentGenres = new Set();
    currentWatched.forEach(item => {
      if (item.genres) {
        item.genres.forEach(g => currentGenres.add(g.name || g));
      }
    });
    
    const users = snapshot.val();
    const similarities = [];
    
    Object.entries(users).forEach(([userId, userData]) => {
      if (userId === currentUser.uid) return;
      
      const userWatched = userData.watched || {};
      const userGenres = new Set();
      Object.values(userWatched).forEach(item => {
        if (item.genres) {
          item.genres.forEach(g => userGenres.add(g.name || g));
        }
      });
      
      // Calculate similarity (Jaccard similarity)
      const intersection = new Set([...currentGenres].filter(x => userGenres.has(x)));
      const union = new Set([...currentGenres, ...userGenres]);
      const similarity = union.size > 0 ? intersection.size / union.size : 0;
      
      if (similarity > 0.2) { // At least 20% genre overlap
        similarities.push({ userId, similarity, watched: userWatched });
      }
    });
    
    similarUsers = similarities.sort((a, b) => b.similarity - a.similarity).slice(0, 10);
  } catch (error) {
    console.error('Error finding similar users:', error);
  }
}

// Get recommendations based on watched item
async function getRecommendationsBasedOn(itemId, itemData) {
  const recommendations = [];
  
  // Get similar items from TMDB
  try {
    const type = itemData.type || itemData.media_type || 'movie';
    const endpoint = type === 'tv' ? `/tv/${itemId}/similar` : `/movie/${itemId}/similar`;
    const similar = await tmdbFetch(endpoint);
    
    if (similar && similar.results) {
      recommendations.push(...similar.results.slice(0, 10).map(item => ({
        ...item,
        reason: `Similar to ${itemData.title || itemData.name}`,
        score: item.vote_average || 0
      })));
    }
  } catch (error) {
    console.error('Error fetching similar items:', error);
  }
  
  // Get recommendations from similar users
  similarUsers.forEach(({ watched }) => {
    Object.values(watched).forEach(watchedItem => {
      if (watchedItem.id !== itemId) {
        const exists = recommendations.find(r => r.id === watchedItem.id);
        if (!exists) {
          recommendations.push({
            ...watchedItem,
            reason: 'Users with similar tastes watched this',
            score: watchedItem.rating || 7.0
          });
        }
      }
    });
  });
  
  return recommendations.sort((a, b) => b.score - a.score).slice(0, 20);
}

// Mood-based recommendations
async function getMoodBasedRecommendations(mood) {
  const moodMap = {
    'happy': { genres: [35, 10402], keywords: 'uplifting, comedy, musical' },
    'sad': { genres: [18, 10749], keywords: 'drama, emotional, romance' },
    'excited': { genres: [28, 12], keywords: 'action, adventure, thriller' },
    'relaxed': { genres: [99, 16], keywords: 'documentary, animation, nature' },
    'scared': { genres: [27, 53], keywords: 'horror, thriller, suspense' },
    'romantic': { genres: [10749, 18], keywords: 'romance, drama, love' }
  };
  
  const moodConfig = moodMap[mood.toLowerCase()] || moodMap['happy'];
  
  try {
    const endpoint = `/discover/movie?with_genres=${moodConfig.genres.join(',')}&sort_by=popularity.desc&vote_average.gte=7`;
    const results = await tmdbFetch(endpoint);
    
    if (results && results.results) {
      return results.results.slice(0, 20).map(item => ({
        ...item,
        reason: `Perfect for ${mood} mood`,
        score: item.vote_average || 0
      }));
    }
  } catch (error) {
    console.error('Error fetching mood recommendations:', error);
  }
  
  return [];
}

// Time-based recommendations
async function getTimeBasedRecommendations() {
  const hour = new Date().getHours();
  const recommendations = [];
  
  // Morning (6-12): Light, uplifting content
  if (hour >= 6 && hour < 12) {
    try {
      const results = await tmdbFetch('/discover/movie?with_genres=35,16&sort_by=popularity.desc');
      if (results && results.results) {
        recommendations.push(...results.results.slice(0, 10).map(item => ({
          ...item,
          reason: 'Great for morning viewing',
          score: item.vote_average || 0
        })));
      }
    } catch (error) {
      console.error('Error fetching morning recommendations:', error);
    }
  }
  // Afternoon (12-18): Action, adventure
  else if (hour >= 12 && hour < 18) {
    try {
      const results = await tmdbFetch('/discover/movie?with_genres=28,12&sort_by=popularity.desc');
      if (results && results.results) {
        recommendations.push(...results.results.slice(0, 10).map(item => ({
          ...item,
          reason: 'Perfect afternoon entertainment',
          score: item.vote_average || 0
        })));
      }
    } catch (error) {
      console.error('Error fetching afternoon recommendations:', error);
    }
  }
  // Evening (18-22): Drama, thriller
  else if (hour >= 18 && hour < 22) {
    try {
      const results = await tmdbFetch('/discover/movie?with_genres=18,53&sort_by=popularity.desc');
      if (results && results.results) {
        recommendations.push(...results.results.slice(0, 10).map(item => ({
          ...item,
          reason: 'Evening drama and suspense',
          score: item.vote_average || 0
        })));
      }
    } catch (error) {
      console.error('Error fetching evening recommendations:', error);
    }
  }
  // Night (22-6): Horror, thriller
  else {
    try {
      const results = await tmdbFetch('/discover/movie?with_genres=27,53&sort_by=popularity.desc');
      if (results && results.results) {
        recommendations.push(...results.results.slice(0, 10).map(item => ({
          ...item,
          reason: 'Late night thrills',
          score: item.vote_average || 0
        })));
      }
    } catch (error) {
      console.error('Error fetching night recommendations:', error);
    }
  }
  
  return recommendations;
}

// Seasonal recommendations
async function getSeasonalRecommendations() {
  const month = new Date().getMonth() + 1;
  const recommendations = [];
  
  // Holiday seasons
  if (month === 12) {
    // Christmas movies
    try {
      const results = await tmdbFetch('/discover/movie?with_keywords=christmas,holiday&sort_by=popularity.desc');
      if (results && results.results) {
        recommendations.push(...results.results.slice(0, 10).map(item => ({
          ...item,
          reason: 'Holiday season special',
          score: item.vote_average || 0
        })));
      }
    } catch (error) {
      console.error('Error fetching holiday recommendations:', error);
    }
  } else if (month >= 6 && month <= 8) {
    // Summer blockbusters
    try {
      const results = await tmdbFetch('/discover/movie?primary_release_date.gte=2020-06-01&primary_release_date.lte=2024-08-31&sort_by=popularity.desc');
      if (results && results.results) {
        recommendations.push(...results.results.slice(0, 10).map(item => ({
          ...item,
          reason: 'Summer blockbuster',
          score: item.vote_average || 0
        })));
      }
    } catch (error) {
      console.error('Error fetching summer recommendations:', error);
    }
  }
  
  return recommendations;
}

// Group recommendations (find something for multiple people)
async function getGroupRecommendations(userIds) {
  // Get watched items from all users
  const allWatched = new Set();
  const commonGenres = new Map();
  
  // This would need to fetch from Firebase for each user
  // For now, return popular items that appeal to broad audiences
  try {
    const results = await tmdbFetch('/discover/movie?sort_by=popularity.desc&vote_average.gte=7.5&vote_count.gte=1000');
    if (results && results.results) {
      return results.results.slice(0, 20).map(item => ({
        ...item,
        reason: 'Popular choice for groups',
        score: item.vote_average || 0
      }));
    }
  } catch (error) {
    console.error('Error fetching group recommendations:', error);
  }
  
  return [];
}

// Export functions
window.getRecommendationsBasedOn = getRecommendationsBasedOn;
window.getMoodBasedRecommendations = getMoodBasedRecommendations;
window.getTimeBasedRecommendations = getTimeBasedRecommendations;
window.getSeasonalRecommendations = getSeasonalRecommendations;
window.getGroupRecommendations = getGroupRecommendations;
window.loadUserPreferences = loadUserPreferences;

// Initialize
if (typeof waitForFirebase === 'function') {
  initRecommendations();
} else {
  window.addEventListener('load', () => {
    setTimeout(initRecommendations, 1000);
  });
}

