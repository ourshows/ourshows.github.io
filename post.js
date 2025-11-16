// Import Firebase modules dynamically
let dbMod, authMod;
let firebaseReady = false;
let currentUser = null;
let currentPostId = null; // For comment modal
let deletePostId = null; // For delete confirmation

// Wait for Firebase to be initialized
async function initFirebase() {
    try {
        await new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 50;
            
            const checkFirebase = setInterval(() => {
                attempts++;
                
                if (window.dbMod && window.authMod) {
                    console.log('✅ Firebase modules found!');
                    clearInterval(checkFirebase);
                    resolve();
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkFirebase);
                    reject(new Error('Firebase timeout'));
                }
            }, 100);
        });

        if (window.dbMod && window.authMod) {
            dbMod = window.dbMod;
            authMod = window.authMod;
            firebaseReady = true;
            console.log('✅ Firebase initialized for posts');
            
            // Get current user
            const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js');
            onAuthStateChanged(authMod, (user) => {
                currentUser = user;
                console.log('👤 Current user:', user ? user.email : 'Not logged in');
                updateUserAvatar();
            });
        } else {
            throw new Error('Firebase not available');
        }
    } catch (error) {
        console.warn('⚠️ Firebase unavailable, using localStorage fallback');
        firebaseReady = false;
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Format timestamp
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Update user avatar
function updateUserAvatar() {
    const avatar = document.getElementById('user-avatar');
    if (currentUser && currentUser.photoURL) {
        avatar.src = currentUser.photoURL;
    } else if (currentUser) {
        avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName || currentUser.email)}&background=6366f1&color=fff&size=128`;
    }
}

// Get user display name
function getUserDisplayName() {
    if (!currentUser) return 'Anonymous';
    return currentUser.displayName || currentUser.email?.split('@')[0] || 'User';
}

// Create post HTML
function createPostHtml(post, postId) {
    const isOwn = currentUser && post.userId === currentUser.uid;
    const avatar = post.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.author)}&background=6366f1&color=fff&size=128`;
    const likeCount = post.likeCount || 0;
    const commentCount = post.commentCount || 0;
    const isLiked = currentUser && post.likedBy && post.likedBy[currentUser.uid];
    
    return `
        <div class="post-card bg-gray-900/95 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-gray-800 shadow-lg" data-post-id="${postId}">
            <!-- Post Header -->
            <div class="flex items-start gap-3 mb-4">
                <img src="${avatar}" alt="${escapeHtml(post.author)}" 
                     class="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-indigo-500/30 flex-shrink-0"
                     onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(post.author)}&background=6366f1&color=fff&size=128'">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="font-semibold text-sm sm:text-base text-gray-100 truncate">${escapeHtml(post.author)}</h3>
                            <p class="text-xs text-gray-500">${formatTime(post.timestamp)}</p>
                        </div>
                        ${isOwn ? `
                            <button class="delete-post-btn text-gray-500 hover:text-red-500 transition p-2" data-post-id="${postId}">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                </svg>
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>

            <!-- Post Content -->
            <div class="mb-4">
                <p class="text-sm sm:text-base text-gray-200 whitespace-pre-wrap break-words">${escapeHtml(post.content)}</p>
            </div>

            <!-- Post Actions -->
            <div class="flex items-center gap-4 sm:gap-6 pt-3 border-t border-gray-800">
                <button class="like-btn flex items-center gap-2 text-gray-400 hover:text-red-500 transition ${isLiked ? 'liked text-red-500' : ''}" data-post-id="${postId}">
                    <svg class="w-5 h-5 sm:w-6 sm:h-6" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                    </svg>
                    <span class="text-sm sm:text-base font-semibold">${likeCount}</span>
                </button>
                
                <button class="comment-btn flex items-center gap-2 text-gray-400 hover:text-indigo-500 transition" data-post-id="${postId}">
                    <svg class="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                    </svg>
                    <span class="text-sm sm:text-base font-semibold">${commentCount}</span>
                </button>

                <button class="share-btn flex items-center gap-2 text-gray-400 hover:text-green-500 transition ml-auto" data-post-id="${postId}">
                    <svg class="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
                    </svg>
                </button>
            </div>
        </div>
    `;
}

// Display post
function displayPost(post, postId, prepend = false) {
    const postsFeed = document.getElementById('posts-feed');
    
    // Remove empty state
    const emptyState = postsFeed.querySelector('.text-center');
    if (emptyState) emptyState.remove();
    
    // Check if post already exists
    const existingPost = postsFeed.querySelector(`[data-post-id="${postId}"]`);
    if (existingPost) {
        existingPost.outerHTML = createPostHtml(post, postId);
    } else {
        const postDiv = document.createElement('div');
        postDiv.innerHTML = createPostHtml(post, postId);
        
        if (prepend) {
            postsFeed.insertBefore(postDiv.firstElementChild, postsFeed.firstChild);
        } else {
            postsFeed.appendChild(postDiv.firstElementChild);
        }
    }
    
    // Attach event listeners to new post
    attachPostEventListeners(postId);
}

// Attach event listeners to a post
function attachPostEventListeners(postId) {
    const postCard = document.querySelector(`[data-post-id="${postId}"]`);
    if (!postCard) return;
    
    // Like button
    const likeBtn = postCard.querySelector('.like-btn');
    if (likeBtn) {
        likeBtn.onclick = () => toggleLike(postId);
    }
    
    // Comment button
    const commentBtn = postCard.querySelector('.comment-btn');
    if (commentBtn) {
        commentBtn.onclick = () => openCommentModal(postId);
    }
    
    // Share button
    const shareBtn = postCard.querySelector('.share-btn');
    if (shareBtn) {
        shareBtn.onclick = () => sharePost(postId);
    }
    
    // Delete button
    const deleteBtn = postCard.querySelector('.delete-post-btn');
    if (deleteBtn) {
        deleteBtn.onclick = () => confirmDeletePost(postId);
    }
}

// Create post
async function createPost(content) {
    if (!content.trim()) return false;
    
    if (!currentUser) {
        alert('Please log in to create a post');
        window.location.href = 'login.html';
        return false;
    }
    
    const post = {
        author: getUserDisplayName(),
        content: content.trim(),
        timestamp: Date.now(),
        userId: currentUser.uid,
        photoURL: currentUser.photoURL || null,
        likeCount: 0,
        commentCount: 0,
        likedBy: {}
    };
    
    console.log('📤 Creating post:', post);
    
    if (firebaseReady) {
        try {
            const { ref, push } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
            const postsRef = ref(dbMod, 'ourshow/posts');
            const result = await push(postsRef, post);
            console.log('✅ Post created:', result.key);
            return true;
        } catch (error) {
            console.error('❌ Error creating post:', error);
            alert('Error creating post. Please try again.');
            return false;
        }
    } else {
        alert('Firebase not available. Please refresh the page.');
        return false;
    }
}

// Toggle like
async function toggleLike(postId) {
    if (!currentUser) {
        alert('Please log in to like posts');
        window.location.href = 'login.html';
        return;
    }
    
    if (!firebaseReady) {
        alert('Firebase not available');
        return;
    }
    
    try {
        const { ref, get, update, runTransaction } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
        const postRef = ref(dbMod, `ourshow/posts/${postId}`);
        
        // Use transaction to prevent race conditions
        await runTransaction(postRef, (post) => {
            if (post) {
                if (!post.likedBy) post.likedBy = {};
                if (!post.likeCount) post.likeCount = 0;
                
                if (post.likedBy[currentUser.uid]) {
                    // Unlike
                    delete post.likedBy[currentUser.uid];
                    post.likeCount = Math.max(0, post.likeCount - 1);
                } else {
                    // Like
                    post.likedBy[currentUser.uid] = true;
                    post.likeCount = post.likeCount + 1;
                }
            }
            return post;
        });
        
        console.log('✅ Like toggled');
    } catch (error) {
        console.error('❌ Error toggling like:', error);
        alert('Error updating like. Please try again.');
    }
}

// Open comment modal
async function openCommentModal(postId) {
    currentPostId = postId;
    const modal = document.getElementById('comment-modal');
    
    if (!firebaseReady) {
        alert('Firebase not available');
        return;
    }
    
    try {
        const { ref, get } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
        const postRef = ref(dbMod, `ourshow/posts/${postId}`);
        const snapshot = await get(postRef);
        
        if (!snapshot.exists()) {
            alert('Post not found');
            return;
        }
        
        const post = snapshot.val();
        
        // Display original post
        const originalPost = document.getElementById('modal-original-post');
        const avatar = post.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.author)}&background=6366f1&color=fff&size=128`;
        originalPost.innerHTML = `
            <div class="flex gap-3">
                <img src="${avatar}" alt="${escapeHtml(post.author)}" 
                     class="w-10 h-10 rounded-full border-2 border-indigo-500/30"
                     onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(post.author)}&background=6366f1&color=fff&size=128'">
                <div>
                    <h3 class="font-semibold text-sm text-gray-100">${escapeHtml(post.author)}</h3>
                    <p class="text-sm text-gray-300 mt-1 whitespace-pre-wrap">${escapeHtml(post.content)}</p>
                </div>
            </div>
        `;
        
        // Load comments
        await loadComments(postId);
        
        modal.classList.remove('hidden');
        
        // Focus comment input
        setTimeout(() => {
            document.getElementById('comment-input').focus();
        }, 100);
    } catch (error) {
        console.error('❌ Error opening comment modal:', error);
        alert('Error loading comments. Please try again.');
    }
}

