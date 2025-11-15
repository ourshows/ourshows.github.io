// post.js — Twitter/Facebook-like posts feature with modular Firebase
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';
import { 
  getDatabase, ref, push, onChildAdded, onChildChanged, onChildRemoved, 
  update, remove, get, set 
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';

const auth = window.authMod || getAuth();
const db = window.dbMod;

console.log('post.js loaded. window.dbMod =', window.dbMod, 'window.authMod =', window.authMod);

// DOM elements
const authNotice = document.getElementById('auth-notice');
const createPostForm = document.getElementById('create-post-form');
const postContentInput = document.getElementById('post-content');
const postBtn = document.getElementById('post-btn');
const cancelBtn = document.getElementById('cancel-btn');
const postsContainer = document.getElementById('posts-container');
const commentModal = document.getElementById('comment-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const commentInput = document.getElementById('comment-input');
const commentSubmitBtn = document.getElementById('comment-submit-btn');
const commentsList = document.getElementById('comments-list');
const originalPost = document.getElementById('original-post');

let currentUser = null;
let currentPostId = null;
let allPosts = {};

// ====== AUTH STATE ======
onAuthStateChanged(auth, (user) => {
  currentUser = user;
    console.log('Auth state changed. currentUser =', user);
  if (user) {
    authNotice.classList.add('hidden');
    createPostForm.classList.remove('hidden');
  } else {
    authNotice.classList.remove('hidden');
    createPostForm.classList.add('hidden');
  }
});

// ====== POST CREATION ======
postBtn.addEventListener('click', async () => {
  if (!currentUser) {
    alert('Please log in first');
    return;
  }

  const content = postContentInput.value.trim();
  if (!content) {
    alert('Post cannot be empty');
    return;
  }

  postBtn.disabled = true;
  postBtn.textContent = 'Posting...';

  try {
    if (!db) {
      // Fallback to localStorage
      const posts = JSON.parse(localStorage.getItem('ourshow_posts') || '{}');
      const postId = Date.now().toString();
      posts[postId] = {
        id: postId,
        authorId: currentUser.uid,
        authorName: currentUser.displayName || currentUser.email,
        authorPhoto: currentUser.photoURL || 'https://via.placeholder.com/40',
        content,
        timestamp: Date.now(),
        likes: 0,
        likedBy: {},
        comments: {}
      };
      localStorage.setItem('ourshow_posts', JSON.stringify(posts));
    } else {
      // Firebase Realtime DB
      await push(ref(db, 'ourshow/posts'), {
        authorId: currentUser.uid,
        authorName: currentUser.displayName || currentUser.email,
        authorPhoto: currentUser.photoURL || 'https://via.placeholder.com/40',
        content,
        timestamp: Date.now(),
        likes: 0,
        comments: {}
      });
    }

    postContentInput.value = '';
    postBtn.textContent = 'Post';
    postBtn.disabled = false;
    alert('✅ Post published!');
    loadPosts();
  } catch (err) {
    console.error('Error posting:', err);
    alert('Error posting. Please try again.');
    postBtn.textContent = 'Post';
    postBtn.disabled = false;
  }
});

cancelBtn.addEventListener('click', () => {
  postContentInput.value = '';
});

// ====== LOAD POSTS ======
async function loadPosts() {
  postsContainer.innerHTML = '<p class="text-gray-400 text-center py-8">Loading posts...</p>';
  console.log('loadPosts() called. db =', db);

  try {
    if (!db) {
      // Load from localStorage
      const posts = JSON.parse(localStorage.getItem('ourshow_posts') || '{}');
      allPosts = posts;
      displayPosts(Object.values(posts).reverse());
      return;
    }

    // Load from Firebase
    const snapshot = await get(ref(db, 'ourshow/posts'));
    if (snapshot.exists()) {
      allPosts = snapshot.val();
        console.log('Posts loaded from Firebase:', allPosts);
      const postsArray = Object.entries(allPosts).map(([id, post]) => ({ id, ...post })).reverse();
      displayPosts(postsArray);

      // Listen for real-time updates
      onChildAdded(ref(db, 'ourshow/posts'), (snap) => {
          console.log('New post added:', snap.val());
        loadPosts(); // Reload on new post
      });
    } else {
      postsContainer.innerHTML = '<p class="text-gray-400 text-center py-8">No posts yet. Be the first to share! 🎬</p>';
    }
  } catch (err) {
    console.error('Error loading posts:', err);
    postsContainer.innerHTML = '<p class="text-center text-red-400 py-8">Error loading posts</p>';
  }
}

// ====== DISPLAY POSTS ======
function displayPosts(postsArray) {
  if (!postsArray.length) {
    postsContainer.innerHTML = '<p class="text-gray-400 text-center py-8">No posts yet. Be the first to share! 🎬</p>';
    return;
  }

  postsContainer.innerHTML = postsArray.map(post => {
    const timeAgo = getTimeAgo(post.timestamp);
    const isLikedByMe = currentUser && post.likedBy && post.likedBy[currentUser.uid];
    const likeCount = post.likes || 0;
    const commentCount = post.comments ? Object.keys(post.comments).length : 0;

    return `
      <div class="bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-700 hover:border-red-500 transition">
        <!-- Author Info -->
        <div class="flex items-center gap-3 mb-4">
          <img src="${post.authorPhoto}" alt="${post.authorName}" class="w-10 h-10 rounded-full object-cover border border-gray-600">
          <div class="flex-1">
            <p class="font-semibold text-white">${escapeHtml(post.authorName)}</p>
            <p class="text-xs text-gray-400">${timeAgo}</p>
          </div>
          ${currentUser && currentUser.uid === post.authorId ? `
            <button class="text-gray-400 hover:text-red-500 text-xl" onclick="deletePost('${post.id}')">🗑️</button>
          ` : ''}
        </div>

        <!-- Post Content -->
        <p class="text-gray-100 mb-4 break-words">${escapeHtml(post.content)}</p>

        <!-- Post Actions -->
        <div class="flex gap-4 border-t border-gray-700 pt-3 text-sm text-gray-400">
          <button class="flex items-center gap-1 hover:text-red-500 transition cursor-pointer" onclick="toggleLike('${post.id}')">
            <span class="${isLikedByMe ? 'text-red-500' : ''}">❤️</span> Like <span class="text-xs">(${likeCount})</span>
          </button>
          <button class="flex items-center gap-1 hover:text-blue-400 transition cursor-pointer" onclick="openCommentModal('${post.id}')">
            <span>💬</span> Comment <span class="text-xs">(${commentCount})</span>
          </button>
          <button class="flex items-center gap-1 hover:text-green-400 transition cursor-pointer" onclick="sharePost('${post.id}')">
            <span>↗️</span> Share
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ====== LIKE/UNLIKE ======
async function toggleLike(postId) {
  if (!currentUser) {
    alert('Please log in to like');
    return;
  }

  try {
    if (!db) {
      const posts = JSON.parse(localStorage.getItem('ourshow_posts') || '{}');
      const post = posts[postId];
      if (!post) return;

      post.likedBy = post.likedBy || {};
      if (post.likedBy[currentUser.uid]) {
        delete post.likedBy[currentUser.uid];
        post.likes = Math.max(0, (post.likes || 0) - 1);
      } else {
        post.likedBy[currentUser.uid] = true;
        post.likes = (post.likes || 0) + 1;
      }
      localStorage.setItem('ourshow_posts', JSON.stringify(posts));
      loadPosts();
      return;
    }

    const postRef = ref(db, `ourshow/posts/${postId}`);
    const snapshot = await get(postRef);
    const post = snapshot.val();

    if (!post) return;

    const likedBy = post.likedBy || {};
    const likes = post.likes || 0;

    if (likedBy[currentUser.uid]) {
      // Unlike
      delete likedBy[currentUser.uid];
      await update(postRef, {
        likes: Math.max(0, likes - 1),
        likedBy
      });
    } else {
      // Like
      likedBy[currentUser.uid] = true;
      await update(postRef, {
        likes: likes + 1,
        likedBy
      });
    }

    loadPosts();
  } catch (err) {
    console.error('Error toggling like:', err);
  }
}

// ====== DELETE POST ======
async function deletePost(postId) {
  if (!confirm('Delete this post?')) return;

  try {
    if (!db) {
      const posts = JSON.parse(localStorage.getItem('ourshow_posts') || '{}');
      delete posts[postId];
      localStorage.setItem('ourshow_posts', JSON.stringify(posts));
      loadPosts();
      return;
    }

    await remove(ref(db, `ourshow/posts/${postId}`));
    loadPosts();
  } catch (err) {
    console.error('Error deleting post:', err);
  }
}

// ====== COMMENT MODAL ======
async function openCommentModal(postId) {
  if (!currentUser) {
    alert('Please log in to comment');
    return;
  }

  currentPostId = postId;
  commentInput.value = '';
  commentsList.innerHTML = '<p class="text-gray-400 text-center">Loading comments...</p>';

  // Display original post
  try {
    if (!db) {
      const posts = JSON.parse(localStorage.getItem('ourshow_posts') || '{}');
      const post = posts[postId];
      if (post) {
        originalPost.innerHTML = `
          <div class="flex items-start gap-3">
            <img src="${post.authorPhoto}" alt="${post.authorName}" class="w-8 h-8 rounded-full">
            <div class="flex-1">
              <p class="font-semibold">${escapeHtml(post.authorName)}</p>
              <p class="text-gray-300">${escapeHtml(post.content)}</p>
              <p class="text-xs text-gray-400 mt-1">${getTimeAgo(post.timestamp)}</p>
            </div>
          </div>
        `;
        displayComments(post.comments || {});
      }
    } else {
      const postRef = ref(db, `ourshow/posts/${postId}`);
      const snapshot = await get(postRef);
      const post = snapshot.val();

      if (post) {
        originalPost.innerHTML = `
          <div class="flex items-start gap-3">
            <img src="${post.authorPhoto}" alt="${post.authorName}" class="w-8 h-8 rounded-full">
            <div class="flex-1">
              <p class="font-semibold">${escapeHtml(post.authorName)}</p>
              <p class="text-gray-300">${escapeHtml(post.content)}</p>
              <p class="text-xs text-gray-400 mt-1">${getTimeAgo(post.timestamp)}</p>
            </div>
          </div>
        `;
        displayComments(post.comments || {});
      }
    }
  } catch (err) {
    console.error('Error loading post:', err);
  }

  commentModal.classList.remove('hidden');
}

function displayComments(comments) {
  const commentsArray = Object.values(comments || {}).sort((a, b) => a.timestamp - b.timestamp);

  if (!commentsArray.length) {
    commentsList.innerHTML = '<p class="text-gray-400 text-center py-4">No comments yet. Be the first!</p>';
    return;
  }

  commentsList.innerHTML = commentsArray.map(comment => `
    <div class="bg-gray-600 p-3 rounded text-sm">
      <div class="flex items-start gap-2">
        <img src="${comment.authorPhoto}" alt="${comment.authorName}" class="w-6 h-6 rounded-full flex-shrink-0">
        <div class="flex-1">
          <p class="font-semibold text-xs">${escapeHtml(comment.authorName)}</p>
          <p class="text-gray-200 text-xs mt-1">${escapeHtml(comment.text)}</p>
          <p class="text-gray-400 text-xs mt-1">${getTimeAgo(comment.timestamp)}</p>
        </div>
      </div>
    </div>
  `).join('');
}

// ====== POST COMMENT ======
closeModalBtn.addEventListener('click', () => {
  commentModal.classList.add('hidden');
  currentPostId = null;
});

commentModal.addEventListener('click', (e) => {
  if (e.target === commentModal) {
    commentModal.classList.add('hidden');
    currentPostId = null;
  }
});

commentSubmitBtn.addEventListener('click', async () => {
  if (!currentPostId || !currentUser) return;

  const text = commentInput.value.trim();
  if (!text) {
    alert('Comment cannot be empty');
    return;
  }

  commentSubmitBtn.disabled = true;
  commentSubmitBtn.textContent = 'Posting...';

  try {
    const newComment = {
      authorId: currentUser.uid,
      authorName: currentUser.displayName || currentUser.email,
      authorPhoto: currentUser.photoURL || 'https://via.placeholder.com/40',
      text,
      timestamp: Date.now()
    };

    if (!db) {
      const posts = JSON.parse(localStorage.getItem('ourshow_posts') || '{}');
      const post = posts[currentPostId];
      if (post) {
        post.comments = post.comments || {};
        post.comments[Date.now().toString()] = newComment;
        localStorage.setItem('ourshow_posts', JSON.stringify(posts));
      }
    } else {
      await push(ref(db, `ourshow/posts/${currentPostId}/comments`), newComment);
    }

    commentInput.value = '';
    commentSubmitBtn.textContent = 'Post Comment';
    commentSubmitBtn.disabled = false;
    openCommentModal(currentPostId); // Reload comments
  } catch (err) {
    console.error('Error posting comment:', err);
    alert('Error posting comment');
    commentSubmitBtn.textContent = 'Post Comment';
    commentSubmitBtn.disabled = false;
  }
});

// ====== SHARE POST ======
function sharePost(postId) {
  const post = allPosts[postId];
  if (!post) return;

  const text = `Check out this OurShow post:\n\n"${post.content}"\n\n— ${post.authorName}`;
  if (navigator.share) {
    navigator.share({
      title: 'OurShow Post',
      text: text
    });
  } else {
    alert('Share this post:\n\n' + text);
  }
}

// ====== HELPERS ======
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

// ====== INITIAL LOAD ======
loadPosts();
