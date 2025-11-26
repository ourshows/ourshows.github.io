// Stats Page with Firebase Integration
import { auth, db, onAuthStateChanged, collection, getDocs } from './firebase-config.js';

let currentUser = null;
let watchedItems = [];

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await loadWatchedItems(user.uid);
    } else {
        console.log('No user, showing default stats');
        updateStatsUI({ totalMovies: 0, totalSeries: 0, totalHours: 0, streak: 0 });
    }
});

async function loadWatchedItems(userId) {
    try {
        const watchedRef = collection(db, 'users', userId, 'watched');
        const querySnapshot = await getDocs(watchedRef);

        watchedItems = [];
        querySnapshot.forEach((doc) => {
            watchedItems.push(doc.data());
        });

        console.log('Loaded watched items:', watchedItems.length);
        await calculateStats();
    } catch (error) {
        console.error('Error loading watched items:', error);
    }
}

async function fetchTMDBDetails(id, type) {
    if (!window.APP_CONFIG) return null;

    const url = `${window.APP_CONFIG.TMDB_BASE_URL}/${type}/${id}?api_key=${window.APP_CONFIG.TMDB_API_KEY}`;
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        console.error('Error fetching TMDB details:', e);
        return null;
    }
}

async function calculateStats() {
    let totalMovies = 0;
    let totalSeries = 0;
    let totalMinutes = 0;

    // Process items in parallel batches to speed up
    const promises = watchedItems.map(async (item) => {
        // Default to movie if mediaType is missing, or try to infer
        let type = item.mediaType || 'movie';

        // Fetch details to get runtime
        const details = await fetchTMDBDetails(item.movieId, type);

        if (details) {
            if (type === 'movie') {
                totalMovies++;
                totalMinutes += details.runtime || 0;
            } else if (type === 'tv') {
                totalSeries++;
                // For TV, estimate based on episode run time * number of episodes, 
                // or just use episode_run_time array average if available.
                const avgRuntime = (details.episode_run_time && details.episode_run_time.length > 0)
                    ? details.episode_run_time[0]
                    : 45; // Default 45 min

                const episodes = details.number_of_episodes || 1;
                totalMinutes += avgRuntime * episodes;
            }
        } else {
            // Fallback if fetch fails
            if (type === 'movie') {
                totalMovies++;
                totalMinutes += 120;
            } else {
                totalSeries++;
                totalMinutes += 450; // Approx 10 eps * 45 min
            }
        }
    });

    await Promise.all(promises);

    const totalHours = Math.floor(totalMinutes / 60);
    const streak = calculateStreak();

    updateStatsUI({
        totalMovies,
        totalSeries,
        totalHours,
        streak
    });

    updateBadges(totalMovies, totalSeries, totalHours, streak);
}

function calculateStreak() {
    if (watchedItems.length === 0) return 0;

    const sorted = watchedItems
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
    animateValue('moviesCount', 0, stats.totalMovies, 1000);
    animateValue('seriesCount', 0, stats.totalSeries, 1000);
    animateValue('totalHours', 0, stats.totalHours, 1000);
    animateValue('streakDays', 0, stats.streak, 1000);
}

function animateValue(id, start, end, duration) {
    const element = document.getElementById(id);
    if (!element) return;

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

function updateBadges(totalMovies, totalSeries, totalHours, streak) {
    const badges = [
        {
            name: 'First Watch',
            icon: 'fa-play',
            desc: 'Watched your first item',
            unlocked: (totalMovies + totalSeries) >= 1
        },
        {
            name: 'Movie Buff',
            icon: 'fa-film',
            desc: 'Watched 10 movies',
            unlocked: totalMovies >= 10
        },
        {
            name: 'Series Binger',
            icon: 'fa-tv',
            desc: 'Watched 5 series',
            unlocked: totalSeries >= 5
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
