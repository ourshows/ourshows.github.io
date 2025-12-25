
import { auth, onAuthStateChanged } from './firebase-config.js';
import { fetchUserStats, getUnlockedBadges, fetchLeaderboard } from './profile-logic.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Setup Auth Listener
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("User logged in, fetching stats...");
            await loadUserStats(user.uid);
        } else {
            console.log("No user logged in, redirecting or showing zeros");
            // Optional: window.location.href = 'login.html';
            resetStatsDisplay();
        }
    });

    // 2. Load Leaderboard (initial)
    loadLeaderboard('totalHours');

    // 3. Leaderboard Filter Listeners
    document.querySelectorAll('.filter-chip').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // UI Toggle
            document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            // Logic
            const metric = e.target.dataset.metric;
            loadLeaderboard(metric);
        });
    });
});

async function loadUserStats(userId) {
    const stats = await fetchUserStats(userId);

    if (!stats) {
        console.warn("No stats found or error fetching.");
        resetStatsDisplay();
        return;
    }

    // A. Set Counters (Instant)
    document.getElementById("totalHours").textContent = stats.totalHours;
    document.getElementById("moviesCount").textContent = stats.totalMovies;
    document.getElementById("seriesCount").textContent = stats.totalSeries;
    document.getElementById("streakDays").textContent = stats.streak;

    // Refresh Leaderboard to ensure sync with just-updated DB
    loadLeaderboard(document.querySelector('.filter-chip.active').dataset.metric);

    // B. Render Badges
    const badgesContainer = document.getElementById('badgesContainer');
    const unlockedBadges = getUnlockedBadges(stats);

    if (unlockedBadges.length === 0) {
        badgesContainer.innerHTML = '<p style="color: var(--text-secondary);">Watch more content to unlock achievements!</p>';
    } else {
        badgesContainer.innerHTML = unlockedBadges.map(badge => `
            <div class="badge" title="${badge.desc}">
                <i class="fas ${badge.icon}" style="color: #fbbf24;"></i>
                <span>${badge.name}</span>
            </div>
        `).join('');
    }
}

async function loadLeaderboard(metric) {
    const tbody = document.getElementById('leaderboardBody');
    tbody.innerHTML = '<tr><td colspan="4" style="padding: 2rem; text-align: center; color: var(--text-secondary);">Loading...</td></tr>';

    const leaders = await fetchLeaderboard(metric);

    if (!leaders || leaders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="padding: 2rem; text-align: center;">No data available yet.</td></tr>';
        return;
    }

    tbody.innerHTML = leaders.map((user, index) => {
        const rank = index + 1;
        const isCurrentUser = auth.currentUser && user.id === auth.currentUser.uid;
        const rowStyle = isCurrentUser ? 'background: rgba(124, 58, 237, 0.1); border-left: 3px solid var(--primary-color);' : '';

        let score = 0;
        if (metric === 'totalHours') score = user.stats.totalHours + ' hrs';
        else if (metric === 'totalMovies') score = user.stats.totalMovies;
        else if (metric === 'totalSeries') score = user.stats.totalSeries;

        const levelTitle = user.stats.levelTitle || 'Novice';
        const levelNum = user.stats.level || 1;

        return `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s; ${rowStyle}">
                <td style="padding: 1rem;">
                    ${getRankBadge(rank)}
                </td>
                <td style="padding: 1rem;">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <img src="${user.photo || 'https://via.placeholder.com/40'}" 
                             style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1px solid var(--glass-border);">
                        <span style="font-weight: 600; color: var(--text-primary);">${user.name}</span>
                        ${isCurrentUser ? '<span style="font-size: 0.7rem; background: var(--primary-color); padding: 2px 6px; border-radius: 4px; color: white;">YOU</span>' : ''}
                    </div>
                </td>
                <td style="padding: 1rem;">
                    <span style="color: var(--text-secondary); font-size: 0.9rem;">Lvl ${levelNum} • ${levelTitle}</span>
                </td>
                <td style="padding: 1rem; text-align: right; font-weight: bold; color: var(--accent-color);">
                    ${score}
                </td>
            </tr>
        `;
    }).join('');
}

function getRankBadge(rank) {
    if (rank === 1) return '<i class="fas fa-trophy" style="color: #ffd700; font-size: 1.2rem;"></i>';
    if (rank === 2) return '<i class="fas fa-medal" style="color: #c0c0c0; font-size: 1.2rem;"></i>';
    if (rank === 3) return '<i class="fas fa-medal" style="color: #cd7f32; font-size: 1.2rem;"></i>';
    return `<span style="color: var(--text-secondary); font-weight: bold; margin-left: 5px;">#${rank}</span>`;
}

function resetStatsDisplay() {
    document.getElementById('totalHours').textContent = '0';
    document.getElementById('moviesCount').textContent = '0';
    document.getElementById('seriesCount').textContent = '0';
    document.getElementById('streakDays').textContent = '0';
    document.getElementById('badgesContainer').innerHTML = '<p style="color: var(--text-secondary);">Login to see achievements</p>';
}

// Utility: Animate Number
function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    if (!obj) return;

    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}
