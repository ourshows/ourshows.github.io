// Global Loading Overlay
// Can be imported and used by any page

const loaderHTML = `
<div id="globalLoader" class="loader-container">
    <div class="loader-content">
        <div class="film-reel">
            <div class="film-reel-holes"></div>
        </div>
        <div class="loader-text" id="loaderText">Loading...</div>
        <div class="loader-progress">
            <div class="loader-bar"></div>
        </div>
    </div>
</div>
`;

class LoadingManager {
    constructor() {
        this.messages = [
            "Dimming the lights...",
            "Popping the popcorn...",
            "Rolling the film...",
            "Checking projector...",
            "Finding your seat...",
            "Loading blockbuster..."
        ];

        if (!document.getElementById('globalLoader')) {
            const div = document.createElement('div');
            div.innerHTML = loaderHTML;
            document.body.appendChild(div.firstElementChild);
        }

        this.loader = document.getElementById('globalLoader');
        this.textElement = document.getElementById('loaderText');
        this.interval = null;
    }

    startMessageRotation() {
        // Random initial message
        if (this.textElement) {
            this.textElement.textContent = this.messages[Math.floor(Math.random() * this.messages.length)];

            // Rotate every 2 seconds
            this.interval = setInterval(() => {
                const msg = this.messages[Math.floor(Math.random() * this.messages.length)];
                this.textElement.style.opacity = '0';
                setTimeout(() => {
                    this.textElement.textContent = msg;
                    this.textElement.style.opacity = '1';
                }, 300);
            }, 2000);
        }
    }

    show() {
        if (this.loader) {
            this.loader.style.visibility = 'visible';
            this.loader.style.opacity = '1';
            this.startMessageRotation();
        }
    }

    hide() {
        if (this.loader) {
            this.loader.style.opacity = '0';
            setTimeout(() => {
                this.loader.style.visibility = 'hidden';
                if (this.interval) clearInterval(this.interval);
            }, 600); // Match CSS transition
        }
    }
}

// Auto-init and export
window.addEventListener('DOMContentLoaded', () => {
    window.ourShowLoader = new LoadingManager();
    window.ourShowLoader.show(); // Show immediately on load
});

// Fallback: If nothing calls hide() after a long time, hide it
window.addEventListener('load', () => {
    setTimeout(() => {
        // Only auto-hide if main.js hasn't taken control (we can assume if it's still running it might be stuck)
        // But for now, let's just let main.js handle it. 
        // If main.js fails, we might want a failsafe.
        if (window.ourShowLoader) {
            // window.ourShowLoader.hide(); 
        }
    }, 10000); // 10s failsafe
});

// Export for manual use if needed in modules
window.LoadingManager = LoadingManager;
