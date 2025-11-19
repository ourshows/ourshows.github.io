// watchlist.js - Firebase-powered watchlist manager
import { waitForFirebase } from './firebase-config.js';

let currentUser = null;
let watchlistItems = [];

const container = document.getElementById('watchlist-container');
const clearBtn = document.getElementById('clear-all-btn');
const itemModal = document.getElementById('item-modal');

// Escape HTML helper
function esc(str) {
  return String(str || '').replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}

// Initialize
async function init() {
  try {
    // Wait for Firebase
    await waitForFirebase();
    
    const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js');
    const auth = window.authMod;
    
    onAuthStateChanged(auth, (user) => {
      currentUser = user;
      console.log('👤 Current user:', user?.email || 'Not logged in');
      loadWatchlist();
    });
  } catch (error) {
    console.error('❌ Firebase init error:', error);
    loadWatchlist(); // Try with localStorage fallback
  }
}

// Load watchlist from Firebase or localStorage
async function loadWatchlist() {
  console.log('📋 Loading watchlist...');
  
  if (!currentUser) {
    console.log('❌ No user logged in');
    container.innerHTML = '<p class="text-center text-gray-400 py-8">Please <a href="login.html" class="text-red-500 underline hover:text-red-400">log in</a> to view your watchlist</p>';
    clearBtn.classList.add('hidden');
    return;
  }

  console.log('✅ User logged in:', currentUser.email);
  const db = window.dbMod;
  
  // Try localStorage first for immediate display
  const localData = JSON.parse(localStorage.getItem('ourshow_watchlist') || '{}');
  console.log('📦 localStorage data:', localData);
  
  const localItems = Object.entries(localData).map(([key, value]) => ({
    ...value,
    key: key
  }));
  
  console.log('📝 Parsed items:', localItems.length);
  
  if (localItems.length > 0) {
    console.log('✅ Displaying from localStorage:', localItems.length, 'items');
    displayWatchlist(localItems);
  } else {
    console.log('⚠️ No items in localStorage');
  }

  // Then sync with Firebase
  if (db) {
    try {
      const { ref, get } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
      const watchlistRef = ref(db, `ourshow/users/${currentUser.uid}/watchlist`);
      const snapshot = await get(watchlistRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        const items = Object.entries(data).map(([key, value]) => ({
          ...value,
          key: key
        }));
        console.log('✅ Synced from Firebase:', items.length, 'items');
        displayWatchlist(items);
        
        // Sync to localStorage
        localStorage.setItem('ourshow_watchlist', JSON.stringify(data));
      } else if (localItems.length === 0) {
        displayEmptyState();
      }
    } catch (error) {
      console.error('❌ Firebase load error:', error);
      if (localItems.length === 0) {
        displayEmptyState();
      }
    }
  } else if (localItems.length === 0) {
    displayEmptyState();
  }
}

// Display empty state
function displayEmptyState() {
  const moviesContainer = document.getElementById('movies-container');
  const seriesContainer = document.getElementById('series-container');
  
  if (moviesContainer) {
    moviesContainer.innerHTML = '<p class="text-gray-400 text-center py-4">No movies in your watchlist yet.</p>';
  }
  if (seriesContainer) {
    seriesContainer.innerHTML = '<p class="text-gray-400 text-center py-4">No series in your watchlist yet.</p>';
  }
  if (container) {
    container.innerHTML = '<p class="text-center text-gray-400 py-8">Your watchlist is empty. <a href="index.html" class="text-red-500 underline hover:text-red-400">Browse and add items</a></p>';
  }
  
  // Update counts to 0
  const moviesCountEl = document.getElementById('movies-count');
  const seriesCountEl = document.getElementById('series-count');
  const totalCountEl = document.getElementById('total-count');
  const moviesSectionCountEl = document.getElementById('movies-section-count');
  const seriesSectionCountEl = document.getElementById('series-section-count');

  if (moviesCountEl) moviesCountEl.textContent = '0';
  if (seriesCountEl) seriesCountEl.textContent = '0';
  if (totalCountEl) totalCountEl.textContent = '0';
  if (moviesSectionCountEl) moviesSectionCountEl.textContent = '0';
  if (seriesSectionCountEl) seriesSectionCountEl.textContent = '0';
  
  clearBtn.classList.add('hidden');
}

