// loading.js - OurShow Branded Loading Screen
// Add this script to all your HTML pages

(function() {
    // Create loading screen HTML matching your index.html branding
    const loadingHTML = `
        <div id="loading-screen" class="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
            <div class="text-center">
                <!-- Animated Logo Container -->
                <div class="relative mb-8 flex items-center justify-center">
                    <!-- Outer rotating ring -->
                    <div class="absolute w-40 h-40 border-4 border-transparent border-t-red-600 border-r-pink-500 rounded-full animate-spin"></div>
                    
                    <!-- Inner pulsing ring -->
                    <div class="absolute w-32 h-32 border-4 border-transparent border-b-red-500/50 border-l-pink-500/50 rounded-full animate-spin" style="animation-direction: reverse; animation-duration: 1.5s;"></div>
                    
                    <!-- Center Logo - Matching your header -->
                    <div class="relative flex items-center gap-3">
                        <div class="logo-badge flex items-center justify-center rounded-lg bg-gradient-to-br from-red-600 to-red-700 px-4 py-3 shadow-2xl animate-pulse">
                            <span class="text-white font-extrabold text-2xl">OUR</span>
                        </div>
                    </div>
                </div>
                
                <!-- Brand Name with gradient -->
                <div class="mb-6">
                    <div class="text-5xl font-extrabold bg-gradient-to-r from-red-500 to-pink-500 bg-clip-text text-transparent mb-2">
                        Show
                    </div>
                    <div class="text-sm text-gray-400 tracking-wide">
                        🎬 discover • 💬 discuss • 🤖 recommend
                    </div>
                </div>
                
                <!-- Loading Text -->
                <p class="text-gray-300 text-lg mb-6 animate-pulse">
                    Loading your entertainment...
                </p>
                
                <!-- Progress Bar -->
                <div class="w-80 max-w-full h-2 bg-gray-800 rounded-full overflow-hidden mx-auto border border-gray-700">
                    <div class="h-full bg-gradient-to-r from-red-600 via-pink-500 to-red-600 rounded-full animate-loading-bar shadow-lg"></div>
                </div>
                
                <!-- Fun Loading Messages -->
                <p id="loading-message" class="text-gray-400 text-sm mt-6 italic animate-pulse">
                    Preparing the popcorn...
                </p>
            </div>
        </div>
    `;

    // Create styles
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        @keyframes loading-bar {
            0% { 
                width: 0%; 
                transform: translateX(0);
            }
            50% { 
                width: 70%;
                transform: translateX(15%);
            }
            100% { 
                width: 100%;
                transform: translateX(0);
            }
        }
        
        .animate-loading-bar {
            animation: loading-bar 2s ease-in-out infinite;
        }
        
        .loading-fade-out {
            animation: fadeOut 0.6s ease-out forwards;
        }
        
        @keyframes fadeOut {
            0% {
                opacity: 1;
                transform: scale(1);
            }
            100% {
                opacity: 0;
                transform: scale(0.9);
            }
        }
        
        #loading-message {
            transition: opacity 0.3s ease;
        }
        
        /* Smooth spin animation */
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        
        .animate-spin {
            animation: spin 2s linear infinite;
        }
    `;

    // Insert loading screen as first child of body
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLoading);
    } else {
        initLoading();
    }

    function initLoading() {
        document.head.appendChild(styleElement);
        document.body.insertAdjacentHTML('afterbegin', loadingHTML);
        
        // Start loading message rotation
        startLoadingMessages();
    }

    // Fun loading messages
    const loadingMessages = [
        "Preparing the popcorn... 🍿",
        "Finding the best movies... 🎬",
        "Loading awesome content... ✨",
        "Almost there... 🚀",
        "Getting everything ready... 🎭",
        "Curating your feed... 📺",
        "Warming up the projector... 🎥",
        "Dimming the lights... 💡",
        "Rolling out the red carpet... 🎪",
        "Queuing up the trailers... 🎞️",
        "Setting up the screen... 🖥️",
        "Grabbing the remote... 📡"
    ];

    let messageIndex = 0;
    let messageInterval;

    function startLoadingMessages() {
        const messageElement = document.getElementById('loading-message');
        if (!messageElement) return;
        
        messageInterval = setInterval(() => {
            messageIndex = (messageIndex + 1) % loadingMessages.length;
            messageElement.style.opacity = '0';
            setTimeout(() => {
                messageElement.textContent = loadingMessages[messageIndex];
                messageElement.style.opacity = '1';
            }, 300);
        }, 1000);
    }

    function hideLoadingScreen() {
        if (messageInterval) clearInterval(messageInterval);
        
        setTimeout(() => {
            const loadingScreen = document.getElementById('loading-screen');
            if (loadingScreen && loadingScreen.style.display !== 'none') {
                loadingScreen.classList.add('loading-fade-out');
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 600);
            }
        }, 400);
    }

    // Hide loading screen when page is fully loaded
    window.addEventListener('load', hideLoadingScreen);

    // Fallback: Hide after 6 seconds
    setTimeout(() => {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen && loadingScreen.style.display !== 'none') {
            console.log('⏰ Loading timeout - hiding screen');
            hideLoadingScreen();
        }
    }, 6000);

    // Export function to manually hide loading (optional)
    window.hideLoading = hideLoadingScreen;
})();