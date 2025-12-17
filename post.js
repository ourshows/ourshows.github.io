// Social Dashboard & Chat Logic (Tabbed Version)
import { auth, db, onAuthStateChanged, collection, addDoc, setDoc, doc, query, orderBy, limit, getDocs, serverTimestamp, where, onSnapshot, arrayUnion, arrayRemove, updateDoc } from './firebase-wrapper.js';

let currentUser = null;
let currentChatUser = null;
let currentChannelId = null;
let chatUnsubscribe = null;

// --- Auth & Init ---

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    updateProfileUI(user);
    if (user) {
        // Sync user to Firestore so they can be found in search
        try {
            await setDoc(doc(db, 'users', user.uid), {
                displayName: user.displayName || user.email.split('@')[0],
                email: user.email,
                photoURL: user.photoURL || null,
                lastSeen: serverTimestamp(),
                username: user.email.split('@')[0].toLowerCase() // Add searchable lowercase username
            }, { merge: true });
        } catch (e) {
            console.error("Error syncing user profile:", e);
        }

        loadPosts();
    } else {
        document.getElementById('feedContainer').innerHTML = '<div style="text-align: center; padding: 2rem;">Please log in to view the feed.</div>';
    }
});

document.addEventListener('DOMContentLoaded', () => {
    loadPosts();

    // Chat Enter Key
    document.getElementById('chatInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });

    // Search Enter Key
    document.getElementById('userSearchInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchUsers();
    });
});

function updateProfileUI(user) {
    if (user) {
        // Profile Section
        const nameEl = document.getElementById('profileName');
        const handleEl = document.getElementById('profileHandle');
        if (nameEl) nameEl.textContent = user.displayName || 'User';
        if (handleEl) handleEl.textContent = user.email || '@user';

    } else {
        const nameEl = document.getElementById('profileName');
        if (nameEl) nameEl.textContent = 'Guest';
    }
}

// --- Feed Logic ---

async function loadPosts() {
    try {
        const q = query(collection(db, 'posts'), orderBy('timestamp', 'desc'), limit(20));
        const querySnapshot = await getDocs(q);
        const container = document.getElementById('feedContainer');
        container.innerHTML = '';

        if (querySnapshot.empty) {
            container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No posts yet. Be the first!</div>';
            return;
        }

        querySnapshot.forEach((doc) => {
            displayPost(doc.id, doc.data());
        });
    } catch (error) {
        console.error('Error loading posts:', error);
        document.getElementById('feedContainer').innerHTML = '<div style="text-align: center; color: red;">Error loading feed.</div>';
    }
}

function displayPost(id, data) {
    const container = document.getElementById('feedContainer');
    const postDiv = document.createElement('div');
    postDiv.className = 'post-card';
    postDiv.id = `post-${id}`;

    const timeStr = data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleString() : 'Just now';
    const likes = data.likes || [];
    const isLiked = currentUser && likes.includes(currentUser.uid);
    const likeCount = likes.length;
    const commentCount = data.comments ? data.comments.length : 0; // Simple count if array, or use subcollection count later

    postDiv.innerHTML = `
        <div class="post-header">
            <div class="avatar" style="background: var(--glass-border); cursor: pointer;" onclick="startChat('${data.userId}', '${data.username}')" title="Chat with ${data.username}">
                ${data.username.charAt(0).toUpperCase()}
            </div>
            <div>
                <div style="font-weight: 600; cursor: pointer; color: var(--text-primary);" onclick="startChat('${data.userId}', '${data.username}')" title="Add Friend / Chat">
                    ${data.username} <i class="fas fa-user-plus" style="font-size: 0.7em; color: var(--primary-color); margin-left: 5px;"></i>
                </div>
                <div style="font-size: 0.8rem; color: var(--text-secondary);">${timeStr}</div>
            </div>
        </div>
        <p style="line-height: 1.6; margin-bottom: 1rem;">${escapeHtml(data.content)}</p>
        
        <div style="margin-top: 1rem; display: flex; gap: 1.5rem; color: var(--text-secondary); font-size: 0.9rem; border-top: 1px solid var(--glass-border); padding-top: 0.8rem;">
            <span style="cursor: pointer; display: flex; align-items: center; gap: 5px; color: ${isLiked ? '#e74c3c' : 'inherit'};" onclick="window.toggleLike('${id}')">
                <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i> ${likeCount || 'Like'}
            </span>
            <span style="cursor: pointer; display: flex; align-items: center; gap: 5px;" onclick="window.toggleComments('${id}')">
                <i class="far fa-comment"></i> Comment
            </span>
        </div>

        <!-- Comment Section -->
        <div id="comments-${id}" style="display: none; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--glass-border);">
            <div id="comments-list-${id}" style="margin-bottom: 1rem; font-size: 0.9rem;">
                <!-- Comments injected here -->
                ${(data.comments || []).map(c => `
                    <div style="margin-bottom: 0.5rem;">
                        <strong style="color: var(--primary-color);">${escapeHtml(c.username)}:</strong> ${escapeHtml(c.text)}
                    </div>
                `).join('')}
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <input type="text" id="comment-input-${id}" class="glass-input" placeholder="Write a comment..." style="padding: 0.5rem;">
                <button class="glass-button" style="padding: 0.5rem 1rem;" onclick="window.submitComment('${id}')"><i class="fas fa-paper-plane"></i></button>
            </div>
        </div>
    `;

    container.appendChild(postDiv);
}

