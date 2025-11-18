// pwa-install.js - Simple PWA installer
(function() {
  'use strict';
  
  let deferredPrompt;
  const headerBtn = document.getElementById('install-app-btn');
  const mobileBtn = document.getElementById('mobile-install-btn');
  bindInstallButtons();
  
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
    headerBtn?.classList.remove('hidden');
    mobileBtn?.classList.remove('hidden');
  }
  
  // Install app
  async function installApp() {
    if (!deferredPrompt) {
      alert('Install prompt not available yet. If you already installed the app, you can open it from your home screen.');
      return;
    }
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('✅ App installed');
      showSuccessToast();
    }
    
    deferredPrompt = null;
    hideInstallButtons();
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
    hideInstallButtons();
  });
  
  function bindInstallButtons() {
    headerBtn?.addEventListener('click', installApp);
    mobileBtn?.addEventListener('click', installApp);
  }

  function hideInstallButtons() {
    headerBtn?.classList.add('hidden');
    mobileBtn?.classList.add('hidden');
  }
})();