// Display watchlist items
function displayWatchlist(items) {
  if (!items || items.length === 0) {
    displayEmptyState();
    return;
  }

  watchlistItems = items;
  clearBtn.classList.remove('hidden');

  // Separate movies and series
  const movies = [];
  const series = [];
  const other = [];

  items.forEach((item, idx) => {
    const type = item.type || item.media_type || '';
    if (type === 'tv' || type === 'series') {
      series.push({ ...item, displayIndex: idx });
    } else if (type === 'movie' || !type) {
      // Default to movie if no type specified
      movies.push({ ...item, displayIndex: idx });
    } else {
      other.push({ ...item, displayIndex: idx });
    }
  });

  // Update counts
  const moviesCountEl = document.getElementById('movies-count');
  const seriesCountEl = document.getElementById('series-count');
  const totalCountEl = document.getElementById('total-count');
  const moviesSectionCountEl = document.getElementById('movies-section-count');
  const seriesSectionCountEl = document.getElementById('series-section-count');

  if (moviesCountEl) moviesCountEl.textContent = movies.length;
  if (seriesCountEl) seriesCountEl.textContent = series.length;
  if (totalCountEl) totalCountEl.textContent = items.length;
  if (moviesSectionCountEl) moviesSectionCountEl.textContent = movies.length;
  if (seriesSectionCountEl) seriesSectionCountEl.textContent = series.length;

  // Display movies
  const moviesContainer = document.getElementById('movies-container');
  if (moviesContainer) {
    if (movies.length === 0) {
      moviesContainer.innerHTML = '<p class="text-gray-400 text-center py-4">No movies in your watchlist yet.</p>';
    } else {
      moviesContainer.innerHTML = movies.map((item) => renderItemCard(item)).join('');
    }
  }

  // Display series
  const seriesContainer = document.getElementById('series-container');
  if (seriesContainer) {
    if (series.length === 0) {
      seriesContainer.innerHTML = '<p class="text-gray-400 text-center py-4">No series in your watchlist yet.</p>';
    } else {
      seriesContainer.innerHTML = series.map((item) => renderItemCard(item)).join('');
    }
  }

  // Display other items if any
  if (other.length > 0 && container) {
    container.innerHTML = other.map((item) => renderItemCard(item)).join('');
  }
}

// Render individual item card
function renderItemCard(item) {
  const idx = item.displayIndex !== undefined ? item.displayIndex : watchlistItems.findIndex(i => i.key === item.key);
  return `
    <div class="bg-gray-800 rounded-lg p-4 flex gap-4 hover:bg-gray-700 transition duration-200" data-index="${idx}">
      <img src="${item.posterUrl || 'https://placehold.co/100x150?text=No+Image'}" 
           alt="${esc(item.title)}" 
           class="w-24 h-32 object-cover rounded cursor-pointer hover:opacity-80 transition" 
           onclick="openItemModal(${idx})">
      
      <div class="flex-1">
        <h3 class="text-xl font-semibold mb-1 cursor-pointer hover:text-red-500 transition" 
            onclick="openItemModal(${idx})">${esc(item.title)}</h3>
        <p class="text-gray-400 mb-2">📅 ${esc(item.year || 'N/A')}</p>
        <p class="text-sm text-gray-400 mb-3 line-clamp-2">${esc(item.overview || 'No description')}</p>
        <div class="text-xs text-gray-500 mb-3 space-y-1">
          ${item.rating ? `<p>⭐ Rating: ${item.rating.toFixed(1)}</p>` : ''}
          ${item.popularity ? `<p>📊 Popularity: ${Math.round(item.popularity)}</p>` : ''}
          ${item.type ? `<p>🎬 Type: ${esc(item.type === 'tv' ? 'TV Show' : 'Movie')}</p>` : ''}
        </div>
        <div class="flex gap-2 flex-wrap">
          <button class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition" 
                  onclick="moveToWatchLater('${item.key}', ${idx})">
            ⏳ Move to Watch Later
          </button>
          <button class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition" 
                  onclick="removeItem('${item.key}')">
            🗑️ Remove
          </button>
        </div>
      </div>
    </div>
  `;
}

