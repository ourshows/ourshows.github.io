// Stats Page with Firebase Integration
import { auth, db, onAuthStateChanged, collection, getDocs } from './firebase-wrapper.js';

let currentUser = null;
let watchedItems = [];

onAuthStateChanged(auth, async (user) => {
    updateAuthUI(user);
    if (user) {
        currentUser = user;
        await loadWatchedItems(user.uid);
    } else {
        document.getElementById('loading').style.display = 'none';
        updateStatsUI({ totalMovies: 0, totalSeries: 0, movieHours: 0, seriesHours: 0, totalHours: 0, streak: 0 });
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

        await calculateStats();
    } catch (error) {
        console.error('Error loading watched items:', error);
    } finally {
        if (loading) loading.style.display = 'none';
    }
}

async function fetchTMDBDetails(id, type) {
    if (window.PUBLIC_CONFIG && (window.PUBLIC_CONFIG.TMDB_KEY || window.PUBLIC_CONFIG.TMDB_API_KEY)) {
        const baseUrl = window.PUBLIC_CONFIG.TMDB_BASE_URL || "https://api.themoviedb.org/3";
        const url = new URL(`${baseUrl}/${type}/${id}`);
        const apiKey = window.PUBLIC_CONFIG.TMDB_KEY || window.PUBLIC_CONFIG.TMDB_API_KEY;
        url.searchParams.append('api_key', apiKey);
        try {
            const res = await fetch(url);
            if (!res.ok) return null;
            return await res.json();
        } catch (e) { return null; }
    }
    // Fallback
    const url = new URL('/api/tmdb', window.location.origin);
    url.searchParams.append('endpoint', `/${type}/${id}`);
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return await res.json();
    } catch (e) { return null; }
}

async function calculateStats() {
    let totalMovies = 0;
    let totalSeries = 0;
    let movieMinutes = 0;
    let seriesMinutes = 0;

    let genresCount = new Set();
    let highRatedCount = 0; // > 8.5
    let lowRatedCount = 0; // < 4
    let weekendWatchCount = 0;
    let nightOwlCount = 0; // > 11 PM

    const promises = watchedItems.map(async (item) => {
        let type = item.mediaType || 'movie';
        let runtime = 0;

        // Check timestamp for habits
        if (item.timestamp) {
            const date = new Date(item.timestamp.seconds * 1000);
            const hour = date.getHours();
            const day = date.getDay(); // 0 = Sun, 6 = Sat
            if (day === 0 || day === 6) weekendWatchCount++;
            if (hour >= 23 || hour < 4) nightOwlCount++;
        }

        const details = await fetchTMDBDetails(item.movieId, type);

        if (details) {
            if (details.genres) details.genres.forEach(g => genresCount.add(g.id));
            if (details.vote_average >= 8.5) highRatedCount++;
            if (details.vote_average <= 4.0 && details.vote_average > 0) lowRatedCount++;

            if (type === 'movie') {
                totalMovies++;
                movieMinutes += (details.runtime || 110);
            } else if (type === 'tv') {
                totalSeries++;
                const avgRuntime = (details.episode_run_time && details.episode_run_time[0]) || 45;
                const episodes = details.number_of_episodes || 12;
                seriesMinutes += (avgRuntime * episodes);
            }
        } else {
            // Basic fallback
            if (type === 'movie') { totalMovies++; movieMinutes += 120; }
            else { totalSeries++; seriesMinutes += 450; }
        }
    });

    await Promise.all(promises);

    const movieHours = Math.floor(movieMinutes / 60);
    const seriesHours = Math.floor(seriesMinutes / 60);
    const totalHours = movieHours + seriesHours;
    const streak = calculateStreak();

    updateStatsUI({
        totalMovies,
        totalSeries,
        movieHours,
        seriesHours,
        totalHours,
        streak
    });

    updateBadges({
        totalMovies,
        totalSeries,
        totalHours,
        streak,
        uniqueGenres: genresCount.size,
        highRatedCount,
        lowRatedCount,
        weekendWatchCount,
        nightOwlCount
    });
}

function calculateStreak() {
    if (watchedItems.length === 0) return 0;
    const sorted = watchedItems.filter(m => m.timestamp).sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);
    if (sorted.length === 0) return 0;
    let streak = 1;
    const oneDayMs = 24 * 60 * 60 * 1000;
    for (let i = 0; i < sorted.length - 1; i++) {
        const d1 = new Date(sorted[i].timestamp.seconds * 1000);
        const d2 = new Date(sorted[i + 1].timestamp.seconds * 1000);
        d1.setHours(0, 0, 0, 0);
        d2.setHours(0, 0, 0, 0);
        const diff = Math.abs(d1 - d2);
        const diffDays = Math.ceil(diff / oneDayMs);
        if (diffDays === 1) streak++;
        else if (diffDays > 1) break;
    }
    return streak;
}

