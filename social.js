// social.js - Social Features System
// Follow users, activity feed, friend profiles

let db, auth, currentUser;
let following = [];
let followers = [];
let activityFeed = [];

// Initialize
async function initSocial() {
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
          loadFollowing();
          loadFollowers();
          loadActivityFeed();
          startActivityListener();
        }
      });
    }
  } catch (err) {
    console.warn('Firebase not available for social features');
  }
}

// Follow a user
async function followUser(userId) {
  if (!currentUser) {
    alert('Please log in to follow users');
    return { success: false };
  }
  
  if (userId === currentUser.uid) {
    return { success: false, error: 'Cannot follow yourself' };
  }
  
  try {
    if (db) {
      const { ref, set } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
      
      // Add to following
      const followingRef = ref(db, `ourshow/users/${currentUser.uid}/following/${userId}`);
      await set(followingRef, {
        userId,
        followedAt: new Date().toISOString()
      });
      
      // Add to their followers
      const followersRef = ref(db, `ourshow/users/${userId}/followers/${currentUser.uid}`);
      await set(followersRef, {
        userId: currentUser.uid,
        followedAt: new Date().toISOString()
      });
      
      // Create notification for them
      const notificationRef = ref(db, `ourshow/users/${userId}/notifications`);
      const { push } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
      await push(notificationRef, {
        type: 'follow',
        fromUserId: currentUser.uid,
        fromUserName: currentUser.displayName || 'Someone',
        message: `${currentUser.displayName || 'Someone'} started following you`,
        timestamp: Date.now(),
        read: false
      });
    }
    
    // Update local
    if (!following.find(f => f.userId === userId)) {
      following.push({ userId, followedAt: new Date().toISOString() });
      localStorage.setItem('ourshow_following', JSON.stringify(following));
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error following user:', error);
    return { success: false, error: error.message };
  }
}

// Unfollow a user
async function unfollowUser(userId) {
  if (!currentUser) return { success: false };
  
  try {
    if (db) {
      const { ref, remove } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
      
      await remove(ref(db, `ourshow/users/${currentUser.uid}/following/${userId}`));
      await remove(ref(db, `ourshow/users/${userId}/followers/${currentUser.uid}`));
    }
    
    following = following.filter(f => f.userId !== userId);
    localStorage.setItem('ourshow_following', JSON.stringify(following));
    
    return { success: true };
  } catch (error) {
    console.error('Error unfollowing user:', error);
    return { success: false, error: error.message };
  }
}

// Load following list
async function loadFollowing() {
  try {
    if (db && currentUser) {
      const { ref, get } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
      const followingRef = ref(db, `ourshow/users/${currentUser.uid}/following`);
      const snapshot = await get(followingRef);
      
      if (snapshot.exists()) {
        following = Object.values(snapshot.val());
        localStorage.setItem('ourshow_following', JSON.stringify(following));
      }
    } else {
      following = JSON.parse(localStorage.getItem('ourshow_following') || '[]');
    }
  } catch (error) {
    console.error('Error loading following:', error);
    following = JSON.parse(localStorage.getItem('ourshow_following') || '[]');
  }
}

// Load followers list
async function loadFollowers() {
  try {
    if (db && currentUser) {
      const { ref, get } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
      const followersRef = ref(db, `ourshow/users/${currentUser.uid}/followers`);
      const snapshot = await get(followersRef);
      
      if (snapshot.exists()) {
        followers = Object.values(snapshot.val());
      }
    }
  } catch (error) {
    console.error('Error loading followers:', error);
  }
}

// Get user profile with stats
async function getUserProfile(userId) {
  try {
    if (db) {
      const { ref, get } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
      
      // Get user data
      const userRef = ref(db, `ourshow/users/${userId}`);
      const userSnapshot = await get(userRef);
      
      if (!userSnapshot.exists()) {
        return null;
      }
      
      const userData = userSnapshot.val();
      
      // Get watched items
      const watchedRef = ref(db, `ourshow/users/${userId}/watched`);
      const watchedSnapshot = await get(watchedRef);
      const watched = watchedSnapshot.exists() ? Object.values(watchedSnapshot.val()) : [];
      
      // Calculate stats
      const stats = {
        totalWatched: watched.length,
        moviesWatched: watched.filter(item => (item.type || item.media_type) === 'movie').length,
        seriesWatched: watched.filter(item => (item.type || item.media_type) === 'tv').length,
        favoriteGenres: {}
      };
      
      watched.forEach(item => {
        if (item.genres) {
          item.genres.forEach(genre => {
            const genreName = genre.name || genre;
            stats.favoriteGenres[genreName] = (stats.favoriteGenres[genreName] || 0) + 1;
          });
        }
      });
      
      // Get badges
      const badgesRef = ref(db, `ourshow/users/${userId}/badges`);
      const badgesSnapshot = await get(badgesRef);
      const badges = badgesSnapshot.exists() ? badgesSnapshot.val() : [];
      
      return {
        userId,
        displayName: userData.displayName || 'User',
        photoURL: userData.photoURL || null,
        stats,
        badges,
        isFollowing: following.some(f => f.userId === userId),
        isFollower: followers.some(f => f.userId === userId)
      };
    }
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
}

// Activity feed
async function loadActivityFeed() {
  if (!currentUser) return;
  
  activityFeed = [];
  
  // Get activities from followed users
  const followingIds = following.map(f => f.userId);
  
  try {
    if (db) {
      const { ref, get } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
      
      for (const userId of followingIds) {
        // Get recent watched items
        const watchedRef = ref(db, `ourshow/users/${userId}/watched`);
        const watchedSnapshot = await get(watchedRef);
        
        if (watchedSnapshot.exists()) {
          const watched = Object.values(watchedSnapshot.val())
            .sort((a, b) => (b.watchedTimestamp || 0) - (a.watchedTimestamp || 0))
            .slice(0, 5);
          
          watched.forEach(item => {
            activityFeed.push({
              type: 'watched',
              userId,
              item,
              timestamp: item.watchedTimestamp || Date.now()
            });
          });
        }
        
        // Get recent list creations
        const listsRef = ref(db, `ourshow/users/${userId}/customLists`);
        const listsSnapshot = await get(listsRef);
        
        if (listsSnapshot.exists()) {
          const lists = Object.values(listsSnapshot.val())
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 3);
          
          lists.forEach(list => {
            activityFeed.push({
              type: 'list_created',
              userId,
              list,
              timestamp: new Date(list.createdAt).getTime()
            });
          });
        }
      }
      
      // Sort by timestamp
      activityFeed.sort((a, b) => b.timestamp - a.timestamp);
      activityFeed = activityFeed.slice(0, 50); // Limit to 50 most recent
    }
  } catch (error) {
    console.error('Error loading activity feed:', error);
  }
}

// Start real-time activity listener
function startActivityListener() {
  if (!db || !currentUser) return;
  
  const followingIds = following.map(f => f.userId);
  
  followingIds.forEach(async (userId) => {
    try {
      const { ref, onValue } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
      const watchedRef = ref(db, `ourshow/users/${userId}/watched`);
      
      onValue(watchedRef, (snapshot) => {
        if (snapshot.exists()) {
          // Update activity feed when followed user watches something
          loadActivityFeed();
        }
      });
    } catch (error) {
      console.error('Error setting up activity listener:', error);
    }
  });
}

// Record activity (when user does something)
async function recordActivity(type, data) {
  if (!currentUser) return;
  
  try {
    if (db) {
      const { ref, push } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
      const activityRef = ref(db, `ourshow/users/${currentUser.uid}/activities`);
      
      await push(activityRef, {
        type,
        data,
        timestamp: Date.now()
      });
    }
  } catch (error) {
    console.error('Error recording activity:', error);
  }
}

// Export functions
window.followUser = followUser;
window.unfollowUser = unfollowUser;
window.getUserProfile = getUserProfile;
window.getActivityFeed = () => activityFeed;
window.loadActivityFeed = loadActivityFeed;
window.recordActivity = recordActivity;
window.getFollowing = () => following;
window.getFollowers = () => followers;

// Initialize
if (typeof waitForFirebase === 'function') {
  initSocial();
} else {
  window.addEventListener('load', () => {
    setTimeout(initSocial, 1000);
  });
}

