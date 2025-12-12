// Social Dashboard & Chat Logic (Tabbed Version)
import { auth, db, onAuthStateChanged, collection, addDoc, query, orderBy, limit, getDocs, serverTimestamp, where, onSnapshot } from './firebase-config.js';

let currentUser = null;
let currentChatUser = null;
let currentChannelId = null;
let chatUnsubscribe = null;

// --- Auth & Init ---

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    updateProfileUI(user);
    if (user) {
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

window.switchTab = function (tabId) {
    // 1. Update Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tabId}`)?.classList.add('active');

    // 2. Update Sections
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
    document.getElementById(`section-${tabId}`)?.classList.add('active');

    // 3. Optional: Mobile scroll to top
    window.scrollTo(0, 0);
};

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
            const data = doc.data();
            displayPost(data);
        });
    } catch (error) {
        console.error('Error loading posts:', error);
        document.getElementById('feedContainer').innerHTML = '<div style="text-align: center; color: red;">Error loading feed.</div>';
    }
}

function displayPost(data) {
    const container = document.getElementById('feedContainer');
    const postDiv = document.createElement('div');
    postDiv.className = 'post-card';

    const timeStr = data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleString() : 'Just now';

    postDiv.innerHTML = `
        <div class="post-header">
            <div class="avatar" style="background: var(--glass-border);">
                <i class="fas fa-user"></i>
            </div>
            <div>
                <div style="font-weight: 600;">${data.username || 'Anonymous'}</div>
                <div style="font-size: 0.8rem; color: var(--text-secondary);">${timeStr}</div>
            </div>
        </div>
        <p style="line-height: 1.6; margin-bottom: 1rem;">${escapeHtml(data.content)}</p>
        
        <div style="margin-top: 1rem; display: flex; gap: 1rem; color: var(--text-secondary); font-size: 0.9rem;">
            <span style="cursor: pointer;"><i class="far fa-heart"></i> Like</span>
            <span style="cursor: pointer;"><i class="far fa-comment"></i> Comment</span>
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
            timestamp: serverTimestamp()
        };

        await addDoc(collection(db, 'posts'), postData);

        textarea.value = '';

        // Optimistic render
        const container = document.getElementById('feedContainer');
        const postDiv = document.createElement('div');
        postDiv.className = 'post-card';
        const timeStr = 'Just now';

        postDiv.innerHTML = `
            <div class="post-header">
                <div class="avatar" style="background: var(--glass-border);"><i class="fas fa-user"></i></div>
                <div>
                    <div style="font-weight: 600;">${postData.username}</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">${timeStr}</div>
                </div>
            </div>
            <p style="line-height: 1.6; margin-bottom: 1rem;">${escapeHtml(content)}</p>
            <div style="margin-top: 1rem; display: flex; gap: 1rem; color: var(--text-secondary); font-size: 0.9rem;">
                <span><i class="far fa-heart"></i> Like</span>
                <span><i class="far fa-comment"></i> Comment</span>
            </div>
        `;

        container.insertBefore(postDiv, container.firstChild);

        // Ensure feed tab is active? (It probably is if they clicked post)

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

    // Mock User Search (replace with real Firestore query if indexed)
    const mockUsers = [
        { id: 'mock_1', name: 'Alice Smith', handle: '@alice' },
        { id: 'mock_2', name: 'Bob Jones', handle: '@bob' },
        { id: 'mock_3', name: 'Charlie Day', handle: '@charlie' },
        { id: 'mock_4', name: 'David Lee', handle: '@david' }
    ];

    const filtered = mockUsers.filter(u => u.name.toLowerCase().includes(queryText));

    if (filtered.length === 0) {
        resultsContainer.innerHTML = '<div style="text-align: center; padding: 1rem; color: var(--text-secondary);">No users found.</div>';
    } else {
        resultsContainer.innerHTML = filtered.map(user => `
            <div class="glass-panel" style="padding: 1rem; display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem;">
                <div class="avatar" style="width: 40px; height: 40px; font-size: 0.8rem; background: var(--glass-border);">
                    ${user.name.charAt(0)}
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 600; font-size: 0.9rem;">${user.name}</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">${user.handle}</div>
                </div>
                <button class="glass-button" onclick="startChat('${user.id}', '${user.name}')" style="padding: 0.4rem 0.8rem; font-size: 0.9rem;">
                    <i class="fas fa-comment-dots"></i> Message
                </button>
            </div>
        `).join('');
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
    switchTab('chat');

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

window.submitPost = submitPost;
