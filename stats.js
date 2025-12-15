// Stats Page with Firebase Integration
import { auth, db, onAuthStateChanged, collection, getDocs } from './firebase-config.js';

let currentUser = null;
let watchedItems = [];

onAuthStateChanged(auth, async (user) => {
    updateAuthUI(user);
    if (user) {
        currentUser = user;
        await loadWatchedItems(user.uid);
    } else {
        console.log('No user, showing default stats');
        document.getElementById('loading').style.display = 'none';
        updateStatsUI({ totalMovies: 0, totalSeries: 0, totalHours: 0, streak: 0 });
    }
});

function updateAuthUI(user) {
    const authBtn = document.getElementById('navAuthBtn');
    if (authBtn) {
        if (user) {
            authBtn.innerHTML = '<i class="fas fa-user"></i> ' + (user.displayName || user.email.split('@')[0]);
            authBtn.href = 'profile.html';
        } else {
            authBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
            authBtn.href = 'login.html';
        }
    }
}

async function loadWatchedItems(userId) {
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'block';

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
    } finally {
        if (loading) loading.style.display = 'none';
    }
}

async function fetchTMDBDetails(id, type) {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (isLocal && window.APP_CONFIG && window.APP_CONFIG.TMDB_API_KEY) {
        const baseUrl = window.APP_CONFIG.TMDB_BASE_URL || "https://api.themoviedb.org/3";
        const url = new URL(`${baseUrl}/${type}/${id}`);
        url.searchParams.append('api_key', window.APP_CONFIG.TMDB_API_KEY);

        try {
            const res = await fetch(url);
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            return null;
        }
    }

    const url = new URL('/api/tmdb', window.location.origin);
    url.searchParams.append('endpoint', `/${type}/${id}`);

    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        // console.error('Error fetching TMDB details:', e);
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
        // Optimization: Use locally stored runtime if we saved it in watched object (to save API calls)
        // If not, fetch.
        let runtime = 0;

        // Assuming we didn't save runtime in the lite object, we try to fetch.
        // NOTE: fetching for *every* watched item might hit rate limits if list is huge.
        // Ideally we should cache or store runtime in Firestore.
        // For now, we will try to fetch but fail gracefully.

        const details = await fetchTMDBDetails(item.movieId, type);

        if (details) {
            if (type === 'movie') {
                totalMovies++;
                runtime = details.runtime || 120; // fallback avg
            } else if (type === 'tv') {
                totalSeries++;
                // For TV, estimate
                const avgRuntime = (details.episode_run_time && details.episode_run_time.length > 0)
                    ? details.episode_run_time[0]
                    : 45;

                const episodes = details.number_of_episodes || 1;
                // Note: user might have watched only a few eps, but "watched" usually implies completion or tracking.
                // If we don't track episodes, we assume completion of Series? Or just add "1 unit" of watching?
                // For simple stats, let's assume if it's in watched list, they watched the whole thing (or we just count it as an item).
                // Let's cap series runtime contribution to avoid massive numbers if they mark One Piece as watched.
                // Let's just say 1 series = 10 hours avg or calculate properly.
                runtime = avgRuntime * episodes;
            }
        } else {
            // Fallback if fetch fails
            if (type === 'movie') {
                totalMovies++;
                runtime = 120;
            } else {
                totalSeries++;
                runtime = 450; // Approx 10 eps * 45 min
            }
        }
        totalMinutes += runtime;
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

        // Reset hours to compare dates only
        currentDate.setHours(0, 0, 0, 0);
        nextDate.setHours(0, 0, 0, 0);

        const diffTime = Math.abs(currentDate - nextDate);
        const diffDays = Math.ceil(diffTime / oneDayMs);

        if (diffDays === 1) {
            streak++;
        } else if (diffDays > 1) {
            break;
        }
        // if diffDays == 0 (same day), continue
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

    if (end === 0) {
        element.textContent = 0;
        return;
    }

    const range = end - start;
    const increment = end > start ? 1 : -1;
    const stepTime = Math.abs(Math.floor(duration / range));

    // If range is huge, stepTime might be 0. Cap it.
    const safeStepTime = Math.max(stepTime, 10);

    let currentValue = start;
    const timer = setInterval(() => {
        currentValue += increment;
        element.textContent = currentValue;
        if (currentValue == end) {
            clearInterval(timer);
        }
    }, safeStepTime);
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
