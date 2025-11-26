
async function loadStats(userId) {
    try {
        // Count watchlist items
        const watchlistSnap = await getDocs(collection(db, 'users', userId, 'watchlist'));
        document.getElementById('watchlistCount').textContent = watchlistSnap.size;

        // Count watched items
        const watchedSnap = await getDocs(collection(db, 'users', userId, 'watched'));
        document.getElementById('watchedCount').textContent = watchedSnap.size;

        // Count reviews
        const reviewsSnap = await getDocs(query(collection(db, 'reviews')));
        let userReviewsCount = 0;
        reviewsSnap.forEach(doc => {
            if (doc.data().userId === userId) userReviewsCount++;
        });
        document.getElementById('reviewsCount').textContent = userReviewsCount;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadWatchlist() {
    if (!currentUser) {
        console.log('No current user for watchlist');
        return;
    }

    console.log('Loading watchlist for user:', currentUser.uid);

    try {
        const watchlistRef = collection(db, 'users', currentUser.uid, 'watchlist');
        const querySnapshot = await getDocs(watchlistRef);

        console.log('Watchlist query result:', querySnapshot.size, 'items');

        const container = document.getElementById('watchlistGrid');
        container.innerHTML = '';

        if (querySnapshot.empty) {
            container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">No movies in watchlist yet. Add some from the homepage!</p>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            console.log('Watchlist item:', data);
            const card = createMovieCard(data);
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading watchlist:', error);
        const container = document.getElementById('watchlistGrid');
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #ef4444;">Error loading watchlist. Check console.</p>';
    }
}

async function loadWatched() {
    if (!currentUser) {
        console.log('No current user for watched');
        return;
    }

    console.log('Loading watched for user:', currentUser.uid);

    try {
        const watchedRef = collection(db, 'users', currentUser.uid, 'watched');
        const querySnapshot = await getDocs(watchedRef);

        console.log('Watched query result:', querySnapshot.size, 'items');

        const container = document.getElementById('watchedGrid');
        container.innerHTML = '';

        if (querySnapshot.empty) {
            container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">No watched movies yet. Mark movies as watched!</p>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            console.log('Watched item:', data);
            const card = createMovieCard(data);
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading watched:', error);
        const container = document.getElementById('watchedGrid');
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #ef4444;">Error loading watched. Check console.</p>';
    }
}

async function loadReviews() {
    if (!currentUser) return;

    try {
        const querySnapshot = await getDocs(collection(db, 'reviews'));
        const container = document.getElementById('reviewsGrid');
        container.innerHTML = '';

        let hasReviews = false;
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.userId === currentUser.uid) {
                hasReviews = true;
                const reviewCard = createReviewCard(data);
                container.appendChild(reviewCard);
            }
        });

        if (!hasReviews) {
            container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">No reviews yet.</p>';
        }
    } catch (error) {
        console.error('Error loading reviews:', error);
    }
}

function createMovieCard(data) {
    const card = document.createElement('div');
    card.className = 'movie-card';
    card.innerHTML = `
        <img src="https://image.tmdb.org/t/p/w500${data.posterPath}" alt="${data.movieTitle}">
        <div class="movie-info">
            <h4>${data.movieTitle}</h4>
            <div class="rating">★ ${data.rating ? data.rating.toFixed(1) : 'N/A'}</div>
        </div>
    `;
    card.onclick = () => window.location.href = `watchanddownload.html?id=${data.movieId}&type=movie`;
    return card;
}

function createReviewCard(data) {
    const card = document.createElement('div');
    card.className = 'review-card glass-panel';
    card.style.padding = '1.5rem';
    card.style.marginBottom = '1rem';

    const ratingText = ['Bad', 'One-Time Watch', 'Good', 'Must Watch', 'Perfection'][data.rating - 1];

    card.innerHTML = `
        <h4>${data.movieTitle}</h4>
        <div style="color: #ffd700; margin: 0.5rem 0;">
            ${'★'.repeat(data.rating)}${'☆'.repeat(5 - data.rating)} ${ratingText}
        </div>
        <p style="color: var(--text-secondary); line-height: 1.6;">${data.review}</p>
        <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 1rem;">
            ${data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleDateString() : 'Just now'}
        </div>
    `;
    return card;
}

// Edit Profile Functions
function enableEdit() {
    document.getElementById('editBtn').style.display = 'none';
    document.getElementById('saveBtn').style.display = 'inline-block';
    document.getElementById('cancelBtn').style.display = 'inline-block';

    const userName = document.getElementById('userName');
    const currentName = userName.textContent;
    userName.innerHTML = `<input type="text" id="nameInput" class="glass-input" value="${currentName}" style="max-width: 300px;">`;

    document.getElementById('uploadPicBtn').style.display = 'inline-block';
}

function cancelEdit() {
    location.reload();
}

async function saveProfile() {
    if (!currentUser) return;

    const newName = document.getElementById('nameInput').value.trim();

    if (!newName) {
        alert('Name cannot be empty!');
        return;
    }

    try {
        // Update Firebase Auth profile
        await currentUser.updateProfile({
            displayName: newName
        });

        alert('Profile updated successfully!');
        location.reload();
    } catch (error) {
        console.error('Error updating profile:', error);
        alert('Failed to update profile. Please try again.');
    }
}

function uploadProfilePic() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            // For now, use a placeholder service
            // In production, upload to Firebase Storage
            alert('Profile picture upload will be implemented with Firebase Storage');
        }
    };
    input.click();
}

function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-pane').forEach(pane => pane.style.display = 'none');
    document.querySelectorAll('.tab-link').forEach(link => link.classList.remove('active'));

    // Show selected tab
    document.getElementById(tabName).style.display = 'block';
    event.target.classList.add('active');
}

async function logout() {
    if (confirm('Are you sure you want to logout?')) {
        await auth.signOut();
        window.location.href = 'login.html';
    }
}

// Expose to global scope
window.switchTab = switchTab;
window.enableEdit = enableEdit;
window.saveProfile = saveProfile;
window.cancelEdit = cancelEdit;
window.uploadProfilePic = uploadProfilePic;
window.logout = logout;
