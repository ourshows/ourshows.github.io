// Mock Chat Logic - In production, this would use Firebase Firestore

let isSpoilerMode = false;

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
});

function sendMessage() {
    const input = document.getElementById('msgInput');
    const text = input.value.trim();
    if (!text) return;

    const container = document.getElementById('messagesList');

    // Create Message Element
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message self';

    const contentHtml = isSpoilerMode
        ? `<span class="spoiler-content" onclick="this.classList.toggle('revealed')">${text}</span> <i class="fas fa-exclamation-triangle" style="font-size:0.7rem; color:#ef4444;"></i>`
        : text;

    msgDiv.innerHTML = `
        <div class="message-meta"><span>Me</span> <span>Just now</span></div>
        ${contentHtml}
    `;

    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight; // Auto scroll

    input.value = '';

    // Reset spoiler mode after sending
    if (isSpoilerMode) {
        document.getElementById('spoilerToggle').click();
    }
}
