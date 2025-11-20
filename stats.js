// stats.js - Watch Tracking & Statistics System
// Handles watched items, statistics, and progress tracking

let db, auth, currentUser;
let watchedItems = [];
let seriesProgress = {};

// Initialize Firebase
async function initStats() {
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
          loadWatchedItems();
          loadSeriesProgress();
        }
      });
    }
  } catch (err) {
    console.warn('Firebase not available, using localStorage only');
  }
}

// Mark item as watched (saves to watchlist path)
async function markAsWatched(itemId, itemData, watchedDate = null) {
  if (!currentUser && !localStorage.getItem('ourshow_guest')) {
    alert('Please log in to track watched items');
    return false;
  }

  const date = watchedDate || new Date().toISOString();
  const watchedItem = {
    ...itemData,
    id: itemId,
    watchedDate: date,
    watchedTimestamp: Date.now()
  };

  try {
    if (db && currentUser) {
      const { ref, set } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
      // In this app: watchlist = watched items (items already watched)
      const watchlistRef = ref(db, `ourshow/users/${currentUser.uid}/watchlist/${itemId}`);
      await set(watchlistRef, watchedItem);
    }

    // Update localStorage (using watchlist key to match the structure)
    const localWatchlist = JSON.parse(localStorage.getItem('ourshow_watchlist') || '{}');
    localWatchlist[itemId] = watchedItem;
    localStorage.setItem('ourshow_watchlist', JSON.stringify(localWatchlist));

    return true;
  } catch (error) {
    console.error('Error marking as watched:', error);
    return false;
  }
}

// Load watched items (from watchlist path - in this app watchlist = watched items)
async function loadWatchedItems() {
  try {
    console.log('🔄 Loading watched items...', { db: !!db, currentUser: !!currentUser, uid: currentUser?.uid });

    if (db && currentUser) {
      const { ref, get } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
      // In this app: watchlist = watched items (items already watched)
      const watchlistRef = ref(db, `ourshow/users/${currentUser.uid}/watchlist`);
      console.log('📡 Fetching from Firebase:', `ourshow/users/${currentUser.uid}/watchlist`);

      const snapshot = await get(watchlistRef);

      if (snapshot.exists()) {
        const data = snapshot.val();
        watchedItems = Object.values(data);
        localStorage.setItem('ourshow_watchlist', JSON.stringify(data));
        console.log('✅ Loaded from Firebase (watchlist):', watchedItems.length, 'items');
      } else {
        watchedItems = [];
        console.log('ℹ️ No watched items in Firebase, using empty array');
      }
    } else {
      console.log('⚠️ Firebase not available, loading from localStorage');
      // In this app: watchlist = watched items
      const localWatchlist = JSON.parse(localStorage.getItem('ourshow_watchlist') || '{}');
      watchedItems = Object.values(localWatchlist);
      console.log('📦 Loaded from localStorage (watchlist):', watchedItems.length, 'items');
    }
  } catch (error) {
    console.error('❌ Error loading watched items:', error);
    // Fallback to localStorage
    const localWatchlist = JSON.parse(localStorage.getItem('ourshow_watchlist') || '{}');
    watchedItems = Object.values(localWatchlist);
    console.log('📦 Fallback to localStorage (watchlist):', watchedItems.length, 'items');
  }
}

// Track series episode progress
async function updateSeriesProgress(seriesId, seasonNum, episodeNum, totalEpisodes = null) {
  if (!currentUser && !localStorage.getItem('ourshow_guest')) {
    return false;
  }

  const progressKey = `${seriesId}_s${seasonNum}`;
  const progress = {
    seriesId,
    seasonNum,
    episodeNum,
    totalEpisodes,
    lastWatched: new Date().toISOString(),
    lastWatchedTimestamp: Date.now()
  };

  try {
    if (db && currentUser) {
      const { ref, set } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
      const progressRef = ref(db, `ourshow/users/${currentUser.uid}/seriesProgress/${progressKey}`);
      await set(progressRef, progress);
    }

    // Update localStorage
    const localProgress = JSON.parse(localStorage.getItem('ourshow_seriesProgress') || '{}');
    localProgress[progressKey] = progress;
    localStorage.setItem('ourshow_seriesProgress', JSON.stringify(localProgress));

    seriesProgress[progressKey] = progress;
    return true;
  } catch (error) {
    console.error('Error updating series progress:', error);
    return false;
  }
}

// Load series progress
async function loadSeriesProgress() {
  try {
    if (db && currentUser) {
      const { ref, get } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
      const progressRef = ref(db, `ourshow/users/${currentUser.uid}/seriesProgress`);
      const snapshot = await get(progressRef);

      if (snapshot.exists()) {
        seriesProgress = snapshot.val();
        localStorage.setItem('ourshow_seriesProgress', JSON.stringify(seriesProgress));
      }
    } else {
      seriesProgress = JSON.parse(localStorage.getItem('ourshow_seriesProgress') || '{}');
    }
  } catch (error) {
    console.error('Error loading series progress:', error);
    seriesProgress = JSON.parse(localStorage.getItem('ourshow_seriesProgress') || '{}');
  }
}