// Load comments
async function loadComments(postId) {
    if (!firebaseReady) return;
    
    try {
        const { ref, get } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
        const commentsRef = ref(dbMod, `ourshow/posts/${postId}/comments`);
        const snapshot = await get(commentsRef);
        
        const commentsList = document.getElementById('comments-list');
        commentsList.innerHTML = '';
        
        if (!snapshot.exists()) {
            commentsList.innerHTML = '<div class="text-center text-gray-500 text-sm">No comments yet. Be the first!</div>';
            return;
        }
        
        const comments = [];
        snapshot.forEach((childSnapshot) => {
            comments.push({
                id: childSnapshot.key,
                ...childSnapshot.val()
            });
        });
        
        // Sort by timestamp (oldest first)
        comments.sort((a, b) => a.timestamp - b.timestamp);
        
        comments.forEach(comment => {
            const avatar = comment.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.author)}&background=6366f1&color=fff&size=128`;
            const commentDiv = document.createElement('div');
            commentDiv.className = 'flex gap-3 animate-slideUp';
            commentDiv.innerHTML = `
                <img src="${avatar}" alt="${escapeHtml(comment.author)}" 
                     class="w-8 h-8 rounded-full border-2 border-indigo-500/30 flex-shrink-0"
                     onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(comment.author)}&background=6366f1&color=fff&size=128'">
                <div class="flex-1 bg-gray-800/50 rounded-lg p-3">
                    <div class="flex items-center justify-between mb-1">
                        <h4 class="font-semibold text-sm text-gray-100">${escapeHtml(comment.author)}</h4>
                        <span class="text-xs text-gray-500">${formatTime(comment.timestamp)}</span>
                    </div>
                    <p class="text-sm text-gray-300 whitespace-pre-wrap">${escapeHtml(comment.text)}</p>
                </div>
            `;
            commentsList.appendChild(commentDiv);
        });
        
        // Scroll to bottom
        setTimeout(() => {
            commentsList.scrollTop = commentsList.scrollHeight;
        }, 100);
    } catch (error) {
        console.error('❌ Error loading comments:', error);
    }
}

// Add comment
async function addComment() {
    if (!currentPostId) return;
    
    if (!currentUser) {
        alert('Please log in to comment');
        window.location.href = 'login.html';
        return;
    }
    
    const input = document.getElementById('comment-input');
    const text = input.value.trim();
    
    if (!text) return;
    
    const comment = {
        author: getUserDisplayName(),
        text: text,
        timestamp: Date.now(),
        userId: currentUser.uid,
        photoURL: currentUser.photoURL || null
    };
    
    try {
        const { ref, push, runTransaction } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
        const commentsRef = ref(dbMod, `ourshow/posts/${currentPostId}/comments`);
        await push(commentsRef, comment);
        
        // Update comment count using transaction
        const postRef = ref(dbMod, `ourshow/posts/${currentPostId}`);
        await runTransaction(postRef, (post) => {
            if (post) {
                if (!post.commentCount) post.commentCount = 0;
                post.commentCount++;
            }
            return post;
        });
        
        input.value = '';
        await loadComments(currentPostId);
        
        console.log('✅ Comment added');
    } catch (error) {
        console.error('❌ Error adding comment:', error);
        alert('Error adding comment. Please try again.');
    }
}

// Share post
function sharePost(postId) {
    const url = `${window.location.origin}/post.html#${postId}`;
    
    if (navigator.share) {
        navigator.share({
            title: 'Check out this post on OurShow',
            text: 'See what people are saying about movies and TV shows!',
            url: url
        }).catch((error) => {
            console.log('Share failed:', error);
            copyToClipboard(url);
        });
    } else {
        copyToClipboard(url);
    }
}