function updateStatsUI(stats) {
    animateValue('moviesCount', 0, stats.totalMovies, 1000);
    animateValue('seriesCount', 0, stats.totalSeries, 1000);
    animateValue('movieHours', 0, stats.movieHours, 1000);
    animateValue('seriesHours', 0, stats.seriesHours, 1000);
    animateValue('totalHours', 0, stats.totalHours, 1000);
    animateValue('streakDays', 0, stats.streak, 1000);
}

function animateValue(id, start, end, duration) {
    const el = document.getElementById(id);
    if (!el) return;
    if (end === 0) { el.textContent = 0; return; }
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        el.textContent = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

function updateBadges(data) {
    const badges = [
        { name: 'First Watch', icon: 'fa-play', desc: 'Watched 1 item', unlocked: (data.totalMovies + data.totalSeries) >= 1 },

        // Movie Milestones
        { name: 'Movie Buff', icon: 'fa-film', desc: 'Watched 10 movies', unlocked: data.totalMovies >= 10 },
        { name: 'Popcorn Fanatic', icon: 'fa-ticket-alt', desc: 'Watched 30 movies', unlocked: data.totalMovies >= 30 },
        { name: 'Cinema Legend', icon: 'fa-crown', desc: 'Watched 50 movies', unlocked: data.totalMovies >= 50 },
        { name: 'Silver Screen Surfer', icon: 'fa-video', desc: 'Watched 60 movies', unlocked: data.totalMovies >= 60 },
        { name: 'Century Club', icon: 'fa-star', desc: 'Watched 100 movies', unlocked: data.totalMovies >= 100 },
        { name: 'Movie God', icon: 'fa-user-astronaut', desc: 'Watched 500 movies', unlocked: data.totalMovies >= 500 },

        // Series Milestones
        { name: 'Series Binger', icon: 'fa-tv', desc: 'Watched 5 series', unlocked: data.totalSeries >= 5 },
        { name: 'Pilot Enjoyer', icon: 'fa-couch', desc: 'Watched 10 series', unlocked: data.totalSeries >= 10 },
        { name: 'Completionist', icon: 'fa-check-double', desc: 'Watched 25 series', unlocked: data.totalSeries >= 25 },
        { name: 'Showrunner', icon: 'fa-tasks', desc: 'Watched 50 series', unlocked: data.totalSeries >= 50 },
        { name: 'TV Titan', icon: 'fa-broadcast-tower', desc: 'Watched 100 series', unlocked: data.totalSeries >= 100 },
        { name: 'Infinite Streamer', icon: 'fa-infinity', desc: 'Watched 150 series', unlocked: data.totalSeries >= 150 },

        // Time & Streak
        { name: 'Time Traveler', icon: 'fa-hourglass-half', desc: 'Watched 50+ hours', unlocked: data.totalHours >= 50 },
        { name: 'Marathoner', icon: 'fa-running', desc: 'Watched 100+ hours', unlocked: data.totalHours >= 100 },
        { name: 'Streak Master', icon: 'fa-fire', desc: '3 day streak', unlocked: data.streak >= 3 },
        { name: 'Genre Explorer', icon: 'fa-compass', desc: '5 genres explored', unlocked: data.uniqueGenres >= 5 },
        { name: 'Critic Choice', icon: 'fa-star', desc: 'Watch 5 highly rated (8.5+)', unlocked: data.highRatedCount >= 5 },
        { name: 'Night Owl', icon: 'fa-moon', desc: 'Watch 3 times after 11 PM', unlocked: data.nightOwlCount >= 3 },
        { name: 'Weekend Warrior', icon: 'fa-calendar-week', desc: 'Watch 5 items on weekends', unlocked: data.weekendWatchCount >= 5 }
    ];

    const container = document.getElementById('badgesContainer');
    if (!container) return;
    container.innerHTML = '';

    let unlockedCount = 0;

    badges.forEach(badge => {
        if (badge.unlocked) unlockedCount++;
        const el = document.createElement('div');
        el.className = `badge ${badge.unlocked ? 'unlocked' : 'locked'}`;
        el.innerHTML = `
            <i class="fas ${badge.icon}"></i>
            <span>${badge.name}</span>
        `;
        el.onclick = () => alert(`🏆 ${badge.name}\n${badge.desc}\nStatus: ${badge.unlocked ? 'UNLOCKED' : 'LOCKED'}`);
        container.appendChild(el);
    });

    const countEl = document.getElementById('badgeCount');
    if (countEl) countEl.textContent = `(${unlockedCount}/${badges.length})`;
}
