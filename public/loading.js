// Global Loading Overlay
// Can be imported and used by any page

const loaderHTML = `
<div id="globalLoader" style="
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    background: var(--bg-darker);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.5s;
">
    <div style="text-align: center;">
        <div class="logo" style="font-size: 3rem; margin-bottom: 1rem; animation: pulse 2s infinite;">OurShow</div>
        <div style="color: var(--text-secondary);">Loading your experience...</div>
    </div>
</div>
<style>
@keyframes pulse {
    0% { opacity: 0.5; transform: scale(0.95); }
    50% { opacity: 1; transform: scale(1.05); }
    100% { opacity: 0.5; transform: scale(0.95); }
}
</style>
`;

class LoadingManager {
    constructor() {
        if (!document.getElementById('globalLoader')) {
            const div = document.createElement('div');
            div.innerHTML = loaderHTML;
            document.body.appendChild(div);
        }
        this.loader = document.getElementById('globalLoader');
    }

    show() {
        this.loader.style.opacity = '1';
        this.loader.style.pointerEvents = 'all';
    }

    hide() {
        this.loader.style.opacity = '0';
        this.loader.style.pointerEvents = 'none';
        setTimeout(() => {
            // Optional: remove from DOM if needed, but keeping it hidden is fine
        }, 500);
    }
}

// Auto-hide on load
window.addEventListener('load', () => {
    const loader = new LoadingManager();
    setTimeout(() => loader.hide(), 800); // Fake delay for smooth transition
});
