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

// Mark item as watched
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
      const watchedRef = ref(db, `ourshow/users/${currentUser.uid}/watched/${itemId}`);
      await set(watchedRef, watchedItem);
    }
    
    // Update localStorage
    const localWatched = JSON.parse(localStorage.getItem('ourshow_watched') || '{}');
    localWatched[itemId] = watchedItem;
    localStorage.setItem('ourshow_watched', JSON.stringify(localWatched));
    
    return true;
  } catch (error) {
    console.error('Error marking as watched:', error);
    return false;
  }
}

// Load watched items
async function loadWatchedItems() {
  try {
    if (db && currentUser) {
      const { ref, get } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
      const watchedRef = ref(db, `ourshow/users/${currentUser.uid}/watched`);
      const snapshot = await get(watchedRef);
      
      if (snapshot.exists()) {
        watchedItems = Object.values(snapshot.val());
        localStorage.setItem('ourshow_watched', JSON.stringify(snapshot.val()));
      } else {
        watchedItems = [];
      }
    } else {
      const localWatched = JSON.parse(localStorage.getItem('ourshow_watched') || '{}');
      watchedItems = Object.values(localWatched);
    }
  } catch (error) {
    console.error('Error loading watched items:', error);
    const localWatched = JSON.parse(localStorage.getItem('ourshow_watched') || '{}');
    watchedItems = Object.values(localWatched);
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
    } else {
      stats.moviesWatched++;
    }
    
    // Calculate hours (assuming average 2h for movies, 45min for episodes)
    if (type === 'tv' || type === 'series') {
      const episodes = item.number_of_episodes || 10;
      stats.totalHours += (episodes * 0.75);
    } else {
      const runtime = item.runtime || 120;
      stats.totalHours += (runtime / 60);
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
window.markAsWatched = markAsWatched;
window.updateSeriesProgress = updateSeriesProgress;
window.getWatchedItems = () => watchedItems;
window.getSeriesProgress = () => seriesProgress;
window.calculateStats = calculateStats;
window.loadWatchedItems = loadWatchedItems;

// Initialize on load
if (typeof waitForFirebase === 'function') {
  initStats();
} else {
  // Fallback if firebase-config not loaded yet
  window.addEventListener('load', () => {
    setTimeout(initStats, 1000);
  });
}

