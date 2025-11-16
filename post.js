// Import Firebase modules dynamically
let dbMod, authMod;
let firebaseReady = false;
let currentUser = null;
let currentPostId = null;
let deletePostId = null;
let editPostId = null;
let editCommentData = null;
let deleteCommentData = null;

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
        console.warn('⚠️ Firebase unavailable:', error);
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
    const isAnonymous = post.isAnonymous === true;
    const displayName = isAnonymous ? 'Anonymous' : post.author;
    const avatar = isAnonymous 
        ? 'https://ui-avatars.com/api/?name=Anonymous&background=gray&color=fff&size=128'
        : (post.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.author)}&background=6366f1&color=fff&size=128`);
    
    const likeCount = post.likeCount || 0;
    const commentCount = post.commentCount || 0;
    const isLiked = currentUser && post.likedBy && post.likedBy[currentUser.uid];
    
    return `
        <div class="post-card bg-gray-900/95 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-gray-800 shadow-lg" data-post-id="${postId}">
            <div class="flex items-start gap-3 mb-4">
                <img src="${avatar}" alt="${escapeHtml(displayName)}" 
                     class="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-indigo-500/30 flex-shrink-0"
                     onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=6366f1&color=fff&size=128'">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="font-semibold text-sm sm:text-base text-gray-100 truncate flex items-center gap-2">
                                ${escapeHtml(displayName)}
                                ${isAnonymous ? '<span class="text-xs bg-gray-700 px-2 py-0.5 rounded">🕶️ Anonymous</span>' : ''}
                            </h3>
                            <p class="text-xs text-gray-500">${formatTime(post.timestamp)}</p>
                        </div>
                        ${isOwn ? `
                            <div class="flex gap-1">
                                <button class="edit-post-btn text-gray-500 hover:text-blue-500 transition p-2" data-post-id="${postId}">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                    </svg>
                                </button>
                                <button class="delete-post-btn text-gray-500 hover:text-red-500 transition p-2" data-post-id="${postId}">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                    </svg>
                                </button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            <div class="mb-4">
                <p class="text-sm sm:text-base text-gray-200 whitespace-pre-wrap break-words">${escapeHtml(post.content)}</p>
            </div>
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
    const emptyState = postsFeed.querySelector('.text-center');
    if (emptyState) emptyState.remove();
    
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
    
    attachPostEventListeners(postId);
}

// Attach event listeners
function attachPostEventListeners(postId) {
    const postCard = document.querySelector(`[data-post-id="${postId}"]`);
    if (!postCard) return;
    
    const likeBtn = postCard.querySelector('.like-btn');
    if (likeBtn) likeBtn.onclick = () => toggleLike(postId);
    
    const commentBtn = postCard.querySelector('.comment-btn');
    if (commentBtn) commentBtn.onclick = () => openCommentModal(postId);
    
    const shareBtn = postCard.querySelector('.share-btn');
    if (shareBtn) shareBtn.onclick = () => sharePost(postId);
    
    const editBtn = postCard.querySelector('.edit-post-btn');
    if (editBtn) editBtn.onclick = () => openEditPostModal(postId);
    
    const deleteBtn = postCard.querySelector('.delete-post-btn');
    if (deleteBtn) deleteBtn.onclick = () => confirmDeletePost(postId);
}

// Create post
async function createPost(content, isAnonymous = false) {
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
        photoURL: isAnonymous ? null : (currentUser.photoURL || null),
        likeCount: 0,
        commentCount: 0,
        likedBy: {},
        isAnonymous: isAnonymous
    };
    
    if (firebaseReady) {
        try {
            const { ref, push } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
            const postsRef = ref(dbMod, 'ourshow/posts');
            await push(postsRef, post);
            return true;
        } catch (error) {
            console.error('❌ Error creating post:', error);
            alert('Error creating post');
            return false;
        }
    } else {
        alert('Firebase not available');
        return false;
    }
}

// Open edit post modal
async function openEditPostModal(postId) {
    if (!firebaseReady) return;
    
    try {
        const { ref, get } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
        const postRef = ref(dbMod, `ourshow/posts/${postId}`);
        const snapshot = await get(postRef);
        
        if (!snapshot.exists()) return;
        
        const post = snapshot.val();
        if (post.userId !== currentUser.uid) return;
        
        editPostId = postId;
        const input = document.getElementById('post-input');
        input.value = post.content;
        input.focus();
        
        const postBtn = document.getElementById('post-btn');
        postBtn.textContent = 'Update Post';
        postBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
        postBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
        
        // Show cancel button
        let cancelBtn = document.getElementById('cancel-edit-btn');
        if (!cancelBtn) {
            cancelBtn = document.createElement('button');
            cancelBtn.id = 'cancel-edit-btn';
            cancelBtn.className = 'px-4 sm:px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition text-sm sm:text-base';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.onclick = cancelEdit;
            postBtn.parentNode.insertBefore(cancelBtn, postBtn);
        }
        
        document.getElementById('post-char-count').textContent = `${post.content.length}/1000`;
    } catch (error) {
        console.error('❌ Error loading post for edit:', error);
    }
}

// Cancel edit
function cancelEdit() {
    editPostId = null;
    document.getElementById('post-input').value = '';
    document.getElementById('post-char-count').textContent = '0/1000';
    
    const postBtn = document.getElementById('post-btn');
    postBtn.textContent = 'Post';
    postBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
    postBtn.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
    
    const cancelBtn = document.getElementById('cancel-edit-btn');
    if (cancelBtn) cancelBtn.remove();
}

// Update post
async function updatePost(postId, content) {
    if (!firebaseReady) return false;
    
    try {
        const { ref, update } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
        const postRef = ref(dbMod, `ourshow/posts/${postId}`);
        await update(postRef, {
            content: content.trim(),
            edited: true,
            editedAt: Date.now()
        });
        return true;
    } catch (error) {
        console.error('❌ Error updating post:', error);
        return false;
    }
}

// Toggle like with real-time sync fix
async function toggleLike(postId) {
    if (!currentUser) {
        alert('Please log in to like posts');
        return;
    }
    
    if (!firebaseReady) return;
    
    try {
        const { ref, runTransaction } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
        const postRef = ref(dbMod, `ourshow/posts/${postId}`);
        
        await runTransaction(postRef, (post) => {
            if (post) {
                if (!post.likedBy) post.likedBy = {};
                if (!post.likeCount) post.likeCount = 0;
                
                if (post.likedBy[currentUser.uid]) {
                    delete post.likedBy[currentUser.uid];
                    post.likeCount = Math.max(0, post.likeCount - 1);
                } else {
                    post.likedBy[currentUser.uid] = true;
                    post.likeCount = post.likeCount + 1;
                }
            }
            return post;
        });
        
        console.log('✅ Like toggled');
    } catch (error) {
        console.error('❌ Error toggling like:', error);
    }
}

// Open comment modal
async function openCommentModal(postId) {
    currentPostId = postId;
    
    if (!firebaseReady) return;
    
    try {
        const { ref, get } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
        const postRef = ref(dbMod, `ourshow/posts/${postId}`);
        const snapshot = await get(postRef);
        
        if (!snapshot.exists()) return;
        
        const post = snapshot.val();
        const isAnonymous = post.isAnonymous === true;
        const displayName = isAnonymous ? 'Anonymous' : post.author;
        const avatar = isAnonymous 
            ? 'https://ui-avatars.com/api/?name=Anonymous&background=gray&color=fff&size=128'
            : (post.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.author)}&background=6366f1&color=fff&size=128`);
        
        document.getElementById('modal-original-post').innerHTML = `
            <div class="flex gap-3">
                <img src="${avatar}" alt="${escapeHtml(displayName)}" 
                     class="w-10 h-10 rounded-full border-2 border-indigo-500/30"
                     onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=6366f1&color=fff&size=128'">
                <div>
                    <h3 class="font-semibold text-sm text-gray-100">${escapeHtml(displayName)}</h3>
                    <p class="text-sm text-gray-300 mt-1 whitespace-pre-wrap">${escapeHtml(post.content)}</p>
                </div>
            </div>
        `;
        
        await loadComments(postId);
        document.getElementById('comment-modal').classList.remove('hidden');
        setTimeout(() => document.getElementById('comment-input').focus(), 100);
    } catch (error) {
        console.error('❌ Error opening modal:', error);
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
            comments.push({ id: childSnapshot.key, ...childSnapshot.val() });
        });
        
        comments.sort((a, b) => a.timestamp - b.timestamp);
        
        comments.forEach(comment => {
            const isOwn = currentUser && comment.userId === currentUser.uid;
            const avatar = comment.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.author)}&background=6366f1&color=fff&size=128`;
            const div = document.createElement('div');
            div.className = 'flex gap-3';
            div.innerHTML = `
                <img src="${avatar}" alt="${escapeHtml(comment.author)}" 
                     class="w-8 h-8 rounded-full border-2 border-indigo-500/30 flex-shrink-0"
                     onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(comment.author)}&background=6366f1&color=fff&size=128'">
                <div class="flex-1 bg-gray-800/50 rounded-lg p-3">
                    <div class="flex items-center justify-between mb-1">
                        <h4 class="font-semibold text-sm text-gray-100">${escapeHtml(comment.author)}</h4>
                        <div class="flex items-center gap-2">
                            <span class="text-xs text-gray-500">${formatTime(comment.timestamp)}</span>
                            ${isOwn ? `
                                <button class="edit-comment-btn text-gray-500 hover:text-blue-500 transition" data-comment-id="${comment.id}">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                    </svg>
                                </button>
                                <button class="delete-comment-btn text-gray-500 hover:text-red-500 transition" data-comment-id="${comment.id}">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                    </svg>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                    <p class="text-sm text-gray-300 whitespace-pre-wrap">${escapeHtml(comment.text)}</p>
                </div>
            `;
            commentsList.appendChild(div);
            
            // Attach comment action listeners
            if (isOwn) {
                div.querySelector('.edit-comment-btn').onclick = () => editComment(comment.id, comment.text);
                div.querySelector('.delete-comment-btn').onclick = () => confirmDeleteComment(comment.id);
            }
        });
        
        setTimeout(() => commentsList.scrollTop = commentsList.scrollHeight, 100);
    } catch (error) {
        console.error('❌ Error loading comments:', error);
    }
}

