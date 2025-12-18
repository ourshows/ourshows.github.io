
// Community Chat with Firebase Integration & Clubs
import { auth, db, onAuthStateChanged, collection, addDoc, doc, updateDoc, deleteDoc, getDoc, setDoc, query, orderBy, limit, getDocs, serverTimestamp, where, onSnapshot } from './firebase-wrapper.js';

let isSpoilerMode = false;
let currentUser = null;
let chatUsername = null; // Display name for chat
let currentChannel = 'global'; // 'global' or 'club_{clubId}'
let currentClubName = 'Global Chat';
let unsubscribeMessages = null;
let unsubscribeClubs = null;

// Listen for auth state
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        // Enforce Username Check
        await checkChatUsername(user.uid);
        subscribeToClubs();
        subscribeToMessages();
    } else {
        // Enforce Login
        window.location.href = 'login.html';
    }
    if (window.ourShowLoader) window.ourShowLoader.hide();
});

async function checkChatUsername(uid) {
    try {
        const userDocRef = doc(db, 'users', uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists() && userDoc.data().chatUsername) {
            chatUsername = userDoc.data().chatUsername;
        } else {
            // Show Modal to set username
            document.getElementById('usernameModal').style.display = 'block';
        }
    } catch (e) {
        console.error("Error checking username:", e);
        // Fallback or retry logic could go here
    }
}

async function saveChatUsername() {
    const input = document.getElementById('chatUsernameInput');
    const name = input.value.trim();

    if (!name) {
        alert("Please enter a username.");
        return;
    }

    if (name.length < 3) {
        alert("Username must be at least 3 characters.");
        return;
    }

    try {
        await setDoc(doc(db, 'users', currentUser.uid), {
            chatUsername: name
        }, { merge: true });

        chatUsername = name;
        document.getElementById('usernameModal').style.display = 'none';
        alert("Welcome, " + name + "!");
    } catch (e) {
        console.error("Error saving username:", e);
        alert("Failed to save username.");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.ourShowLoader) window.ourShowLoader.show();
    const input = document.getElementById('msgInput');
    const sendBtn = document.getElementById('sendBtn');
    const spoilerBtn = document.getElementById('spoilerToggle');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const sidebar = document.getElementById('sidebar');

    // UI & Modal Elements
    const saveUsernameBtn = document.getElementById('saveUsernameBtn');
    if (saveUsernameBtn) saveUsernameBtn.addEventListener('click', saveChatUsername);

    // Club Modal Elements
    const createClubTrigger = document.getElementById('createClubBtnTrigger');
    const createClubModal = document.getElementById('createClubModal');
    const closeClubModal = document.getElementById('closeClubModal');
    const confirmCreateClubBtn = document.getElementById('confirmCreateClubBtn');
    const globalChatBtn = document.getElementById('globalChatBtn');

    // Edit Modal Elements
    const editModal = document.getElementById('editMessageModal');
    const closeEditModal = document.getElementById('closeEditModal');
    const confirmEditBtn = document.getElementById('confirmEditBtn');

    if (closeEditModal) closeEditModal.onclick = () => editModal.style.display = 'none';
    if (confirmEditBtn) confirmEditBtn.onclick = confirmEditMessage;
    window.onclick = (event) => {
        if (event.target == editModal) editModal.style.display = 'none';
        if (event.target == createClubModal) createClubModal.style.display = 'none';
    }


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
            createClubModal.style.display = 'block';
        });
    }

    if (closeClubModal) {
        closeClubModal.addEventListener('click', () => {
            createClubModal.style.display = 'none';
        });
    }

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

    const items = document.querySelectorAll('#clubsListContainer .channel-item');
    items.forEach(item => {
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

    // Add (Edited) label if edited
    const editedLabel = data.edited ? `<span style="font-size:0.6rem; opacity:0.6; margin-left:5px;">(edited)</span>` : '';

    const timeStr = data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...';

    // Action buttons for self messages
    let actionsHtml = '';
    if (isSelf) {
        actionsHtml = `
            <div class="message-actions" style="margin-top:0.5rem; display:flex; gap:0.5rem; justify-content:flex-end; opacity:0.8;">
                <button class="icon-btn-small" onclick="document.dispatchEvent(new CustomEvent('editMessage', { detail: { id: '${data.id}', text: '${escapeHtml(data.text).replace(/'/g, "\\'")}' } }))" title="Edit">
                    <i class="fas fa-edit" style="font-size:0.8rem;"></i>
                </button>
                <button class="icon-btn-small" onclick="document.dispatchEvent(new CustomEvent('deleteMessage', { detail: { id: '${data.id}' } }))" title="Unsend">
                    <i class="fas fa-trash" style="font-size:0.8rem;"></i>
                </button>
            </div>
        `;
    }

    msgDiv.innerHTML = `
        <div class="message-meta">
            <span style="font-weight:600; color: ${isSelf ? '#fff' : 'var(--primary-color)'}">${escapeHtml(data.username)}</span> 
            <span>${timeStr} ${editedLabel}</span>
        </div>
        ${contentHtml}
        ${actionsHtml}
    `;

    container.appendChild(msgDiv);
}

// Global Event Listeners for actions (since inline onclick can't access module functions easily)
document.addEventListener('editMessage', (e) => {
    openEditModal(e.detail.id, e.detail.text);
});

document.addEventListener('deleteMessage', (e) => {
    if (confirm("Unsend this message?")) {
        deleteMessage(e.detail.id);
    }
});

let editingMessageId = null;

function openEditModal(id, text) {
    editingMessageId = id;
    const input = document.getElementById('editMessageInput');
    input.value = text; // Decode html if needed, but assuming simple text for now
    document.getElementById('editMessageModal').style.display = 'block';
}

async function confirmEditMessage() {
    const text = document.getElementById('editMessageInput').value.trim();
    if (!text) return;

    try {
        await updateDoc(doc(db, 'messages', editingMessageId), {
            text: text,
            edited: true
        });
        document.getElementById('editMessageModal').style.display = 'none';
        editingMessageId = null;
    } catch (e) {
        console.error("Edit error:", e);
        alert("Failed to edit message.");
    }
}

async function deleteMessage(id) {
    try {
        await deleteDoc(doc(db, 'messages', id));
    } catch (e) {
        console.error("Delete error:", e);
        alert("Failed to delete message.");
    }
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

    if (!currentUser || !chatUsername) {
        // Retry username check if missing for some reason
        if (currentUser) {
            await checkChatUsername(currentUser.uid);
            if (!chatUsername) return; // Still no username
        } else {
            alert("Please log in.");
            window.location.href = 'login.html';
            return;
        }
    }

    try {
        await addDoc(collection(db, 'messages'), {
            userId: currentUser.uid,
            username: chatUsername, // Use the custom username
            text: text,
            isSpoiler: isSpoilerMode,
            timestamp: serverTimestamp(),
            channel: currentChannel,
            edited: false
        });

        input.value = '';
        if (isSpoilerMode) document.getElementById('spoilerToggle').click();

    } catch (error) {
        console.error("Send error:", error);
        alert("Failed to send. Try again.");
    }
}
