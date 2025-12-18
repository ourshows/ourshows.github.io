
import { db, auth, getDocs, collection, updateProfile } from '../firebase-wrapper.js';

// --- Shared Stats Logic ---
export async function fetchUserStats(userId) {
    if (!userId) return null;

    try {
        const watchedRef = collection(db, 'users', userId, 'watched');
        const snap = await getDocs(watchedRef);
        const watchedItems = [];
        snap.forEach(doc => watchedItems.push(doc.data()));
        return calculateStatsFromItems(watchedItems);
    } catch (e) {
        console.error("Error fetching stats:", e);
        return null;
    }
}

export function calculateStatsFromItems(items) {
    let totalMovies = 0;
    let totalSeries = 0;
    let totalMinutes = 0;

    // Simplified logic for Profile Quick Stats (less granular than full Stats page to save API calls)
    // We assume standard runtimes if detailed data isn't cached, or use what we have.

    items.forEach(item => {
        const type = item.mediaType || 'movie';
        if (type === 'movie') {
            totalMovies++;
            totalMinutes += 120; // Avg
        } else {
            totalSeries++;
            totalMinutes += 450; // Avg season
        }
    });

    // Recent Activity (Top 5)
    // Sort by timestamp descending
    const sortedByDate = [...items]
        .filter(m => m.timestamp)
        .sort((a, b) => b.timestamp.seconds - a.timestamp.seconds)
        .slice(0, 5);

    const totalHours = Math.floor(totalMinutes / 60);

    // Streaks (simplified)
    const streak = calculateStreak(items);

    // Level Calculation
    const levelData = calculateLevel(totalHours);

    // Favorite Genres Calculation
    const genreCounts = {};
    items.forEach(item => {
        if (item.genres && Array.isArray(item.genres)) {
            item.genres.forEach(g => {
                const name = typeof g === 'string' ? g : g.name; // Handle potential object/string difference
                if (name) genreCounts[name] = (genreCounts[name] || 0) + 1;
            });
        }
    });

    const sortedGenres = Object.entries(genreCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3) // Top 3
        .map(([name, count]) => ({ name, count }));

    return {
        totalMovies,
        totalSeries,
        totalHours,
        streak,
        itemsCount: items.length,
        recentActivity: sortedByDate,
        level: levelData,
        favoriteGenres: sortedGenres
    };
}

export function calculateLevel(totalHours) {
    // Level 1: 0-5 hrs
    // Level 2: 5-15 hrs
    // Level 3: 15-30 hrs
    // Simple formula: Level = floor(sqrt(hours)) + 1 (roughly)
    // Let's use a custom threshold array for better control
    const thresholds = [0, 5, 15, 30, 50, 80, 120, 170, 230, 300, 400, 550, 750, 1000];

    let level = 1;
    let nextLevelXP = 5;
    let currentLevelXP = 0;

    for (let i = 0; i < thresholds.length; i++) {
        if (totalHours >= thresholds[i]) {
            level = i + 1;
            currentLevelXP = thresholds[i];
            nextLevelXP = thresholds[i + 1] || (thresholds[i] + 100); // Fallback for high levels
        } else {
            break;
        }
    }

    const xpInLevel = totalHours - currentLevelXP;
    const levelSpan = nextLevelXP - currentLevelXP;
    const progress = Math.min(100, Math.floor((xpInLevel / levelSpan) * 100));

    return {
        currentLevel: level,
        progress: progress,
        currentXP: totalHours,
        nextLevelXP: nextLevelXP,
        title: getLevelTitle(level)
    };
}

function getLevelTitle(level) {
    if (level >= 10) return "Cinema Legend";
    if (level >= 8) return "Film Virtuoso";
    if (level >= 6) return "Movie Buff";
    if (level >= 4) return "Binge Watcher";
    if (level >= 2) return "Film Fanatic";
    return "Newbie Watcher";
}

function calculateStreak(items) {
    if (!items.length) return 0;
    const sorted = items.filter(m => m.timestamp).sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);
    if (!sorted.length) return 0;

    let streak = 1;
    const oneDayMs = 86400000;

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

// --- Badge Logic (Shared) ---
export function getUnlockedBadges(stats) {
    const badges = [
        { name: 'First Watch', icon: 'fa-play', desc: 'Watched 1 item', unlocked: stats.itemsCount >= 1 },

        // Movie Milestones
        { name: 'Movie Buff', icon: 'fa-film', desc: 'Watched 10 movies', unlocked: stats.totalMovies >= 10 },
        { name: 'Popcorn Fanatic', icon: 'fa-ticket-alt', desc: 'Watched 30 movies', unlocked: stats.totalMovies >= 30 },
        { name: 'Cinema Legend', icon: 'fa-crown', desc: 'Watched 50 movies', unlocked: stats.totalMovies >= 50 },
        { name: 'Silver Screen Surfer', icon: 'fa-video', desc: 'Watched 60 movies', unlocked: stats.totalMovies >= 60 },
        { name: 'Century Club', icon: 'fa-star', desc: 'Watched 100 movies', unlocked: stats.totalMovies >= 100 },
        { name: 'Movie God', icon: 'fa-user-astronaut', desc: 'Watched 500 movies', unlocked: stats.totalMovies >= 500 },

        // Series Milestones
        { name: 'Series Binger', icon: 'fa-tv', desc: 'Watched 5 series', unlocked: stats.totalSeries >= 5 },
        { name: 'Pilot Enjoyer', icon: 'fa-couch', desc: 'Watched 10 series', unlocked: stats.totalSeries >= 10 },
        { name: 'Completionist', icon: 'fa-check-double', desc: 'Watched 25 series', unlocked: stats.totalSeries >= 25 },
        { name: 'Showrunner', icon: 'fa-tasks', desc: 'Watched 50 series', unlocked: stats.totalSeries >= 50 },
        { name: 'TV Titan', icon: 'fa-broadcast-tower', desc: 'Watched 100 series', unlocked: stats.totalSeries >= 100 },
        { name: 'Infinite Streamer', icon: 'fa-infinity', desc: 'Watched 150 series', unlocked: stats.totalSeries >= 150 },

        // Time & Streak
        { name: 'Time Traveler', icon: 'fa-hourglass-half', desc: 'Watched 50+ hours', unlocked: stats.totalHours >= 50 },
        { name: 'Marathoner', icon: 'fa-running', desc: 'Watched 100+ hours', unlocked: stats.totalHours >= 100 },
        { name: 'Streak Master', icon: 'fa-fire', desc: '3 day streak', unlocked: stats.streak >= 3 }
    ];
    return badges.filter(b => b.unlocked);
}

// --- Profile Update Logic ---
export async function updateUserProfile(displayName, photoURL) {
    const user = auth.currentUser;
    if (!user) throw new Error("No user logged in");

    await updateProfile(user, {
        displayName: displayName || user.displayName,
        photoURL: photoURL || user.photoURL
    });

    return {
        displayName: user.displayName,
        photoURL: user.photoURL
    };
}