// Edit comment
function editComment(commentId, currentText) {
    const input = document.getElementById('comment-input');
    input.value = currentText;
    input.focus();
    
    editCommentData = { commentId, originalText: currentText };
    
    const commentBtn = document.getElementById('comment-btn');
    commentBtn.textContent = 'Update';
    commentBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
}

// Update comment
async function updateComment(commentId, newText) {
    if (!currentPostId || !firebaseReady) return false;
    
    try {
        const { ref, update } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
        const commentRef = ref(dbMod, `ourshow/posts/${currentPostId}/comments/${commentId}`);
        await update(commentRef, {
            text: newText.trim(),
            edited: true,
            editedAt: Date.now()
        });
        return true;
    } catch (error) {
        console.error('❌ Error updating comment:', error);
        return false;
    }
}

// Confirm delete comment
function confirmDeleteComment(commentId) {
    deleteCommentData = { commentId };
    if (confirm('Delete this comment?')) {
        deleteComment(commentId);
    }
}

// Delete comment
async function deleteComment(commentId) {
    if (!currentPostId || !firebaseReady) return;
    
    try {
        const { ref, remove, runTransaction } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
        const commentRef = ref(dbMod, `ourshow/posts/${currentPostId}/comments/${commentId}`);
        await remove(commentRef);
        
        // Update comment count
        const postRef = ref(dbMod, `ourshow/posts/${currentPostId}`);
        await runTransaction(postRef, (post) => {
            if (post && post.commentCount > 0) {
                post.commentCount--;
            }
            return post;
        });
        
        await loadComments(currentPostId);
        console.log('✅ Comment deleted');
    } catch (error) {
        console.error('❌ Error deleting comment:', error);
    }
}

