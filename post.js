// Social Feed with Firebase Integration
import { auth, db, onAuthStateChanged, collection, addDoc, query, orderBy, limit, getDocs, serverTimestamp } from './firebase-config.js';

let currentUser = null;

// Listen for auth state
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        loadPosts();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    loadPosts();
});

async function loadPosts() {
    try {
        const q = query(collection(db, 'posts'), orderBy('timestamp', 'desc'), limit(20));
        const querySnapshot = await getDocs(q);

        const container = document.getElementById('feedContainer');
        // Keep the first post form, clear the rest
        const firstChild = container.firstElementChild;
        container.innerHTML = '';
        if (firstChild && firstChild.classList.contains('glass-panel')) {
            container.appendChild(firstChild);
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            displayPost(data);
        });
    } catch (error) {
        console.error('Error loading posts:', error);
    }
}

function displayPost(data) {
    const container = document.getElementById('feedContainer');
    const postDiv = document.createElement('div');
    postDiv.className = 'glass-panel';
    postDiv.style.marginTop = '2rem';

    const timeStr = data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleString() : 'Just now';

    postDiv.innerHTML = `
        <div style="display: flex; align-items: center; margin-bottom: 1rem;">
            <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--primary-color); display: flex; align-items: center; justify-content: center; margin-right: 1rem;">
                <i class="fas fa-user"></i>
            </div>
            <div>
                <div style="font-weight: 600;">${data.username || 'Anonymous'}</div>
                <div style="font-size: 0.8rem; color: var(--text-secondary);">${timeStr}</div>
            </div>
        </div>
        <p style="line-height: 1.6;">${data.content}</p>
        ${data.movieTitle ? `<div style="margin-top: 1rem; padding: 1rem; background: rgba(0,0,0,0.3); border-radius: 8px;">
            <i class="fas fa-film"></i> About: <strong>${data.movieTitle}</strong>
        </div>` : ''}
        <div style="margin-top: 1rem; display: flex; gap: 1rem; color: var(--text-secondary); font-size: 0.9rem;">
            <span><i class="fas fa-heart"></i> 0</span>
            <span><i class="fas fa-comment"></i> 0</span>
        </div>
    `;

    container.appendChild(postDiv);
}

async function submitPost() {
    const textarea = document.getElementById('postContent');
    const content = textarea.value.trim();

    if (!content) {
        alert('Please write something!');
        return;
    }

    if (!currentUser) {
        alert('Please log in to post!');
        window.location.href = 'login.html';
        return;
    }

    try {
        const postData = {
            userId: currentUser.uid,
            username: currentUser.displayName || currentUser.email,
            content: content,
            timestamp: serverTimestamp()
        };

        await addDoc(collection(db, 'posts'), postData);

        // Display immediately (optimistic UI)
        displayPost({
            ...postData,
            timestamp: { seconds: Date.now() / 1000 }
        });

        textarea.value = '';
        alert('Post published!');
    } catch (error) {
        console.error('Error submitting post:', error);
        alert('Failed to publish post. Please try again.');
    }
}

// Expose to global scope
window.submitPost = submitPost;
