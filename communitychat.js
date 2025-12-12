// Community Chat with Firebase Integration & Clubs
import { auth, db, onAuthStateChanged, collection, addDoc, query, orderBy, limit, getDocs, serverTimestamp, where, onSnapshot } from './firebase-config.js';

let isSpoilerMode = false;
let currentUser = null;
let currentChannel = 'global'; // 'global' or 'club_{clubId}'
let currentClubName = 'Global Chat';
let unsubscribeMessages = null;
let unsubscribeClubs = null;

// Listen for auth state
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        subscribeToClubs();
        subscribeToMessages();
    } else {
        // Even if not logged in, we can try to load clubs and messages (read-only)
        subscribeToClubs();
        subscribeToMessages();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('msgInput');
    const sendBtn = document.getElementById('sendBtn');
    const spoilerBtn = document.getElementById('spoilerToggle');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const sidebar = document.getElementById('sidebar');

    // Club Modal Elements
    const createClubTrigger = document.getElementById('createClubBtnTrigger');
    const createClubModal = document.getElementById('createClubModal');
    const closeClubModal = document.getElementById('closeClubModal');
    const confirmCreateClubBtn = document.getElementById('confirmCreateClubBtn');
    const globalChatBtn = document.getElementById('globalChatBtn');

    // Toggle Sidebar
    function toggleSidebar() {
        sidebar.classList.toggle('active');
        sidebarOverlay.classList.toggle('active');
    }

    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', toggleSidebar);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', toggleSidebar);

    // Global Chat Click
    if (globalChatBtn) {
        globalChatBtn.addEventListener('click', () => {
            switchChannel('global', 'Global Chat');
            closeSidebarMobile();
        });
    }

    // Modal Logic
    if (createClubTrigger) {
        createClubTrigger.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent bubbling
            if (!currentUser) {
                alert("Please log in to create a club.");
                return;
            }
            createClubModal.style.display = 'block';
        });
    }

    if (closeClubModal) {
        closeClubModal.addEventListener('click', () => {
            createClubModal.style.display = 'none';
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === createClubModal) {
            createClubModal.style.display = 'none';
        }
    });

    if (confirmCreateClubBtn) {
        confirmCreateClubBtn.addEventListener('click', createNewClub);
    }

    // Spoiler & Send
    if (spoilerBtn) {
        spoilerBtn.addEventListener('click', () => {
            isSpoilerMode = !isSpoilerMode;
            spoilerBtn.classList.toggle('active');
            input.placeholder = isSpoilerMode ? "Type a spoiler mode..." : "Type a message...";
        });
    }

    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }
});

function closeSidebarMobile() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
}

async function createNewClub() {
    const nameInput = document.getElementById('newClubName');
    const name = nameInput.value.trim();

    if (!name) return;

    try {
        await addDoc(collection(db, 'clubs'), {
            name: name,
            createdBy: currentUser.uid,
            createdAt: serverTimestamp(),
            members: [currentUser.uid]
        });

        document.getElementById('createClubModal').style.display = 'none';
        nameInput.value = '';
        // No need to refresh list, subscription will handle it
    } catch (error) {
        console.error("Error creating club:", error);
        alert("Failed to create club. Check permissions.");
    }
}

function subscribeToClubs() {
    if (unsubscribeClubs) unsubscribeClubs();

    const clubsContainer = document.getElementById('clubsListContainer');
    const q = query(collection(db, 'clubs'), orderBy('createdAt', 'desc'));

    unsubscribeClubs = onSnapshot(q, (snapshot) => {
        clubsContainer.innerHTML = '';
        if (snapshot.empty) {
            clubsContainer.innerHTML = '<div style="padding:1rem; opacity:0.7; font-size:0.9rem;">No clubs found. Create one!</div>';
            return;
        }

        snapshot.forEach(doc => {
            const club = doc.data();
            const el = document.createElement('li');
            el.className = 'channel-item';
            if (currentChannel === `club_${doc.id}`) el.classList.add('active');

            el.innerHTML = `<i class="fas fa-users"></i> ${escapeHtml(club.name)}`;
            el.onclick = () => {
                switchChannel(`club_${doc.id}`, club.name);
                closeSidebarMobile();
            };

            clubsContainer.appendChild(el);
        });
    }, (error) => {
        console.error("Error loading clubs:", error);
        clubsContainer.innerHTML = '<div style="color:red; padding:1rem;">Error loading clubs</div>';
    });
}

