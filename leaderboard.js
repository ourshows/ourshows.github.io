import { auth, onAuthStateChanged } from './firebase-wrapper.js';
import { fetchLeaderboard, fetchUserStats } from './public/profile-logic.js?v=2';

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

    // Render List (Start from 4th if podium used, or all if not enough for podium? 
    // Better to show ALL in list for clarity, or just 4+? 
    // Let's show ALL in list for simplicity and standard leaderboard feel, but highlight top 3

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
