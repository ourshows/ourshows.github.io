// challenges.js - Lists & Challenges System
// Custom lists, watch challenges, badges

let db, auth, currentUser;
let customLists = [];
let challenges = [];
let badges = [];

// Initialize
async function initChallenges() {
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
          loadCustomLists();
          loadChallenges();
          loadBadges();
          checkChallengeProgress();
        }
      });
    }
  } catch (err) {
    console.warn('Firebase not available for challenges');
  }
}

// Custom Lists
async function createCustomList(name, description, items = [], isPublic = false) {
  if (!currentUser && !localStorage.getItem('ourshow_guest')) {
    return { success: false, error: 'Please log in' };
  }
  
  const list = {
    id: Date.now().toString(),
    name,
    description,
    items,
    isPublic,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId: currentUser?.uid || 'guest'
  };
  
  try {
    if (db && currentUser) {
      const { ref, push } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
      const listsRef = ref(db, `ourshow/users/${currentUser.uid}/customLists`);
      const newListRef = push(listsRef);
      list.id = newListRef.key;
      await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js').then(m => m.set(newListRef, list));
    }
    
    // Update localStorage
    const localLists = JSON.parse(localStorage.getItem('ourshow_customLists') || '[]');
    localLists.push(list);
    localStorage.setItem('ourshow_customLists', JSON.stringify(localLists));
    customLists.push(list);
    
    return { success: true, list };
  } catch (error) {
    console.error('Error creating list:', error);
    return { success: false, error: error.message };
  }
}

async function loadCustomLists() {
  try {
    if (db && currentUser) {
      const { ref, get } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
      const listsRef = ref(db, `ourshow/users/${currentUser.uid}/customLists`);
      const snapshot = await get(listsRef);
      
      if (snapshot.exists()) {
        customLists = Object.values(snapshot.val());
        localStorage.setItem('ourshow_customLists', JSON.stringify(customLists));
      }
    } else {
      customLists = JSON.parse(localStorage.getItem('ourshow_customLists') || '[]');
    }
  } catch (error) {
    console.error('Error loading lists:', error);
    customLists = JSON.parse(localStorage.getItem('ourshow_customLists') || '[]');
  }
}

async function addItemToList(listId, item) {
  const list = customLists.find(l => l.id === listId);
  if (!list) return { success: false, error: 'List not found' };
  
  if (list.items.find(i => i.id === item.id)) {
    return { success: false, error: 'Item already in list' };
  }
  
  list.items.push(item);
  list.updatedAt = new Date().toISOString();
  
  try {
    if (db && currentUser) {
      const { ref, set } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
      const listRef = ref(db, `ourshow/users/${currentUser.uid}/customLists/${listId}`);
      await set(listRef, list);
    }
    
    localStorage.setItem('ourshow_customLists', JSON.stringify(customLists));
    return { success: true };
  } catch (error) {
    console.error('Error adding item to list:', error);
    return { success: false, error: error.message };
  }
}

// Challenges
const DEFAULT_CHALLENGES = [
  {
    id: 'watch_50_movies',
    name: 'Watch 50 Movies',
    description: 'Watch 50 movies this year',
    type: 'count',
    target: 50,
    category: 'movies',
    badge: '🎬 Movie Marathon'
  },
  {
    id: 'watch_100_total',
    name: 'Watch 100 Titles',
    description: 'Watch 100 movies and series combined',
    type: 'count',
    target: 100,
    category: 'all',
    badge: '🏆 Centurion'
  },
  {
    id: 'watch_30_days_streak',
    name: '30 Day Streak',
    description: 'Watch something for 30 days in a row',
    type: 'streak',
    target: 30,
    category: 'streak',
    badge: '🔥 Fire Streak'
  },
  {
    id: 'complete_5_series',
    name: 'Complete 5 Series',
    description: 'Finish watching 5 complete TV series',
    type: 'count',
    target: 5,
    category: 'series',
    badge: '📺 Series Master'
  },
  {
    id: 'watch_all_genres',
    name: 'Genre Explorer',
    description: 'Watch at least one title from 10 different genres',
    type: 'variety',
    target: 10,
    category: 'genres',
    badge: '🎭 Genre Explorer'
  }
];

async function loadChallenges() {
  challenges = DEFAULT_CHALLENGES.map(challenge => ({
    ...challenge,
    progress: 0,
    completed: false,
    completedAt: null
  }));
  
  // Load user progress
  try {
    if (db && currentUser) {
      const { ref, get } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
      const progressRef = ref(db, `ourshow/users/${currentUser.uid}/challengeProgress`);
      const snapshot = await get(progressRef);
      
      if (snapshot.exists()) {
        const progress = snapshot.val();
        challenges = challenges.map(challenge => ({
          ...challenge,
          progress: progress[challenge.id]?.progress || 0,
          completed: progress[challenge.id]?.completed || false,
          completedAt: progress[challenge.id]?.completedAt || null
        }));
      }
    } else {
      const localProgress = JSON.parse(localStorage.getItem('ourshow_challengeProgress') || '{}');
      challenges = challenges.map(challenge => ({
        ...challenge,
        progress: localProgress[challenge.id]?.progress || 0,
        completed: localProgress[challenge.id]?.completed || false,
        completedAt: localProgress[challenge.id]?.completedAt || null
      }));
    }
  } catch (error) {
    console.error('Error loading challenges:', error);
  }
}

