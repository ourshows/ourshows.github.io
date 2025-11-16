// pwa-install.js - Simple PWA installer
(function() {
  'use strict';
  
  let deferredPrompt;
  
  // Register service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(() => console.log('✅ PWA ready - app can be installed'))
        .catch((err) => console.error('❌ SW registration failed:', err));
    });
  }
  
  // Capture install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallButton();
  });
  
  // Show install button
  function showInstallButton() {
    const btn = document.createElement('button');
    btn.id = 'pwa-install-btn';
    btn.innerHTML = '📱 Install App';
    btn.className = 'fixed bottom-6 right-6 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg shadow-2xl z-50 font-semibold transition-all duration-300 hover:scale-105';
    btn.onclick = installApp;
    document.body.appendChild(btn);
    
    // Bounce animation for 5 seconds
    btn.style.animation = 'bounce 1s infinite';
    setTimeout(() => btn.style.animation = '', 5000);
  }
  
  // Install app
  async function installApp() {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('✅ App installed');
      showSuccessToast();
    }
    
    deferredPrompt = null;
    document.getElementById('pwa-install-btn')?.remove();
  }
  
  // Success message
  function showSuccessToast() {
    const toast = document.createElement('div');
    toast.className = 'fixed top-6 right-6 bg-green-600 text-white px-6 py-3 rounded-lg shadow-2xl z-50';
    toast.innerHTML = '✅ App installed! Check your home screen';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }
  
  // Hide install button after installation
  window.addEventListener('appinstalled', () => {
    document.getElementById('pwa-install-btn')?.remove();
  });
  
  // Add bounce animation CSS
  const style = document.createElement('style');
  style.textContent = `
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
  `;
  document.head.appendChild(style);
  
})();