async function submitPost() {
    const textarea = document.getElementById('postContent');
    const content = textarea.value.trim();

    if (!content) return alert('Please write something!');
    if (!currentUser) return alert('Please log in first!');

    try {
        const postData = {
            userId: currentUser.uid,
            username: currentUser.displayName || currentUser.email.split('@')[0],
            content: content,
            timestamp: serverTimestamp(),
            likes: [],
            comments: []
        };

        const docRef = await addDoc(collection(db, 'posts'), postData);
        textarea.value = '';

        // Optimistic render
        displayPost(docRef.id, { ...postData, timestamp: { seconds: Date.now() / 1000 } });

        // Move new post to top (displayPost appends, so we need to move it)
        const container = document.getElementById('feedContainer');
        const newPost = document.getElementById(`post-${docRef.id}`);
        if (newPost && container.firstChild) {
            container.insertBefore(newPost, container.firstChild);
        }

    } catch (error) {
        console.error('Error adding post:', error);
        alert('Failed to post.');
    }
}

// --- Chat Logic ---

window.searchUsers = async function () {
    const input = document.getElementById('userSearchInput');
    const queryText = input.value.trim().toLowerCase();
    const resultsContainer = document.getElementById('userSearchResults');

    if (!queryText) {
        resultsContainer.innerHTML = '';
        return;
    }

    resultsContainer.innerHTML = '<div style="text-align: center; padding: 1rem;">Searching...</div>';

    try {
        // Query users collection
        // Note: Firestore doesn't support partial string match easily without 3rd party like Algolia.
        // We will fetch all users for now (prototype) or use a simple prefix match if username field exists.
        // For efficiency in a real app, this should be a bounded query or use a dedicated search field.

        // Optimally: where('chatUsername', '>=', queryText), where('chatUsername', '<=', queryText + '\uf8ff')
        // But names might be mixed case. For now, let's just get the users and filter client side for smooth "demo" feel 
        // regarding case-insensitivity, assuming small user base.

        const q = query(collection(db, 'users'), limit(50));
        const snapshot = await getDocs(q);

        const users = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            // Allow searching self for testing, but mark it

            // Robust search: Check displayName, username, chatUsername, and email
            const name = data.displayName || data.chatUsername || 'Unknown';
            const email = data.email || '';
            const username = data.username || '';

            if (
                name.toLowerCase().includes(queryText) ||
                email.toLowerCase().includes(queryText) ||
                username.toLowerCase().includes(queryText)
            ) {
                users.push({
                    id: doc.id,
                    name: name,
                    handle: email.split('@')[0],
                    isSelf: doc.id === currentUser?.uid
                });
            }
        });

        if (users.length === 0) {
            resultsContainer.innerHTML = '<div style="text-align: center; padding: 1rem; color: var(--text-secondary);">No users found.</div>';
        } else {
            resultsContainer.innerHTML = users.map(user => `
                <div class="glass-panel" style="padding: 1rem; display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem;">
                    <div class="avatar" style="width: 40px; height: 40px; font-size: 0.8rem; background: var(--glass-border); display: flex; align-items: center; justify-content: center;">
                        ${user.name.charAt(0).toUpperCase()}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 0.9rem;">
                            ${user.name} 
                            ${user.isSelf ? '<span style="color: var(--primary-color); font-size: 0.8em; margin-left: 5px;">(You)</span>' : ''}
                        </div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary);">@${user.handle}</div>
                    </div>
                    ${!user.isSelf ? `
                    <button class="glass-button" onclick="startChat('${user.id}', '${user.name}')" style="padding: 0.4rem 0.8rem; font-size: 0.9rem;">
                        <i class="fas fa-user-plus"></i> Add Friend
                    </button>
                    ` : ''}
                </div>
            `).join('');
        }
    } catch (e) {
        console.error("Search error:", e);
        resultsContainer.innerHTML = '<div style="text-align: center; color: red;">Search failed.</div>';
    }
};

window.startChat = function (userId, userName) {
    if (!currentUser) return alert('Please log in to chat.');

    currentChatUser = { id: userId, name: userName };

    // Create unique channel ID
    const ids = [currentUser.uid, userId].sort();
    currentChannelId = `chat_${ids[0]}_${ids[1]}`;

    // Update UI
    document.getElementById('chatPlaceholder').style.display = 'none';
    document.getElementById('chatWindow').style.display = 'flex';
    document.getElementById('chatHeaderName').textContent = userName;

    // Switch to Chat Tab automatically
    if (window.switchSocialTab) {
        window.switchSocialTab('chat');
    } else {
        console.error("switchSocialTab not found");
    }

    subscribeToChat();
};

