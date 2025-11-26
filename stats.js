// Stats Page with Firebase Integration
import { auth, db, onAuthStateChanged, collection, getDocs } from './firebase-config.js';

let currentUser = null;
let watchedMovies = [];

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await loadWatchedMovies(user.uid);
        calculateStats();
    } else {
        window.location.href = 'login.html';
    }
});

async function loadWatchedMovies(userId) {
    try {
        const watchedRef = collection(db, 'users', userId, 'watched');
        const querySnapshot = await getDocs(watchedRef);

        watchedMovies = [];
        querySnapshot.forEach((doc) => {
            watchedMovies.push(doc.data());
        });

        console.log('Loaded watched movies:', watchedMovies.length);
    } catch (error) {
        console.error('Error loading watched movies:', error);
    }
}

function calculateStats() {
    const totalMovies = watchedMovies.length;

    // Calculate total watch time (assuming average 120 min per movie)
    const avgMovieLength = 120; // minutes
    const totalMinutes = totalMovies * avgMovieLength;
    const totalHours = Math.floor(totalMinutes / 60);

    // Calculate average rating
    let totalRating = 0;
    let ratedCount = 0;
    watchedMovies.forEach(movie => {
        if (movie.rating) {
            totalRating += movie.rating;
            ratedCount++;
        }
    });
    const avgRating = ratedCount > 0 ? (totalRating / ratedCount).toFixed(1) : 'N/A';

    // Find favorite genre (would need genre data from TMDB)
    const favoriteGenre = 'Action'; // Placeholder

    // Calculate streak (days watched consecutively)
    const streak = calculateStreak();

    // Update UI
    updateStatsUI({
        totalMovies,
        totalHours,
        avgRating,
        favoriteGenre,
        streak
    });

    // Calculate badges
    updateBadges(totalMovies, totalHours);
}

function calculateStreak() {
    if (watchedMovies.length === 0) return 0;

    // Sort by timestamp
    const sorted = watchedMovies
        .filter(m => m.timestamp)
        .sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);

    if (sorted.length === 0) return 0;

    let streak = 1;
    const oneDayMs = 24 * 60 * 60 * 1000;

    for (let i = 0; i < sorted.length - 1; i++) {
        const current = new Date(sorted[i].timestamp.seconds * 1000);
        const next = new Date(sorted[i + 1].timestamp.seconds * 1000);

        const diffDays = Math.floor((current - next) / oneDayMs);

        if (diffDays === 1) {
            streak++;
        } else if (diffDays > 1) {
            break;
        }
    }

    return streak;
}

function updateStatsUI(stats) {
    // Animate numbers
    animateValue('moviesWatched', 0, stats.totalMovies, 1000);
    animateValue('hoursWatched', 0, stats.totalHours, 1000);

    document.getElementById('avgRating').textContent = stats.avgRating;
    document.getElementById('favoriteGenre').textContent = stats.favoriteGenre;
    document.getElementById('currentStreak').textContent = `${stats.streak} days`;

    // Update progress bars
    updateProgressBar('watchGoal', stats.totalMovies, 100);
    updateProgressBar('timeGoal', stats.totalHours, 500);
}

function updateProgressBar(id, current, goal) {
    const percentage = Math.min((current / goal) * 100, 100);
    const bar = document.getElementById(id);
    if (bar) {
        bar.style.width = percentage + '%';
        bar.parentElement.querySelector('.goal-text').textContent = `${current} / ${goal}`;
    }
}

function animateValue(id, start, end, duration) {
    const element = document.getElementById(id);
    if (!element) return;

    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;

    const timer = setInterval(() => {
        current += increment;
        if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
            current = end;
            clearInterval(timer);
        }
        element.textContent = Math.floor(current);
    }, 16);
}

function updateBadges(totalMovies, totalHours) {
    const badges = [
        { id: 'badge1', name: 'First Watch', desc: 'Watched your first movie', unlocked: totalMovies >= 1 },
        { id: 'badge2', name: 'Movie Buff', desc: 'Watched 10 movies', unlocked: totalMovies >= 10 },
        { id: 'badge3', name: 'Cinephile', desc: 'Watched 50 movies', unlocked: totalMovies >= 50 },
        { id: 'badge4', name: 'Marathon Runner', desc: 'Watched 100 hours', unlocked: totalHours >= 100 },
        { id: 'badge5', name: 'Binge Master', desc: 'Watched 5 movies in a day', unlocked: false }, // Would need daily tracking
        { id: 'badge6', name: 'Genre Explorer', desc: 'Watched 5 different genres', unlocked: false }
    ];

    const badgesContainer = document.getElementById('badgesContainer');
    if (!badgesContainer) return;

    badgesContainer.innerHTML = '';

    badges.forEach(badge => {
        const badgeEl = document.createElement('div');
        badgeEl.className = 'badge-item glass-panel';
        badgeEl.style.opacity = badge.unlocked ? '1' : '0.4';
        badgeEl.style.padding = '1.5rem';
        badgeEl.style.textAlign = 'center';
        badgeEl.style.borderRadius = '12px';

        badgeEl.innerHTML = `
            <div style="font-size: 3rem; margin-bottom: 0.5rem;">
                ${badge.unlocked ? '🏆' : '🔒'}
            </div>
            <h4>${badge.name}</h4>
            <p style="font-size: 0.85rem; color: var(--text-secondary);">${badge.desc}</p>
        `;

        badgesContainer.appendChild(badgeEl);
    });
}

// Expose functions
window.animateValue = animateValue;