async function checkChallengeProgress() {
  const watchedItems = window.getWatchedItems ? window.getWatchedItems() : [];
  const stats = window.calculateStats ? window.calculateStats() : {};
  
  const updates = [];
  
  challenges.forEach(challenge => {
    if (challenge.completed) return;
    
    let progress = 0;
    
    switch (challenge.id) {
      case 'watch_50_movies':
        progress = watchedItems.filter(item => (item.type || item.media_type) === 'movie').length;
        break;
      case 'watch_100_total':
        progress = watchedItems.length;
        break;
      case 'watch_30_days_streak':
        progress = stats.watchStreak || 0;
        break;
      case 'complete_5_series':
        // Would need to check series completion
        progress = watchedItems.filter(item => (item.type || item.media_type) === 'tv').length;
        break;
      case 'watch_all_genres':
        const uniqueGenres = new Set();
        watchedItems.forEach(item => {
          if (item.genres) {
            item.genres.forEach(g => uniqueGenres.add(g.name || g));
          }
        });
        progress = uniqueGenres.size;
        break;
    }
    
    const completed = progress >= challenge.target;
    
    if (progress !== challenge.progress || completed !== challenge.completed) {
      challenge.progress = progress;
      challenge.completed = completed;
      challenge.completedAt = completed ? new Date().toISOString() : null;
      
      if (completed) {
        unlockBadge(challenge.badge);
      }
      
      updates.push({
        id: challenge.id,
        progress,
        completed,
        completedAt: challenge.completedAt
      });
    }
  });
  
  // Save updates
  if (updates.length > 0) {
    try {
      if (db && currentUser) {
        const { ref, update } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
        const progressRef = ref(db, `ourshow/users/${currentUser.uid}/challengeProgress`);
        const updatesObj = {};
        updates.forEach(u => {
          updatesObj[u.id] = u;
        });
        await update(progressRef, updatesObj);
      }
      
      const localProgress = JSON.parse(localStorage.getItem('ourshow_challengeProgress') || '{}');
      updates.forEach(u => {
        localProgress[u.id] = u;
      });
      localStorage.setItem('ourshow_challengeProgress', JSON.stringify(localProgress));
    } catch (error) {
      console.error('Error saving challenge progress:', error);
    }
  }
}

// Badges
async function unlockBadge(badgeName) {
  if (badges.includes(badgeName)) return;
  
  badges.push(badgeName);
  
  try {
    if (db && currentUser) {
      const { ref, set } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
      const badgesRef = ref(db, `ourshow/users/${currentUser.uid}/badges`);
      await set(badgesRef, badges);
    }
    
    localStorage.setItem('ourshow_badges', JSON.stringify(badges));
    
    // Show notification
    if (window.showToast) {
      window.showToast(`🏆 Badge Unlocked: ${badgeName}`);
    }
  } catch (error) {
    console.error('Error unlocking badge:', error);
  }
}

async function loadBadges() {
  try {
    if (db && currentUser) {
      const { ref, get } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
      const badgesRef = ref(db, `ourshow/users/${currentUser.uid}/badges`);
      const snapshot = await get(badgesRef);
      
      if (snapshot.exists()) {
        badges = snapshot.val() || [];
        localStorage.setItem('ourshow_badges', JSON.stringify(badges));
      }
    } else {
      badges = JSON.parse(localStorage.getItem('ourshow_badges') || '[]');
    }
  } catch (error) {
    console.error('Error loading badges:', error);
    badges = JSON.parse(localStorage.getItem('ourshow_badges') || '[]');
  }
}

// Share challenge link
function generateChallengeLink(challengeId) {
  const baseUrl = window.location.origin;
  return `${baseUrl}/challenges.html?challenge=${challengeId}`;
}

// Export functions
window.createCustomList = createCustomList;
window.loadCustomLists = loadCustomLists;
window.addItemToList = addItemToList;
window.getChallenges = () => challenges;
window.getBadges = () => badges;
window.generateChallengeLink = generateChallengeLink;
window.checkChallengeProgress = checkChallengeProgress;

// Initialize
if (typeof waitForFirebase === 'function') {
  initChallenges();
} else {
  window.addEventListener('load', () => {
    setTimeout(initChallenges, 1000);
  });
}

