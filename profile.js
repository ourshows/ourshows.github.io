// Profile Page - Simple and Working
import { auth, db, onAuthStateChanged, collection, getDocs } from './firebase-wrapper.js';

let currentUser = null;

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
    console.log('Profile page loaded, waiting for auth...');
});

// Auth state listener
onAuthStateChanged(auth, (user) => {
    console.log('Auth state changed:', user);

    if (user) {
        currentUser = user;
        displayUserInfo(user);
        loadUserData(user);
    } else {
        console.log('No user, redirecting to login');
        window.location.href = 'login.html';
    }
});

function displayUserInfo(user) {
    console.log('Displaying user info for:', user.email);

    // Set username
    const displayName = user.displayName || user.email.split('@')[0];
    document.getElementById('userName').textContent = displayName;
    document.getElementById('userEmail').textContent = user.email;

    // Set profile picture
    const profilePic = document.getElementById('profilePic');
    if (user.photoURL) {
        profilePic.src = user.photoURL;
        console.log('Using Google photo');
    } else {
        profilePic.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&size=200&background=6366f1&color=fff`;
    }
}

async function loadUserData(user) {
    console.log('Loading user data...');

    try {
        // Load watchlist
        const watchlistRef = collection(db, 'users', user.uid, 'watchlist');
        const watchlistSnap = await getDocs(watchlistRef);
        document.getElementById('watchlistCount').textContent = watchlistSnap.size;

        const watchlistGrid = document.getElementById('watchlistGrid');
        watchlistGrid.innerHTML = '';

        if (watchlistSnap.empty) {
            watchlistGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">No movies in watchlist. Add some from homepage!</p>';
        } else {
            watchlistSnap.forEach(doc => {
                const data = doc.data();
                watchlistGrid.appendChild(createMovieCard(data));
            });
        }

        // Load watched
        const watchedRef = collection(db, 'users', user.uid, 'watched');
        const watchedSnap = await getDocs(watchedRef);
        document.getElementById('watchedCount').textContent = watchedSnap.size;

        const watchedGrid = document.getElementById('watchedGrid');
        watchedGrid.innerHTML = '';

        if (watchedSnap.empty) {
            watchedGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">No watched movies yet!</p>';
        } else {
            watchedSnap.forEach(doc => {
                const data = doc.data();
                watchedGrid.appendChild(createMovieCard(data));
            });
        }

        // Load reviews
        const reviewsSnap = await getDocs(collection(db, 'reviews'));
        let reviewCount = 0;
        const reviewsGrid = document.getElementById('reviewsGrid');
        reviewsGrid.innerHTML = '';

        reviewsSnap.forEach(doc => {
            const data = doc.data();
            if (data.userId === user.uid) {
                reviewCount++;
                reviewsGrid.appendChild(createReviewCard(data));
            }
        });

        document.getElementById('reviewsCount').textContent = reviewCount;

        if (reviewCount === 0) {
            reviewsGrid.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No reviews yet!</p>';
        }

    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

function createMovieCard(data) {
    const card = document.createElement('div');
    card.className = 'movie-card';
    card.innerHTML = `
        <img src="https://image.tmdb.org/t/p/w500${data.posterPath}" alt="${data.movieTitle}" style="width: 100%; border-radius: 12px;">
        <div style="margin-top: 0.5rem;">
            <div style="font-weight: 600; font-size: 0.9rem;">${data.movieTitle}</div>
            <div style="color: #ffd700;">★ ${data.rating ? data.rating.toFixed(1) : 'N/A'}</div>
        </div>
    `;
    card.onclick = () => window.location.href = `watchanddownload.html?id=${data.movieId}&type=movie`;
    return card;
}

function createReviewCard(data) {
    const card = document.createElement('div');
    card.className = 'glass-panel';
    card.style.padding = '1.5rem';
    card.style.marginBottom = '1rem';

    const ratingText = ['Bad', 'One-Time Watch', 'Good', 'Must Watch', 'Perfection'][data.rating - 1];

    card.innerHTML = `
        <h4>${data.movieTitle}</h4>
        <div style="color: #ffd700; margin: 0.5rem 0;">
            ${'★'.repeat(data.rating)}${'☆'.repeat(5 - data.rating)} ${ratingText}
        </div>
        <p style="color: var(--text-secondary); line-height: 1.6;">${data.review}</p>
    `;
    return card;
}

// Tab switching
function switchTab(tabName) {
    document.querySelectorAll('.tab-pane').forEach(pane => pane.style.display = 'none');
    document.querySelectorAll('.tab-link').forEach(link => link.classList.remove('active'));

    document.getElementById(tabName).style.display = 'block';
    event.target.classList.add('active');
}

// Edit profile
function enableEdit() {
    document.getElementById('editBtn').style.display = 'none';
    document.getElementById('saveBtn').style.display = 'inline-block';
    document.getElementById('cancelBtn').style.display = 'inline-block';

    const userName = document.getElementById('userName');
    const currentName = userName.textContent;
    userName.innerHTML = `<input type="text" id="nameInput" class="glass-input" value="${currentName}" style="max-width: 300px;">`;
}

function cancelEdit() {
    location.reload();
}

async function saveProfile() {
    const user = auth.currentUser;
    if (!user) {
        alert('Not logged in!');
        return;
    }

    const newName = document.getElementById('nameInput').value.trim();
    if (!newName) {
        alert('Name cannot be empty!');
        return;
    }

    try {
        await user.updateProfile({ displayName: newName });
        alert('Profile updated!');
        location.reload();
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to update profile');
    }
}

async function logout() {
    if (confirm('Logout?')) {
        await auth.signOut();
        window.location.href = 'login.html';
    }
}

// Expose to window
window.switchTab = switchTab;
window.enableEdit = enableEdit;
window.saveProfile = saveProfile;
window.cancelEdit = cancelEdit;
window.logout = logout;