// Add comment
async function addComment() {
    if (!currentPostId || !currentUser) return;
    
    const input = document.getElementById('comment-input');
    const text = input.value.trim();
    if (!text) return;
    
    // Check if editing
    if (editCommentData) {
        const success = await updateComment(editCommentData.commentId, text);
        if (success) {
            input.value = '';
            editCommentData = null;
            const commentBtn = document.getElementById('comment-btn');
            commentBtn.textContent = 'Post';
            commentBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
            await loadComments(currentPostId);
        }
        return;
    }
    
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
    } catch (error) {
        console.error('❌ Error adding comment:', error);
    }
}

// Share post
function sharePost(postId) {
    const url = `${window.location.origin}/post.html#${postId}`;
    
    if (navigator.share) {
        navigator.share({ title: 'Check out this post', url: url }).catch(() => copyToClipboard(url));
    } else {
        copyToClipboard(url);
    }
}

// Copy to clipboard
function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => alert('Link copied!')).catch(() => fallbackCopy(text));
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        alert('Link copied!');
    } catch (e) {
        alert('Failed to copy');
    }
    document.body.removeChild(textarea);
}

// Confirm delete
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
        
        if (snapshot.exists() && snapshot.val().userId === currentUser.uid) {
            await remove(postRef);
        }
        
        document.getElementById('delete-modal').classList.add('hidden');
        deletePostId = null;
    } catch (error) {
        console.error('❌ Error deleting:', error);
    }
}

