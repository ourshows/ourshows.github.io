// User Authentication State Manager
// This script manages user login state across the site

(function () {
    'use strict';

    // Check if user is logged in
    function checkAuthState() {
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        const userEmail = localStorage.getItem('userEmail');
        const userName = localStorage.getItem('userName');
        const userPhoto = localStorage.getItem('userPhoto');

        return {
            isLoggedIn,
            userEmail,
            userName,
            userPhoto
        };
    }

    // Update navbar based on auth state
    function updateNavbar() {
        const authState = checkAuthState();
        const authBtn = document.getElementById('navAuthBtn');

        if (!authBtn) return;

        if (authState.isLoggedIn && authState.userName) {
            // User is logged in - show username
            authBtn.href = 'profile.html';
            authBtn.innerHTML = `
                <i class="fas fa-user-circle"></i> ${authState.userName}
            `;
            authBtn.title = 'View Profile';
        } else {
            // User is not logged in - show login button
            authBtn.href = 'login.html';
            authBtn.innerHTML = `
                <i class="fas fa-sign-in-alt"></i> Login
            `;
            authBtn.title = 'Login';
        }
    }

    // Logout function
    window.logout = function () {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userName');
        localStorage.removeItem('userPhoto');
        localStorage.removeItem('userId');
        window.location.href = 'index.html';
    };

    // Initialize on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateNavbar);
    } else {
        updateNavbar();
    }

    // Make auth state available globally
    window.getAuthState = checkAuthState;
})();