function switchChannel(channelId, channelName) {
    if (currentChannel === channelId) return;

    currentChannel = channelId;
    currentClubName = channelName;

    // Update Sidebar Active State
    const globalBtn = document.getElementById('globalChatBtn');
    if (globalBtn) {
        if (channelId === 'global') globalBtn.classList.add('active');
        else globalBtn.classList.remove('active');
    }

    // Update dynamically created list items
    const items = document.querySelectorAll('#clubsListContainer .channel-item');
    items.forEach(item => {
        // This is a bit tricky since we rebuild list on snapshot, but clicking on it means it exists.
        // For simplicity, we just toggle based on text content matching or re-rendering handles it if we store ID data.
        // Simpler: Just allow the re-render or manual toggle.
        // Let's manually toggle for immediate feedback
        if (item.textContent.includes(channelName)) item.classList.add('active');
        else item.classList.remove('active');
    });

    const mobileTitle = document.getElementById('currentChannelTitle');
    if (mobileTitle) mobileTitle.textContent = channelName;

    subscribeToMessages();
}

function subscribeToMessages() {
    if (unsubscribeMessages) {
        unsubscribeMessages();
        unsubscribeMessages = null;
    }

    const container = document.getElementById('messagesList');
    container.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-secondary);">Loading messages...</div>';

    try {
        const messagesRef = collection(db, 'messages');
        const q = query(messagesRef, where('channel', '==', currentChannel), orderBy('timestamp', 'desc'), limit(50));

        unsubscribeMessages = onSnapshot(q, (snapshot) => {
            container.innerHTML = '';
            if (snapshot.empty) {
                container.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-secondary);">No messages here yet. Say hi!</div>';
                return;
            }

            const messages = [];
            snapshot.forEach((doc) => {
                messages.push({ id: doc.id, ...doc.data() });
            });
            messages.reverse();

            messages.forEach(msg => displayMessage(msg));
            scrollToBottom();
        }, (error) => {
            console.error("Chat error:", error);
            container.innerHTML = `<div style="text-align:center; color:red;">Error loading chat.</div>`;
        });
    } catch (error) {
        console.error("Setup error:", error);
    }
}

function displayMessage(data) {
    const container = document.getElementById('messagesList');
    const msgDiv = document.createElement('div');

    const isSelf = currentUser && data.userId === currentUser.uid;
    msgDiv.className = isSelf ? 'message self' : 'message';

    const contentHtml = data.isSpoiler
        ? `<span class="spoiler-content" onclick="this.classList.toggle('revealed')">${escapeHtml(data.text)}</span> <i class="fas fa-exclamation-triangle" style="font-size:0.7rem; color:#ef4444; margin-left:5px;"></i>`
        : escapeHtml(data.text);

    const timeStr = data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...';

    msgDiv.innerHTML = `
        <div class="message-meta">
            <span style="font-weight:600; color: ${isSelf ? '#fff' : 'var(--primary-color)'}">${escapeHtml(data.username || 'Anon')}</span> 
            <span>${timeStr}</span>
        </div>
        ${contentHtml}
    `;

    container.appendChild(msgDiv);
}

function scrollToBottom() {
    const container = document.getElementById('messagesList');
    container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
    if (!text) return text;
    return text.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function sendMessage() {
    const input = document.getElementById('msgInput');
    const text = input.value.trim();
    if (!text) return;

    if (!currentUser) {
        alert("Please log in to chat.");
        return;
    }

    try {
        await addDoc(collection(db, 'messages'), {
            userId: currentUser.uid,
            username: currentUser.displayName || currentUser.email.split('@')[0],
            text: text,
            isSpoiler: isSpoilerMode,
            timestamp: serverTimestamp(),
            channel: currentChannel
        });

        input.value = '';
        if (isSpoilerMode) document.getElementById('spoilerToggle').click();

    } catch (error) {
        console.error("Send error:", error);
        alert("Start a conversation!");
    }
}