// Listen to posts
async function listenToPosts() {
    if (!firebaseReady) return;
    
    try {
        const { ref, onChildAdded, onChildChanged, onChildRemoved, query, limitToLast, orderByChild } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
        
        const postsRef = query(ref(dbMod, 'ourshow/posts'), orderByChild('timestamp'), limitToLast(50));
        const displayedPosts = new Set();
        
        onChildAdded(postsRef, (snapshot) => {
            if (!displayedPosts.has(snapshot.key)) {
                displayedPosts.add(snapshot.key);
                displayPost(snapshot.val(), snapshot.key, true);
            }
        });
        
        onChildChanged(postsRef, (snapshot) => displayPost(snapshot.val(), snapshot.key));
        
        onChildRemoved(postsRef, (snapshot) => {
            const card = document.querySelector(`[data-post-id="${snapshot.key}"]`);
            if (card) {
                card.style.animation = 'slideUp 0.3s reverse';
                setTimeout(() => card.remove(), 300);
            }
        });
    } catch (error) {
        console.error('❌ Error listening:', error);
    }
}

// Setup listeners
function setupEventListeners() {
    const postInput = document.getElementById('post-input');
    const postBtn = document.getElementById('post-btn');
    const charCount = document.getElementById('post-char-count');
    
    postInput.addEventListener('input', () => {
        const len = postInput.value.length;
        charCount.textContent = `${len}/1000`;
        postBtn.disabled = len === 0 || len > 1000;
    });
    
    postBtn.addEventListener('click', async () => {
        const content = postInput.value.trim();
        if (!content) return;
        
        postBtn.disabled = true;
        const btnText = postBtn.textContent;
        postBtn.textContent = 'Posting...';
        
        let success = false;
        
        if (editPostId) {
            // Update existing post
            success = await updatePost(editPostId, content);
            if (success) {
                cancelEdit();
            }
        } else {
            // Create new post - check if anonymous
            const anonymousCheckbox = document.getElementById('anonymous-checkbox');
            const isAnonymous = anonymousCheckbox ? anonymousCheckbox.checked : false;
            success = await createPost(content, isAnonymous);
            
            if (success) {
                postInput.value = '';
                charCount.textContent = '0/1000';
                if (anonymousCheckbox) anonymousCheckbox.checked = false;
            }
        }
        
        postBtn.disabled = false;
        postBtn.textContent = btnText;
    });
    
    postInput.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') postBtn.click();
    });
    
    document.getElementById('close-modal').addEventListener('click', () => {
        document.getElementById('comment-modal').classList.add('hidden');
        currentPostId = null;
        editCommentData = null;
        const commentBtn = document.getElementById('comment-btn');
        commentBtn.textContent = 'Post';
        commentBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
        document.getElementById('comment-input').value = '';
    });
    
    document.getElementById('comment-modal').addEventListener('click', (e) => {
        if (e.target.id === 'comment-modal') {
            document.getElementById('comment-modal').classList.add('hidden');
            currentPostId = null;
            editCommentData = null;
        }
    });
    
    document.getElementById('comment-btn').addEventListener('click', addComment);
    
    document.getElementById('comment-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            addComment();
        }
    });
    
    document.getElementById('cancel-delete').addEventListener('click', () => {
        document.getElementById('delete-modal').classList.add('hidden');
        deletePostId = null;
    });
    
    document.getElementById('confirm-delete').addEventListener('click', deletePost);
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await initFirebase();
    setupEventListeners();
    await listenToPosts();
});