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
        console.log('No user, showing default stats');
        calculateStats(); // Show 0 stats
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

    // Calculate streak
    const streak = calculateStreak();

    // Update UI with correct IDs from HTML
    updateStatsUI({
        totalMovies,
        totalHours,
        streak
    });

    // Update Badges
    updateBadges(totalMovies, totalHours, streak);
}

function calculateStreak() {
    if (watchedMovies.length === 0) return 0;

    const sorted = watchedMovies
        .filter(m => m.timestamp)
        .sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);

    if (sorted.length === 0) return 0;

    let streak = 1;
    const oneDayMs = 24 * 60 * 60 * 1000;

    for (let i = 0; i < sorted.length - 1; i++) {
        const currentDate = new Date(sorted[i].timestamp.seconds * 1000);
        const nextDate = new Date(sorted[i + 1].timestamp.seconds * 1000);

        const diffDays = Math.floor((currentDate - nextDate) / oneDayMs);

        if (diffDays === 1) {
            streak++;
        } else if (diffDays > 1) {
            break;
        }
    }

    return streak;
}

function updateStatsUI(stats) {
    // Animate numbers - using IDs from stats.html
    animateValue('moviesCount', 0, stats.totalMovies, 1000);
    animateValue('totalHours', 0, stats.totalHours, 1000);
    animateValue('streakDays', 0, stats.streak, 1000);

    console.log('Stats updated:', stats);
}

function animateValue(id, start, end, duration) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn('Element not found:', id);
        return;
    }

    const range = end - start;
    const increment = range / (duration / 16);
    let currentValue = start;

    const timer = setInterval(() => {
        currentValue += increment;
        if ((increment > 0 && currentValue >= end) || (increment < 0 && currentValue <= end)) {
            currentValue = end;
            clearInterval(timer);
        }
        element.textContent = Math.floor(currentValue);
    }, 16);
}

function updateBadges(totalMovies, totalHours, streak) {
    // Define badges logic
    const badges = [
        {
            name: 'First Watch',
            icon: 'fa-play',
            desc: 'Watched your first movie',
            unlocked: totalMovies >= 1
        },
        {
            name: 'Movie Buff',
            icon: 'fa-film',
            desc: 'Watched 10 movies',
            unlocked: totalMovies >= 10
        },
        {
            name: 'Cinephile',
            icon: 'fa-video',
            desc: 'Watched 50 movies',
            unlocked: totalMovies >= 50
        },
        {
            name: 'Marathon Runner',
            icon: 'fa-running',
            desc: 'Watched 100 hours',
            unlocked: totalHours >= 100
        },
        {
            name: 'Streak Master',
            icon: 'fa-fire',
            desc: '3 day watch streak',
            unlocked: streak >= 3
        }
    ];

    // Find the container - in stats.html it is class "badges-grid"
    const badgesContainer = document.querySelector('.badges-grid');
    if (!badgesContainer) return;

    badgesContainer.innerHTML = '';

    badges.forEach(badge => {
        const badgeEl = document.createElement('div');
        badgeEl.className = `badge ${badge.unlocked ? '' : 'locked'}`;
        badgeEl.title = `${badge.desc} (${badge.unlocked ? 'Unlocked' : 'Locked'})`;

        badgeEl.innerHTML = `
            <i class="fas ${badge.icon}"></i>
            <span>${badge.name}</span>
        `;

        badgesContainer.appendChild(badgeEl);
    });
}
