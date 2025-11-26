// Community Chat with Firebase Integration
import { auth, db, onAuthStateChanged, collection, addDoc, query, orderBy, limit, getDocs, serverTimestamp } from './firebase-config.js';

let isSpoilerMode = false;
let currentUser = null;

// Listen for auth state
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        loadMessages();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('msgInput');
    const spoilerBtn = document.getElementById('spoilerToggle');

    // Toggle Spoiler Mode
    spoilerBtn.addEventListener('click', () => {
        isSpoilerMode = !isSpoilerMode;
        spoilerBtn.classList.toggle('active');
        input.placeholder = isSpoilerMode ? "Type a spoiler message..." : "Type a message...";
    });

    // Send on Enter
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // Load initial messages
    loadMessages();
});

async function loadMessages() {
    try {
        const q = query(collection(db, 'messages'), orderBy('timestamp', 'desc'), limit(50));
        const querySnapshot = await getDocs(q);

        const container = document.getElementById('messagesList');
        container.innerHTML = '';

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            displayMessage(data);
        });

        container.scrollTop = container.scrollHeight;
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

function displayMessage(data) {
    const container = document.getElementById('messagesList');
    const msgDiv = document.createElement('div');
    msgDiv.className = currentUser && data.userId === currentUser.uid ? 'message self' : 'message';

    const contentHtml = data.isSpoiler
        ? `<span class="spoiler-content" onclick="this.classList.toggle('revealed')">${data.text}</span> <i class="fas fa-exclamation-triangle" style="font-size:0.7rem; color:#ef4444;"></i>`
        : data.text;

    const timeStr = data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleTimeString() : 'Just now';

    msgDiv.innerHTML = `
        <div class="message-meta"><span>${data.username || 'Anonymous'}</span> <span>${timeStr}</span></div>
        ${contentHtml}
    `;

    container.appendChild(msgDiv);
}

async function sendMessage() {
    const input = document.getElementById('msgInput');
    const text = input.value.trim();
    if (!text) return;

    if (!currentUser) {
        alert('Please log in to send messages!');
        window.location.href = 'login.html';
        return;
    }

    try {
        const messageData = {
            userId: currentUser.uid,
            username: currentUser.displayName || currentUser.email,
            text: text,
            isSpoiler: isSpoilerMode,
            timestamp: serverTimestamp()
        };

        await addDoc(collection(db, 'messages'), messageData);

        // Display immediately (optimistic UI)
        displayMessage({
            ...messageData,
            timestamp: { seconds: Date.now() / 1000 }
        });

        input.value = '';

        // Reset spoiler mode after sending
        if (isSpoilerMode) {
            document.getElementById('spoilerToggle').click();
        }

        const container = document.getElementById('messagesList');
        container.scrollTop = container.scrollHeight;
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
    }
}

// Expose to global scope
window.sendMessage = sendMessage;