// Copy to clipboard
function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Link copied to clipboard!');
        }).catch(() => {
            fallbackCopy(text);
        });
    } else {
        fallbackCopy(text);
    }
}

// Fallback copy method
function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        showToast('Link copied to clipboard!');
    } catch (error) {
        showToast('Failed to copy link');
    }
    document.body.removeChild(textarea);
}

// Show toast notification
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 right-4 bg-gray-800 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-slideUp';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideUp 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Confirm delete post
function confirmDeletePost(postId) {
    deletePostId = postId;
    document.getElementById('delete-modal').classList.remove('hidden');
}

// Delete post
async function deletePost() {
    if (!deletePostId || !currentUser) return;
    
    try {
        const { ref, get, remove } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
        const postRef = ref(dbMod, `ourshow/posts/${deletePostId}`);
        const snapshot = await get(postRef);
        
        if (snapshot.exists()) {
            const post = snapshot.val();
            if (post.userId === currentUser.uid) {
                await remove(postRef);
                console.log('✅ Post deleted');
                showToast('Post deleted successfully');
            } else {
                alert('You can only delete your own posts');
            }
        } else {
            alert('Post not found');
        }
        
        document.getElementById('delete-modal').classList.add('hidden');
        deletePostId = null;
    } catch (error) {
        console.error('❌ Error deleting post:', error);
        alert('Error deleting post. Please try again.');
    }
}