window.closeChat = function () {
    currentChatUser = null;
    currentChannelId = null;
    if (chatUnsubscribe) chatUnsubscribe();

    document.getElementById('chatPlaceholder').style.display = 'block';
    document.getElementById('chatWindow').style.display = 'none';
};

function subscribeToChat() {
    if (chatUnsubscribe) chatUnsubscribe();

    const container = document.getElementById('chatMessages');
    container.innerHTML = '<div style="text-align: center; margin-top: 2rem; color: var(--text-secondary);">Loading history...</div>';

    const q = query(
        collection(db, 'messages'),
        where('channel', '==', currentChannelId),
        orderBy('timestamp', 'desc'),
        limit(50)
    );

    chatUnsubscribe = onSnapshot(q, (snapshot) => {
        container.innerHTML = '';
        const messages = [];
        snapshot.forEach(doc => messages.push(doc.data()));
        messages.reverse(); // Show oldest first

        if (messages.length === 0) {
            container.innerHTML = '<div style="text-align: center; margin-top: 2rem; color: var(--text-secondary);">Say hello to your new friend! 👋</div>';
        }

        messages.forEach(msg => {
            const div = document.createElement('div');
            const isSelf = msg.userId === currentUser.uid;
            div.className = `message ${isSelf ? 'self' : ''}`;
            div.textContent = msg.text;
            div.title = msg.timestamp ? new Date(msg.timestamp.seconds * 1000).toLocaleString() : '';
            container.appendChild(div);
        });

        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    });
}

window.sendChatMessage = async function () {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();

    if (!text || !currentChannelId || !currentUser) return;

    try {
        await addDoc(collection(db, 'messages'), {
            text: text,
            channel: currentChannelId,
            userId: currentUser.uid,
            username: currentUser.displayName || 'User',
            timestamp: serverTimestamp()
        });
        input.value = '';
    } catch (error) {
        console.error("Error sending message:", error);
    }
};

// --- Helpers ---

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


window.toggleLike = async function (postId) {
    if (!currentUser) return alert('Please log in.');

    try {
        const postDiv = document.getElementById(`post-${postId}`);
        // Simple client-side toggle visual before server sync
        // Note: Real-time listener (if used) would update this, but we are fetching on load.
        // For production, we should set up a listener for the feed or individual post.

        // We'll just trigger the backend update. A full refresh would show new state.
        // But for UX, let's look at getting the current state if possible or just naive toggle from UI?
        // Let's do a transactional style logic if we want to be safe, but simple arrayUnion is idempotent.

        // We need to know if currently liked to choose Union or Remove.
        // Since we don't have the data object readily available (without parsing DOM or storing state),
        // we will fetch the doc momentarily or assume from button class.

        const likeBtnIcon = postDiv.querySelector('.fa-heart');
        const isLiked = likeBtnIcon.classList.contains('fas');

        const postRef = doc(db, 'posts', postId);

        if (isLiked) {
            // Un-like
            likeBtnIcon.classList.remove('fas');
            likeBtnIcon.classList.add('far');
            likeBtnIcon.style.color = '';
            await updateDoc(postRef, {
                likes: arrayRemove(currentUser.uid)
            });
        } else {
            // Like
            likeBtnIcon.classList.remove('far');
            likeBtnIcon.classList.add('fas');
            likeBtnIcon.style.color = '#e74c3c';
            await updateDoc(postRef, {
                likes: arrayUnion(currentUser.uid)
            });
        }
        // Ideally update count text too
    } catch (e) {
        console.error("Like error:", e);
    }
};

window.toggleComments = function (postId) {
    const section = document.getElementById(`comments-${postId}`);
    if (section) {
        section.style.display = section.style.display === 'none' ? 'block' : 'none';

        // Focus input if opening
        if (section.style.display === 'block') {
            const input = document.getElementById(`comment-input-${postId}`);
            if (input) input.focus();
        }
    }
};

window.submitComment = async function (postId) {
    if (!currentUser) return alert('Please log in.');

    const input = document.getElementById(`comment-input-${postId}`);
    const text = input.value.trim();
    if (!text) return;

    try {
        const commentData = {
            userId: currentUser.uid,
            username: currentUser.displayName || currentUser.email.split('@')[0],
            text: text,
            timestamp: Date.now()
        };

        // Add to 'comments' array in the post document
        await updateDoc(doc(db, 'posts', postId), {
            comments: arrayUnion(commentData)
        });

        // Optimistic append
        const list = document.getElementById(`comments-list-${postId}`);
        const div = document.createElement('div');
        div.style.marginBottom = '0.5rem';
        div.innerHTML = `<strong style="color: var(--primary-color);">${escapeHtml(commentData.username)}:</strong> ${escapeHtml(text)}`;
        list.appendChild(div);

        input.value = '';
    } catch (e) {
        console.error("Comment error:", e);
        alert('Failed to comment.');
    }
};
