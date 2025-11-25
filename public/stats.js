// Mock Stats Logic
// In a real app, this would calculate from the user's history in Firestore

document.addEventListener('DOMContentLoaded', () => {
    animateValue("totalHours", 0, 142, 2000);
    animateValue("moviesCount", 0, 45, 1500);
    animateValue("seriesCount", 0, 12, 1000);
    animateValue("streakDays", 0, 7, 1000);
});

function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
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