// Listen to Firebase posts
async function listenToPosts() {
    if (!firebaseReady) {
        const postsFeed = document.getElementById('posts-feed');
        postsFeed.innerHTML = '<div class="text-center text-gray-500 py-8"><p class="text-lg mb-2">⚠️ Firebase not available</p><p class="text-sm">Please refresh the page</p></div>';
        return;
    }
    
    try {
        const { ref, onChildAdded, onChildChanged, onChildRemoved, query, limitToLast, orderByChild } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
        
        // Load most recent 50 posts, ordered by timestamp
        const postsRef = query(
            ref(dbMod, 'ourshow/posts'),
            orderByChild('timestamp'),
            limitToLast(50)
        );
        
        // Track displayed posts to prevent duplicates
        const displayedPosts = new Set();
        
        onChildAdded(postsRef, (snapshot) => {
            const post = snapshot.val();
            const postId = snapshot.key;
            
            if (!displayedPosts.has(postId)) {
                displayedPosts.add(postId);
                displayPost(post, postId, true); // Prepend to show newest first
            }
        });
        
        onChildChanged(postsRef, (snapshot) => {
            const post = snapshot.val();
            displayPost(post, snapshot.key);
        });
        
        onChildRemoved(postsRef, (snapshot) => {
            const postCard = document.querySelector(`[data-post-id="${snapshot.key}"]`);
            if (postCard) {
                postCard.style.animation = 'slideUp 0.3s ease-out reverse';
                setTimeout(() => {
                    postCard.remove();
                    displayedPosts.delete(snapshot.key);
                    
                    // Check if feed is empty
                    const postsFeed = document.getElementById('posts-feed');
                    if (postsFeed.children.length === 0) {
                        postsFeed.innerHTML = '<div class="text-center text-gray-500 py-8"><p class="text-lg mb-2">🎬 No posts yet</p><p class="text-sm">Be the first to share something!</p></div>';
                    }
                }, 300);
            }
        });
        
        console.log('✅ Listening to posts');
    } catch (error) {
        console.error('❌ Error listening to posts:', error);
        const postsFeed = document.getElementById('posts-feed');
        postsFeed.innerHTML = '<div class="text-center text-red-500 py-8"><p class="text-lg mb-2">❌ Error loading posts</p><p class="text-sm">Please refresh the page</p></div>';
    }
}

// Setup UI event listeners
function setupEventListeners() {
    const postInput = document.getElementById('post-input');
    const postBtn = document.getElementById('post-btn');
    const charCount = document.getElementById('post-char-count');
    
    // Character counter
    postInput.addEventListener('input', () => {
        const length = postInput.value.length;
        charCount.textContent = `${length}/1000`;
        
        // Disable button if empty or too long
        postBtn.disabled = length === 0 || length > 1000;
    });
    
    // Create post
    postBtn.addEventListener('click', async () => {
        const content = postInput.value.trim();
        if (!content) return;
        
        postBtn.disabled = true;
        postBtn.textContent = 'Posting...';
        
        const success = await createPost(content);
        
        if (success) {
            postInput.value = '';
            charCount.textContent = '0/1000';
            showToast('Post created successfully!');
        }
        
        postBtn.disabled = false;
        postBtn.textContent = 'Post';
    });
    
    // Allow Ctrl+Enter to post
    postInput.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            postBtn.click();
        }
    });
    
    // Comment modal
    const closeModal = document.getElementById('close-modal');
    const commentModal = document.getElementById('comment-modal');
    
    closeModal.addEventListener('click', () => {
        commentModal.classList.add('hidden');
        currentPostId = null;
    });
    
    // Close modal on outside click
    commentModal.addEventListener('click', (e) => {
        if (e.target === commentModal) {
            commentModal.classList.add('hidden');
            currentPostId = null;
        }
    });
    
    // Add comment button
    document.getElementById('comment-btn').addEventListener('click', addComment);