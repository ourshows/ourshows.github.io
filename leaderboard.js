import { auth, onAuthStateChanged, db, collection, getDocs, doc, setDoc, query, orderBy, limit } from './firebase-wrapper.js';

let currentUser = null;

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    loadLeaderboard('totalHours'); // Initial Load
});

window.loadLeaderboard = async function (metric, btn) {
    if (btn) {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }

    const labelMap = {
        'totalHours': 'Hours',
        'totalMovies': 'Movies',
        'totalSeries': 'Series'
    };
    document.getElementById('statLabel').textContent = labelMap[metric];

    const list = document.getElementById('leaderboardList');
    list.innerHTML = '<div style="padding: 3rem; text-align: center;"><i class="fas fa-circle-notch fa-spin" style="font-size: 2rem; color: var(--primary-color);"></i></div>';

    const podiumArea = document.getElementById('podiumArea');
    // Hide podium during load
    podiumArea.style.display = 'none';

    // Self-Healing: Ensure CURRENT user's stats are up to date and persisted so they appear in the list using fetchUserStats
    if (currentUser) {
        try {
            await fetchUserStats(currentUser.uid);
        } catch (e) {
            console.warn("Could not sync my stats:", e);
        }
    }

    // Increased limit to 100 to show more users
    const leaders = await fetchLeaderboard(metric, 100);

    if (!leaders || leaders.length === 0) {
        list.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-secondary);">No data available yet.</div>';
        return;
    }

    // Render Podium (Top 3)
    if (leaders.length >= 3) {
        podiumArea.style.display = 'flex';
        podiumArea.innerHTML = `
            <div class="podium-item second">
                <img src="${leaders[1].photo || 'https://via.placeholder.com/60'}" class="podium-avatar">
                <div class="podium-block">
                    <span class="rank-badge">🥈</span>
                    <div>${leaders[1].name}</div>
                    <div style="font-size: 0.8rem; font-weight: 500;">${leaders[1].stats[metric]}</div>
                </div>
            </div>
            <div class="podium-item first">
                    <img src="${leaders[0].photo || 'https://via.placeholder.com/70'}" class="podium-avatar">
                <div class="podium-block">
                    <span class="rank-badge">🥇</span>
                    <div>${leaders[0].name}</div>
                    <div style="font-size: 0.9rem; font-weight: 500;">${leaders[0].stats[metric]}</div>
                </div>
            </div>
            <div class="podium-item third">
                    <img src="${leaders[2].photo || 'https://via.placeholder.com/60'}" class="podium-avatar">
                <div class="podium-block">
                    <span class="rank-badge">🥉</span>
                    <div>${leaders[2].name}</div>
                    <div style="font-size: 0.8rem; font-weight: 500;">${leaders[2].stats[metric]}</div>
                </div>
            </div>
            `;
    }

    // Render List
    list.innerHTML = leaders.map((l, i) => {
        const isMe = currentUser && l.id === currentUser.uid;
        const rank = i + 1;
        let rankDisplay = rank;
        if (rank === 1) rankDisplay = '🥇';
        if (rank === 2) rankDisplay = '🥈';
        if (rank === 3) rankDisplay = '🥉';

        return `
        <div class="list-row ${isMe ? 'my-row' : ''}">
            <span class="rank-num">${rankDisplay}</span>
            <div class="user-info">
                <img src="${l.photo || 'https://via.placeholder.com/40'}" class="user-img">
                <div>
                    <div class="user-name">${l.name} ${isMe ? '(You)' : ''}</div>
                        <div class="user-title">${l.stats.levelTitle || 'Watcher'}</div>
                </div>
            </div>
            <span class="stat-val">${l.stats[metric]}</span>
        </div>
        `;
    }).join('');
}


// --- Inlined Helper Logic from profile-logic.js ---

async function fetchLeaderboard(metric = 'totalHours', limitCount = 10) {
    try {
        const usersRef = collection(db, 'users');
        // Note: Field path for stats is 'stats.totalHours' etc.
        const q = query(
            usersRef,
            orderBy(`stats.${metric}`, 'desc'),
            limit(limitCount)
        );

        const snap = await getDocs(q);
        const leaders = [];
        snap.forEach(doc => {
            const data = doc.data();
            if (data.stats) {
                leaders.push({
                    id: doc.id,
                    name: data.displayName || 'Anonymous',
                    photo: data.photoURL,
                    stats: data.stats
                });
            }
        });
        return leaders;
    } catch (err) {
        console.error("Error fetching leaderboard:", err);
        return [];
    }
}

async function fetchUserStats(userId) {
    if (!userId) return null;

    try {
        const watchedRef = collection(db, 'users', userId, 'watched');
        const snap = await getDocs(watchedRef);
        const watchedItems = [];
        snap.forEach(doc => watchedItems.push(doc.data()));

        const stats = calculateStatsFromItems(watchedItems);

        // PERSIST STATS for Leaderboard (Self-healing)
        if (stats) {
            const userRef = doc(db, 'users', userId);
            try {
                const user = auth.currentUser;
                setDoc(userRef, {
                    stats: {
                        totalMovies: stats.totalMovies,
                        totalSeries: stats.totalSeries,
                        totalHours: stats.totalHours,
                        level: stats.level.currentLevel,
                        levelTitle: stats.level.title
                    },
                    displayName: user ? (user.displayName || 'Anonymous') : 'Anonymous',
                    photoURL: user ? user.photoURL : null,
                    lastStatsUpdate: new Date()
                }, { merge: true }); // Async update, don't await
            } catch (err) {
                console.warn("Failed to persist stats for leaderboard:", err);
            }
        }

        return stats;
    } catch (e) {
        console.error("Error fetching stats:", e);
        return null;
    }
}

function calculateStatsFromItems(items) {
    let totalMovies = 0;
    let totalSeries = 0;
    let totalMinutes = 0;

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

    const totalHours = Math.floor(totalMinutes / 60);
    const levelData = calculateLevel(totalHours);

    // Streaks (simplified for leaderboard purposes, we might not need full streak logic here but keeping structure)
    // We only need basic stats for leaderboard display

    return {
        totalMovies,
        totalSeries,
        totalHours,
        level: levelData
    };
}

function calculateLevel(totalHours) {
    const thresholds = [0, 5, 15, 30, 50, 80, 120, 170, 230, 300, 400, 550, 750, 1000];
    let level = 1;
    for (let i = 0; i < thresholds.length; i++) {
        if (totalHours >= thresholds[i]) {
            level = i + 1;
        } else {
            break;
        }
    }
    return {
        currentLevel: level,
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
