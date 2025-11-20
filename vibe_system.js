/* =====================================================
   VIBE SYSTEM - Color Scheme Customization
   Classic (Red) | Pastel (Pink) | Neon (Cyan)
===================================================== */

// Vibe presets with color configurations
const VIBE_PRESETS = {
    classic: {
        name: 'Classic',
        primary: '#dc2626',      // red-600
        primaryHover: '#b91c1c', // red-700
        secondary: '#ec4899',    // pink-500
        accent: '#f87171',       // red-400
        glow: 'rgba(220, 38, 38, 0.3)'
    },
    pastel: {
        name: 'Pastel',
        primary: '#f472b6',      // pink-400
        primaryHover: '#ec4899', // pink-500
        secondary: '#c084fc',    // purple-400
        accent: '#fbcfe8',       // pink-200
        glow: 'rgba(244, 114, 182, 0.3)'
    },
    neon: {
        name: 'Neon',
        primary: '#06b6d4',      // cyan-500
        primaryHover: '#0891b2', // cyan-600
        secondary: '#22d3ee',    // cyan-400
        accent: '#67e8f9',       // cyan-300
        glow: 'rgba(6, 182, 212, 0.4)'
    }
};

// Get current vibe from localStorage or default to classic
let currentVibe = localStorage.getItem('ourshow_vibe') || 'classic';

// Apply vibe colors to the page
function applyVibe(vibeName) {
    const vibe = VIBE_PRESETS[vibeName];
    if (!vibe) return;

    const root = document.documentElement;

    // Set CSS custom properties
    root.style.setProperty('--vibe-primary', vibe.primary);
    root.style.setProperty('--vibe-primary-hover', vibe.primaryHover);
    root.style.setProperty('--vibe-secondary', vibe.secondary);
    root.style.setProperty('--vibe-accent', vibe.accent);
    root.style.setProperty('--vibe-glow', vibe.glow);

    // Update active button state
    document.querySelectorAll('.vibe-btn').forEach(btn => {
        if (btn.dataset.vibe === vibeName) {
            btn.classList.add('bg-gray-700', 'ring-2', 'ring-offset-2', 'ring-offset-gray-900');
            btn.style.ringColor = vibe.primary;
        } else {
            btn.classList.remove('bg-gray-700', 'ring-2', 'ring-offset-2', 'ring-offset-gray-900');
        }
    });

    // Save to localStorage
    localStorage.setItem('ourshow_vibe', vibeName);
    currentVibe = vibeName;

    console.log(`🎨 Vibe changed to: ${vibe.name}`);
}

// Setup vibe button listeners
function setupVibeControls() {
    document.querySelectorAll('.vibe-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const vibeName = btn.dataset.vibe;
            applyVibe(vibeName);
        });
    });
}

// Initialize vibe system
function initVibeSystem() {
    // Add vibe CSS to page
    const style = document.createElement('style');
    style.textContent = `
    :root {
      --vibe-primary: ${VIBE_PRESETS.classic.primary};
      --vibe-primary-hover: ${VIBE_PRESETS.classic.primaryHover};
      --vibe-secondary: ${VIBE_PRESETS.classic.secondary};
      --vibe-accent: ${VIBE_PRESETS.classic.accent};
      --vibe-glow: ${VIBE_PRESETS.classic.glow};
    }
    
    /* Apply vibe colors to elements */
    .bg-red-600, .hover\\:bg-red-700:hover,
    .text-red-500, .text-red-400,
    .border-red-500, .ring-red-500 {
      background-color: var(--vibe-primary) !important;
      color: var(--vibe-primary) !important;
      border-color: var(--vibe-primary) !important;
    }
    
    .bg-red-700 {
      background-color: var(--vibe-primary-hover) !important;
    }
    
    .bg-pink-500, .text-pink-500, .from-pink-500, .to-pink-500 {
      background-color: var(--vibe-secondary) !important;
      color: var(--vibe-secondary) !important;
    }
    
    /* Gradient backgrounds */
    .bg-gradient-to-r.from-red-500 {
      background-image: linear-gradient(to right, var(--vibe-primary), var(--vibe-secondary)) !important;
    }
    
    .bg-gradient-to-br.from-red-600 {
      background-image: linear-gradient(to bottom right, var(--vibe-primary), var(--vibe-primary-hover)) !important;
    }
    
    /* Focus rings */
    .focus\\:ring-red-500:focus {
      --tw-ring-color: var(--vibe-primary) !important;
    }
    
    /* Hover effects */
    .hover\\:border-red-500:hover {
      border-color: var(--vibe-primary) !important;
    }
    
    /* Active sort pill */
    .sort-pill.active-sort {
      background: linear-gradient(90deg, var(--vibe-primary), var(--vibe-secondary)) !important;
    }
    
    /* Vibe button active state */
    .vibe-btn.ring-2 {
      box-shadow: 0 0 0 2px var(--vibe-glow), 0 0 20px var(--vibe-glow);
    }
  `;
    document.head.appendChild(style);

    // Setup controls
    setupVibeControls();

    // Apply saved vibe
    applyVibe(currentVibe);

    console.log('🎨 Vibe system initialized');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVibeSystem);
} else {
    initVibeSystem();
}