// Calculate statistics
function calculateStats() {
  const stats = {
    totalWatched: watchedItems.length,
    moviesWatched: 0,
    seriesWatched: 0,
    totalHours: 0,
    movieHours: 0,
    seriesHours: 0,
    favoriteGenres: {},
    watchStreak: 0,
    yearlyStats: {},
    monthlyStats: {},
    calendarView: {}
  };

  // Process watched items
  watchedItems.forEach(item => {
    const type = item.type || item.media_type || 'movie';
    if (type === 'tv' || type === 'series') {
      stats.seriesWatched++;
      let episodes = parseInt(item.number_of_episodes);
      if (!episodes || isNaN(episodes)) episodes = 10;

      const hours = (episodes * 0.75);
      stats.seriesHours += hours;
      stats.totalHours += hours;
    } else {
      stats.moviesWatched++;
      let runtime = parseInt(item.runtime);
      if (!runtime || isNaN(runtime)) runtime = 120;

      const hours = (runtime / 60);
      stats.movieHours += hours;
      stats.totalHours += hours;
    }

    // Track genres
    if (item.genres && Array.isArray(item.genres)) {
      item.genres.forEach(genre => {
        const genreName = genre.name || genre;
        stats.favoriteGenres[genreName] = (stats.favoriteGenres[genreName] || 0) + 1;
      });
    }

    // Track by date
    if (item.watchedDate) {
      const date = new Date(item.watchedDate);
      const year = date.getFullYear();
      const month = `${year}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const day = date.toISOString().split('T')[0];

      stats.yearlyStats[year] = (stats.yearlyStats[year] || 0) + 1;
      stats.monthlyStats[month] = (stats.monthlyStats[month] || 0) + 1;
      stats.calendarView[day] = (stats.calendarView[day] || []).concat(item);
    }
  });

  // Calculate watch streak
  const sortedDates = Object.keys(stats.calendarView)
    .sort()
    .reverse();

  let streak = 0;
  let currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  for (let i = 0; i < sortedDates.length; i++) {
    const watchDate = new Date(sortedDates[i]);
    watchDate.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((currentDate - watchDate) / (1000 * 60 * 60 * 24));

    if (diffDays === streak) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      break;
    }
  }

  stats.watchStreak = streak;

  // Sort favorite genres
  stats.favoriteGenres = Object.entries(stats.favoriteGenres)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .reduce((obj, [genre, count]) => {
      obj[genre] = count;
      return obj;
    }, {});

  return stats;
}

// Export functions
// Save updated item
async function saveItemUpdate(item) {
  if (!item.id) return;

  try {
    if (db && currentUser) {
      const { ref, set } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
      const watchlistRef = ref(db, `ourshow/users/${currentUser.uid}/watchlist/${item.id}`);
      await set(watchlistRef, item);
    }

    // Update localStorage
    const localWatchlist = JSON.parse(localStorage.getItem('ourshow_watchlist') || '{}');
    localWatchlist[item.id] = item;
    localStorage.setItem('ourshow_watchlist', JSON.stringify(localWatchlist));
  } catch (error) {
    console.error('Error saving item update:', error);
  }
}

// Enrich watched items with missing data (runtime/episodes)
async function enrichWatchedItems() {
  console.log('✨ Enriching watched items with TMDB data...');
  let updated = false;

  // Helper to delay to avoid rate limits
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  for (let i = 0; i < watchedItems.length; i++) {
    const item = watchedItems[i];
    const type = item.type || item.media_type || 'movie';
    let itemUpdated = false;

    try {
      if (type === 'movie') {
        // Check if runtime is missing or default (120)
        if (!item.runtime || item.runtime === 120) {
          if (typeof tmdbFetch === 'function') {
            const details = await tmdbFetch(`/movie/${item.id}`);
            if (details && details.runtime) {
              item.runtime = details.runtime;
              itemUpdated = true;
              console.log(`Updated runtime for ${item.title}: ${item.runtime}m`);
            }
          }
        }
      } else if (type === 'tv' || type === 'series') {
        // Check if episodes count is missing or default (10)
        if (!item.number_of_episodes || item.number_of_episodes === 10) {
          if (typeof tmdbFetch === 'function') {
            const details = await tmdbFetch(`/tv/${item.id}`);
            if (details && details.number_of_episodes) {
              item.number_of_episodes = details.number_of_episodes;
              // Also get runtime if possible (average runtime)
              if (details.episode_run_time && details.episode_run_time.length > 0) {
                // Average of runtimes
                const avg = details.episode_run_time.reduce((a, b) => a + b, 0) / details.episode_run_time.length;
                item.runtime = Math.round(avg);
              }
              itemUpdated = true;
              console.log(`Updated episodes for ${item.name || item.title}: ${item.number_of_episodes}`);
            }
          }
        }
      }

      if (itemUpdated) {
        await saveItemUpdate(item);
        updated = true;
        // Small delay to be nice to API
        await delay(200);
      }
    } catch (err) {
      console.error(`Error enriching item ${item.title}:`, err);
    }
  }

  return updated;
}

window.markAsWatched = markAsWatched;
window.updateSeriesProgress = updateSeriesProgress;
window.getWatchedItems = () => watchedItems;
window.getSeriesProgress = () => seriesProgress;
window.calculateStats = calculateStats;
window.loadWatchedItems = loadWatchedItems;
window.initStats = initStats;
window.enrichWatchedItems = enrichWatchedItems;

// Initialize on load
if (typeof waitForFirebase === 'function') {
  initStats();
} else {
  // Fallback if firebase-config not loaded yet
  window.addEventListener('load', () => {
    setTimeout(initStats, 1000);
  });
}

