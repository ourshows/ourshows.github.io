// ====== Firebase Modular ======
// firebase-config.js (loaded before this file) initializes modular Firebase
// and exposes `window.dbMod` (modular DB) and `window.authMod` (modular Auth).
import { ref, push, onChildAdded, onValue, set, remove, onDisconnect } 
  from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';

const db = window.dbMod;
let typingDb = null; // will be set after DOM is ready

console.log('community.js loaded. window.dbMod =', window.dbMod);

// ====== DOM Elements ======
const chatBox = document.getElementById("chat-box");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const nameModal = document.getElementById("name-modal");
const nameInput = document.getElementById("name-input");
const saveNameBtn = document.getElementById("save-name");

let username = localStorage.getItem("ourshow_username");

// ====== Ask for Name ======
if (!username) {
  nameModal.classList.remove("hidden");
  saveNameBtn.addEventListener("click", () => {
    const name = nameInput.value.trim();
    username = name || "Anonymous";
    localStorage.setItem("ourshow_username", username);
    nameModal.classList.add("hidden");
  });
}

// ====== Send Message ======
sendBtn.addEventListener("click", sendMessage);
messageInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});

function sendMessage() {
  const text = messageInput.value.trim();
  if (text === "") return;

  const message = {
    name: username || "Anonymous",
    text,
    timestamp: Date.now()
  };

  if (!db) {
    alert('Chat unavailable: Firebase not configured.');
    return;
  }

  push(ref(db, 'globalChat'), message);
    console.log('Message sent:', message);
  messageInput.value = "";
  stopTyping();
}

// ====== Display Messages ======
if (db) {
    console.log('Setting up realtime listener for globalChat');
  onChildAdded(ref(db, 'globalChat'), (snapshot) => {
    const msg = snapshot.val();
      console.log('New message received:', msg);
    displayMessage(msg);
  });
} else {
  // show an unobtrusive notice in the chat UI
  if (chatBox) {
    const notice = document.createElement('p');
    notice.className = 'text-gray-400 text-sm italic';
    notice.textContent = 'Chat unavailable (no Firebase).';
    chatBox.appendChild(notice);
  }
}

function displayMessage(msg) {
  const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const msgDiv = document.createElement("div");

  // Different color for your own messages
  const isOwn = msg.name === username;
  msgDiv.className = `p-3 rounded-md ${
    isOwn ? "bg-red-700 text-white self-end ml-auto" : "bg-gray-700 text-white"
  }`;

  msgDiv.innerHTML = `
    <p class="text-sm mb-1">
      <span class="font-semibold ${isOwn ? "text-white" : "text-red-400"}">${msg.name}</span>
      <span class="text-gray-400 text-xs ml-2">${time}</span>
    </p>
    <p class="text-sm">${msg.text}</p>
  `;
  chatBox.appendChild(msgDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// ====== Typing Indicator ======
const typingIndicator = document.createElement("p");
typingIndicator.className = "text-gray-400 text-sm mt-2 italic hidden";
typingIndicator.id = "typing-indicator";
chatBox.parentElement.appendChild(typingIndicator);

let typingTimeout;

messageInput.addEventListener("input", () => {
  setTypingStatus(true);
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => setTypingStatus(false), 3000);
});

function setTypingStatus(isTyping) {
  if (!username || !db) return;
  const userTypingRef = ref(db, `typing/${username}`);
  if (isTyping) {
    set(userTypingRef, true);
    onDisconnect(userTypingRef).remove();
  } else {
    remove(userTypingRef);
  }
}

function stopTyping() {
  setTypingStatus(false);
}

if (db) {
  onValue(ref(db, 'typing'), (snapshot) => {
    const typingUsers = snapshot.val();
    if (typingUsers) {
      const activeUsers = Object.keys(typingUsers).filter(u => u !== username);
      if (activeUsers.length > 0) {
        typingIndicator.textContent = `💬 ${activeUsers.join(", ")} ${activeUsers.length === 1 ? "is" : "are"} typing...`;
        typingIndicator.classList.remove("hidden");
      } else {
        typingIndicator.classList.add("hidden");
      }
    } else {
      typingIndicator.classList.add("hidden");
    }
  });
}