// Open item details modal
window.openItemModal = function(index) {
  const item = watchlistItems[index];
  if (!item) return;

  itemModal.innerHTML = `
    <div class="bg-gray-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto relative p-6 m-4">
      <button onclick="closeModal()" 
              class="absolute top-4 right-4 bg-red-600 hover:bg-red-700 text-white w-10 h-10 rounded-full flex items-center justify-center z-50 transition text-xl font-bold">
        ✕
      </button>
      
      <div class="flex flex-col sm:flex-row gap-6 mt-8">
        <img src="${item.posterUrl || 'https://placehold.co/150x225?text=No+Image'}" 
             alt="${esc(item.title)}" 
             class="w-full sm:w-32 h-auto sm:h-48 object-cover rounded flex-shrink-0">
        
        <div class="flex-1">
          <h2 class="text-2xl font-bold text-white mb-2">${esc(item.title)}</h2>
          <p class="text-gray-300 mb-4">📅 ${esc(item.year || 'N/A')}</p>
          
          <p class="text-gray-400 mb-4">${esc(item.overview || 'No description available')}</p>
          
          <div class="text-sm text-gray-300 space-y-2 mb-4">
            ${item.rating ? `<p><strong>Rating:</strong> ⭐ ${item.rating.toFixed(1)}/10</p>` : ''}
            ${item.popularity ? `<p><strong>Popularity:</strong> 📊 ${Math.round(item.popularity)}</p>` : ''}
            ${item.type ? `<p><strong>Type:</strong> ${esc(item.type === 'tv' ? 'TV Show' : 'Movie')}</p>` : ''}
          </div>
          
          <div class="flex gap-2 flex-wrap mt-4">
            <button onclick="moveToWatchLater('${item.key}', ${index})" 
                    class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition">
              ⏳ Move to Watch Later
            </button>
            <button onclick="removeItem('${item.key}')" 
                    class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition">
              🗑️ Remove
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  itemModal.classList.remove('hidden');
};

// Close modal
window.closeModal = function() {
  itemModal.classList.add('hidden');
};

// Remove item from watchlist
window.removeItem = async function(key) {
  if (!confirm('Remove from watchlist?')) return;
  
  if (!currentUser) {
    alert('Please log in');
    return;
  }

  try {
    const db = window.dbMod;
    
    // Remove from Firebase
    if (db) {
      const { ref, remove } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
      const itemRef = ref(db, `ourshow/users/${currentUser.uid}/watchlist/${key}`);
      await remove(itemRef);
      console.log('✅ Removed from Firebase');
    }
    
    // Remove from localStorage
    const localData = JSON.parse(localStorage.getItem('ourshow_watchlist') || '{}');
    delete localData[key];
    localStorage.setItem('ourshow_watchlist', JSON.stringify(localData));
    console.log('✅ Removed from localStorage');
    
    // Reload watchlist
    await loadWatchlist();
    
    // Close modal if open
    closeModal();
  } catch (error) {
    console.error('❌ Error removing item:', error);
    alert('Failed to remove item. Please try again.');
  }
};

// Move item to watch later
window.moveToWatchLater = async function(key, index) {
  const item = watchlistItems[index];
  if (!item) return;
  
  if (!currentUser) {
    alert('Please log in');
    return;
  }

  try {
    const db = window.dbMod;
    
    if (db) {
      const { ref, set, remove } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
      
      // Add to watch later
      const watchLaterRef = ref(db, `ourshow/users/${currentUser.uid}/watchlater/${key}`);
      await set(watchLaterRef, item);
      console.log('✅ Added to Watch Later (Firebase)');
      
      // Remove from watchlist
      const watchlistRef = ref(db, `ourshow/users/${currentUser.uid}/watchlist/${key}`);
      await remove(watchlistRef);
      console.log('✅ Removed from Watchlist (Firebase)');
    }
    
    // Update localStorage
    const watchlist = JSON.parse(localStorage.getItem('ourshow_watchlist') || '{}');
    const watchlater = JSON.parse(localStorage.getItem('ourshow_watchlater') || '{}');
    
    watchlater[key] = item;
    delete watchlist[key];
    
    localStorage.setItem('ourshow_watchlist', JSON.stringify(watchlist));
    localStorage.setItem('ourshow_watchlater', JSON.stringify(watchlater));
    console.log('✅ Updated localStorage');
    
    alert('✅ Moved to Watch Later!');
    
    // Reload watchlist
    await loadWatchlist();
    
    // Close modal if open
    closeModal();
  } catch (error) {
    console.error('❌ Error moving item:', error);
    alert('Failed to move item. Please try again.');
  }
};

// Clear all watchlist items
clearBtn.addEventListener('click', async () => {
  if (!confirm('Clear entire watchlist? This cannot be undone.')) return;
  
  if (!currentUser) {
    alert('Please log in');
    return;
  }

  try {
    const db = window.dbMod;
    
    if (db) {
      const { ref, remove } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
      const watchlistRef = ref(db, `ourshow/users/${currentUser.uid}/watchlist`);
      await remove(watchlistRef);
      console.log('✅ Cleared Firebase watchlist');
    }
    
    localStorage.removeItem('ourshow_watchlist');
    console.log('✅ Cleared localStorage');
    
    alert('✅ Watchlist cleared');
    await loadWatchlist();
  } catch (error) {
    console.error('❌ Error clearing watchlist:', error);
    alert('Failed to clear watchlist. Please try again.');
  }
});

// Close modal when clicking outside
itemModal.addEventListener('click', (e) => {
  if (e.target === itemModal) {
    closeModal();
  }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);