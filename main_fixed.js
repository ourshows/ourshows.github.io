/*************************************************
 *  MAIN.JS — COMPLETE FINAL VERSION
 *  Features: Filters, Smart Sections, Card Enhancements,
 *  Full Review System, Quick Actions, Skeleton Loaders
 *************************************************/

// Modular Firebase imports (dynamic)
let dbRef, set, push, get, onValue, ref, update, remove;

// Initialize modular Firebase functions once
async function initModularFirebase() {
  try {
    const dbModule = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
    dbRef = dbModule.ref;
    set = dbModule.set;
    push = dbModule.push;
    get = dbModule.get;
    onValue = dbModule.onValue;
    ref = dbModule.ref;
    update = dbModule.update;
    remove = dbModule.remove;
  } catch (err) {
    console.warn('Failed to load modular Firebase in main.js:', err);
  }
}

initModularFirebase();

console.log("%c🎬 OurShow Enhanced Edition Loaded!", "color:#00eaff;font-weight:bold;font-size:16px;");

// --- GLOBAL STATE ---
let CURRENT_SECTION = null;
let CURRENT_PAGE = 1;
let LOADED_SECTIONS = 0;
let IS_LOADING = false;
let ALL_LOADED_IDS = new Set();
let RECENTLY_VIEWED = JSON.parse(localStorage.getItem('ourshow_recent') || '[]');
let CURRENT_FILTERS = {
  genre: '',
  year: '',
  rating: '',
  language: '',
  type: 'both',
  sort: 'popularity.desc'
};
const THEME_KEY = 'ourshow_theme_pref';
const VIBE_KEY = 'ourshow_vibe_pref';
const COLLECTIONS_KEY = 'ourshow_collections';
let THEME_PREF = localStorage.getItem(THEME_KEY) || 'auto';
const DEFAULT_VIBE = 'classic';
let VIBE_PREF = localStorage.getItem(VIBE_KEY) || DEFAULT_VIBE;
let SPELLING_CACHE = new Set();
let suggestionAbortController = null;
let CURRENT_SORT_MODE = 'trending';
let LAST_RANDOM_TYPE = 'tv';
let COLLECTIONS = JSON.parse(localStorage.getItem(COLLECTIONS_KEY) || '[]');
let NOTIFICATIONS = [];
let UNREAD_NOTIFICATIONS = 0;
let notificationsListenerAttached = false;
const systemThemeQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const SECTION_PAGINATION = new Map();
let CURRENT_CONTEXTUAL_PRESET_ID = 'all';
let CURRENT_CONTEXTUAL_ENDPOINT = null;
let CURRENT_CONTEXTUAL_FILTERS = [];

// Shortcut to image base URL
const IMAGE = API_CONFIG.TMDB.imageBaseUrl;
const SAFE_PLACEHOLDER = "https://placehold.co/300x450?text=No+Image&font=roboto";
const SAFE_PROFILE = "https://placehold.co/100x100?text=No+Profile&font=roboto";
const WATCH_PC_LINK = "https://net2025.cc/login2";
const PPCINE_DOWNLOAD_URL = "downloads/PP_Cine.apk";
const PPCINE_SCHEME_BASE = "ppcine://watch";
const IS_SAFARI = /safari/i.test(navigator.userAgent || '') && !/chrome/i.test(navigator.userAgent || '');
const SUPPORTS_MS_LAUNCH = typeof navigator !== 'undefined' && typeof navigator.msLaunchUri === 'function';

const SORT_CONFIG = {
  trending: { title: "Today's Trending Mix", endpoint: "/trending/all/day" },
  popular: { title: "Most Popular Hits", endpoint: "/discover/movie?sort_by=popularity.desc&vote_count.gte=500" },
  rated: { title: "Critics' Choice (8.0+)", endpoint: "/discover/movie?sort_by=vote_average.desc&vote_count.gte=1000" },
  latest: { title: "Latest Releases", endpoint: "/discover/movie?primary_release_date.gte=2024-01-01&sort_by=primary_release_date.desc" },
  atoz: { title: "A-Z Library", endpoint: "/discover/movie?sort_by=original_title.asc&vote_count.gte=200" }
};

const YEAR_FILTER_MAP = {
  "2024": { gte: "2024-01-01", lte: "2024-12-31" },
  "2023": { gte: "2023-01-01", lte: "2023-12-31" },
  "2022": { gte: "2022-01-01", lte: "2022-12-31" },
  "2020-2021": { gte: "2020-01-01", lte: "2021-12-31" },
  "2010s": { gte: "2010-01-01", lte: "2019-12-31" },
  "2000s": { gte: "2000-01-01", lte: "2009-12-31" }
};

const LANGUAGE_LABELS = {
  en: "English",
  hi: "Hindi",
  ko: "Korean",
  ja: "Japanese",
  es: "Spanish"
};

const GENRE_LABELS = {
  "28": "Action",
  "35": "Comedy",
  "27": "Horror",
  "10749": "Romance",
  "16": "Animation",
  "99": "Documentary"
};

const BEST_CATEGORY_SHORTCUTS = [
  { id: "best-kdrama", label: "Korean Dramas", emoji: "🇰🇷" },
  { id: "best-cdrama", label: "Chinese Dramas", emoji: "🇨🇳" },
  { id: "best-hindi-movies", label: "Bollywood Movies", emoji: "🇮🇳" },
  { id: "best-english-movies", label: "Hollywood Movies", emoji: "🇺🇸" }
];

const TOPLIST_PRESETS = [
  {
    title: "Global Prime Picks",
    emoji: "🌍",
    description: "Awards magnets and festival favorites from every industry.",
    vibe: "Classic",
    tags: ["Awards", "Multi-language", "Critic Faves"],
    rows: [
      { label: "Top Rated Movies", target: "section-top-rated-movies" },
      { label: "Top Rated TV Shows", target: "section-top-rated-tv" },
      { label: "Quick Watch Gems", target: "section-quick-watch" }
    ]
  },
  {
    title: "Fresh Premieres",
    emoji: "🚀",
    description: "Just-landed blockbusters & binge nights tailored by language.",
    vibe: "Neon",
    tags: ["Premieres", "Trending", "Hindi Spotlight"],
    rows: [
      { label: "Trending Movies", target: "section-trending-movies" },
      { label: "Trending TV Shows", target: "section-trending-tv" },
      { label: "Hindi Premieres", target: "section-hindi-premieres" }
    ]
  },
  {
    title: "Genre Spotlight",
    emoji: "🎚️",
    description: "Handpicked series & films grouped by vibe, language, and genre.",
    vibe: "Pastel",
    tags: ["Genre Mix", "Global", "Series + Films"],
    rows: [
      { label: "Best Hindi Series", target: "section-hindi-series" },
      { label: "Popular Movies Hub", target: "section-popular-movies" },
      { label: "For You Smart Picks", target: "for-you-section" }
    ]
  }
];

const DEFAULT_CONTEXTUAL_FILTERS = [
  {
    id: "all",
    label: "All",
    description: "Everything inside this heading",
    buildParams: () => ({})
  },
  {
    id: "new",
    label: "New Releases",
    description: "Latest drops first",
    buildParams: (section) => {
      const dateField = section.type === "tv" ? "first_air_date" : "primary_release_date";
      return {
        [`${dateField}.gte`]: "2023-01-01",
        sort_by: `${dateField}.desc`
      };
    }
  },
  {
    id: "top",
    label: "Top IMDb",
    description: "8.0+ crowd favourites",
    buildParams: () => ({
      "vote_average.gte": "8",
      "vote_count.gte": "400",
      sort_by: "vote_average.desc"
    })
  },
  {
    id: "dubbed",
    label: "Dubbed Friendly",
    description: "High-demand titles likely dubbed",
    buildParams: () => ({}),
    transform: (items) => items.filter(item => (item.popularity || 0) > 120 || (item.vote_count || 0) > 800)
  }
];

const CONTEXTUAL_FILTER_OVERRIDES = {
  "best-kdrama": DEFAULT_CONTEXTUAL_FILTERS,
  "best-cdrama": DEFAULT_CONTEXTUAL_FILTERS,
  "best-hindi-movies": DEFAULT_CONTEXTUAL_FILTERS,
  "best-english-movies": DEFAULT_CONTEXTUAL_FILTERS,
  "best-english-series": DEFAULT_CONTEXTUAL_FILTERS,
  "trending-movies": DEFAULT_CONTEXTUAL_FILTERS,
  "trending-tv": DEFAULT_CONTEXTUAL_FILTERS
};

const BANNED_KEYWORDS = [
  'palang tod',
  'charmsukh',
  'gandii bat',
  'ulta pulta',
  'jalebi bai',
  'xxx',
  '18+',
  'baby sitter',
  'chawl house'
];

const CURATED_HINDI_SERIES = [
  // Thriller / Crime
  { title: "Sacred Games", tmdbId: 78180, category: "thriller" },
  { title: "Mirzapur", tmdbId: 84105, category: "thriller" },
  { title: "Paatal Lok", tmdbId: 103051, category: "thriller" },
  { title: "Delhi Crime", tmdbId: 87508, category: "thriller" },
  { title: "Special Ops", tmdbId: 100612, category: "thriller" },
  { title: "The Family Man", tmdbId: 93352, category: "thriller" },
  { title: "Criminal Justice", tmdbId: 88177, category: "thriller" },
  { title: "Asur", tmdbId: 100911, category: "thriller" },
  { title: "Breathe", tmdbId: 76659, category: "thriller" },
  { title: "Kaala Paani", tmdbId: 235356, category: "thriller" },

  // Drama
  { title: "Made in Heaven", tmdbId: 87407, category: "drama" },
  { title: "Panchayat", tmdbId: 101352, category: "drama" },
  { title: "Gullak", tmdbId: 90966, category: "drama" },
  { title: "Aspirants", tmdbId: 124411, category: "drama" },
  { title: "Kota Factory", tmdbId: 89113, category: "drama" },
  { title: "Yeh Meri Family", tmdbId: 81166, category: "drama" },
  { title: "Saas Bahu Aur Flamingo", tmdbId: 224654, category: "drama" },
  { title: "Trial by Fire", tmdbId: 217699, category: "drama" },
  { title: "Dahaad", tmdbId: 201050, category: "drama" },

  // Comedy
  { title: "TVF Pitchers", tmdbId: 63180, category: "comedy" },
  { title: "TVF Tripling", tmdbId: 69710, category: "comedy" },
  { title: "Hostel Daze", tmdbId: 96421, category: "comedy" },
  { title: "Permanent Roommates", tmdbId: 64068, category: "comedy" },
  { title: "Chacha Vidhayak Hain Humare", tmdbId: 99889, category: "comedy" },
  { title: "Humorously Yours", tmdbId: 69715, category: "comedy" },

  // Romance
  { title: "Mismatched", tmdbId: 113457, category: "romance" },
  { title: "Little Things", tmdbId: 82862, category: "romance" },
  { title: "Bandish Bandits", tmdbId: 106872, category: "romance" },
  { title: "Taj Mahal 1989", tmdbId: 99387, category: "romance" },

  // Action
  { title: "Rana Naidu", tmdbId: 203202, category: "action" },
  { title: "Bard of Blood", tmdbId: 91016, category: "action" },
  { title: "She", tmdbId: 100729, category: "action" },
  { title: "Mumbai Diaries", tmdbId: 115466, category: "action" },

  // Mystery / Supernatural / Sci-Fi
  { title: "JL50", tmdbId: 108681, category: "mystery" },
  { title: "Ghoul", tmdbId: 80707, category: "mystery" },
  { title: "Betaal", tmdbId: 103759, category: "mystery" },
  { title: "Dahan: Raakan Ka Rahasya", tmdbId: null, category: "mystery" },
  { title: "Kaali", tmdbId: 84831, category: "mystery" },

  // Biographical / True Story
  { title: "Scam 1992", tmdbId: 111188, category: "biographical" },
  { title: "Rocket Boys", tmdbId: 138211, category: "biographical" },
  { title: "Maharani", tmdbId: 126098, category: "biographical" },
  { title: "The Railway Men", tmdbId: 213895, category: "biographical" }
];

const HINDI_CATEGORY_CONFIG = [
  { id: "thriller", title: "Thriller / Crime", emoji: "🕵️", tagline: "Edge-of-the-seat investigations & razor-sharp cat-and-mouse games." },
  { id: "drama", title: "Drama", emoji: "🎭", tagline: "Prestige ensemble dramas & heartfelt slices of life." },
  { id: "comedy", title: "Comedy", emoji: "😂", tagline: "Feel-good TVF-style humor for breezy binge nights." },
  { id: "romance", title: "Romance", emoji: "💞", tagline: "Soft, soulful love stories and musical vibes." },
  { id: "action", title: "Action", emoji: "💥", tagline: "High-stakes missions & gritty survival tales." },
  { id: "mystery", title: "Mystery / Supernatural / Sci-Fi", emoji: "🕯️", tagline: "Dark folklore, eerie sci-fi twists & supernatural thrillers." },
  { id: "biographical", title: "Biographical / True Story", emoji: "🏅", tagline: "Visionaries, scams & real-life legends retold." }
];

const VIBE_PRESETS = {
  classic: {
    accent: '#ef4444',
    'accent-strong': '#dc2626',
    'accent-soft': '#fda4af',
    'accent-soft-bg': 'rgba(239,68,68,0.18)',
    'accent-contrast': '#ffffff',
    'accent-gradient-from': '#ef4444',
    'accent-gradient-to': '#ec4899',
    'accent-glow': 'rgba(236,72,153,0.35)'
  },
  pastel: {
    accent: '#f472b6',
    'accent-strong': '#ec4899',
    'accent-soft': '#fbcfe8',
    'accent-soft-bg': 'rgba(244,114,182,0.18)',
    'accent-contrast': '#4c0519',
    'accent-gradient-from': '#f9a8d4',
    'accent-gradient-to': '#c084fc',
    'accent-glow': 'rgba(217,70,239,0.35)'
  },
  neon: {
    accent: '#22d3ee',
    'accent-strong': '#0ea5e9',
    'accent-soft': '#a5f3fc',
    'accent-soft-bg': 'rgba(34,211,238,0.2)',
    'accent-contrast': '#020617',
    'accent-gradient-from': '#0ea5e9',
    'accent-gradient-to': '#a855f7',
    'accent-glow': 'rgba(14,165,233,0.45)'
  }
};

const HINDI_SHOW_CACHE = new Map();

/* -----------------------------------------------------
    ESCAPE HELPER
----------------------------------------------------- */
function esc(str) {
  return String(str || "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    "\"": "&quot;", "'": "&#39;"
  }[m]));
}

function cacheTitle(item) {
  const title = (item?.title || item?.name || '').trim();
  if (title) SPELLING_CACHE.add(title.toLowerCase());
}

function getSpellingSuggestion(query) {
  if (!query || SPELLING_CACHE.size === 0) return null;
  const target = query.toLowerCase();
  let best = null;
  let bestScore = Infinity;
  SPELLING_CACHE.forEach(title => {
    const score = levenshteinDistance(target, title);
    if (score < bestScore && score <= Math.max(2, Math.round(target.length * 0.3))) {
      bestScore = score;
      best = title;
    }
  });
  return best && best !== target ? best : null;
}

function levenshteinDistance(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

function applyTheme(pref = THEME_PREF) {
  THEME_PREF = pref;
  localStorage.setItem(THEME_KEY, pref);

  document.body.classList.remove('theme-light');
  if (pref === 'light') {
    document.body.classList.add('theme-light');
  } else if (pref === 'auto') {
    const isDark = systemThemeQuery?.matches ?? true;
    if (!isDark) {
      document.body.classList.add('theme-light');
    }
  }
  highlightThemeButtons(pref);
}

function applyVibe(vibe = VIBE_PREF) {
  const palette = VIBE_PRESETS[vibe] || VIBE_PRESETS[DEFAULT_VIBE];
  VIBE_PREF = palette ? vibe : DEFAULT_VIBE;
  localStorage.setItem(VIBE_KEY, VIBE_PREF);
  const root = document.documentElement;
  Object.entries(palette).forEach(([token, value]) => {
    root.style.setProperty(`--${token}`, value);
  });
  root.dataset.vibe = VIBE_PREF;
  highlightVibeButtons(VIBE_PREF);
}

function isBannedItem(item) {
  if (!item) return true;
  if (item.adult) return true;
  const title = (item.title || item.name || '').toLowerCase();
  return BANNED_KEYWORDS.some(keyword => title.includes(keyword));
}

function filterBanned(items = []) {
  return items.filter(item => !isBannedItem(item));
}

function getRuntimeLabel(value) {
  if (value === 'short') return '< 90 min';
  if (value === 'medium') return '90-120 min';
  if (value === 'long') return '> 120 min';
  return '';
}

function buildEndpointWithParams(baseEndpoint, params = {}, section = { type: 'movie' }) {
  const [path, queryString = ''] = baseEndpoint.split('?');
  const search = new URLSearchParams(queryString);
  const resolvedParams = typeof params === 'function' ? params(section) : params;
  Object.entries(resolvedParams || {}).forEach(([key, value]) => {
    if (!key) return;
    if (value === null || typeof value === 'undefined') {
      search.delete(key);
    } else {
      search.set(key, value);
    }
  });
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

function getContextualFilters(sectionId) {
  return CONTEXTUAL_FILTER_OVERRIDES[sectionId] || DEFAULT_CONTEXTUAL_FILTERS;
}

function updateFiltersSummaryDisplay(filters) {
  const summaryEl = document.getElementById('filters-summary');
  if (!summaryEl) return;
  const active = [];
  if (filters.genre) active.push(`Genre: ${GENRE_LABELS[filters.genre] || filters.genre}`);
  if (filters.year) active.push(`Year: ${filters.year}`);
  if (filters.rating) active.push(`Rating: ${filters.rating}+`);
  if (filters.language) active.push(`Language: ${LANGUAGE_LABELS[filters.language] || filters.language}`);
  if (filters.runtime) active.push(`Runtime: ${getRuntimeLabel(filters.runtime)}`);
  if (filters.type && filters.type !== 'both') active.push(`Type: ${filters.type === 'tv' ? 'Series' : 'Movies'}`);
  if (!active.length) {
    summaryEl.classList.add('hidden');
    summaryEl.innerHTML = '';
    return;
  }
  summaryEl.classList.remove('hidden');
  summaryEl.innerHTML = active.map(label => `<span class="px-3 py-1 bg-gray-800 rounded-full border border-gray-700 text-xs">${esc(label)}</span>`).join('');
}

function dedupeMediaItems(items = []) {
  const seen = new Set();
  return items.filter(item => {
    const key = `${item.media_type || item.type || 'movie'}-${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function scrollToFiltersResults() {
  const section = document.getElementById('filters-results');
  if (!section) return;
  requestAnimationFrame(() => {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function buildFilterQuery(mediaType, filters) {
  const params = new URLSearchParams();
  params.set('include_adult', 'false');
  params.set('language', 'en-US');
  params.set('sort_by', filters.sort || 'popularity.desc');
  if (filters.genre) params.set('with_genres', filters.genre);
  if (filters.language) params.set('with_original_language', filters.language);
  if (filters.rating) params.set('vote_average.gte', filters.rating);
  if (mediaType === 'movie' && filters.runtime) {
    if (filters.runtime === 'short') params.set('with_runtime.lte', '90');
    if (filters.runtime === 'medium') {
      params.set('with_runtime.gte', '90');
      params.set('with_runtime.lte', '120');
    }
    if (filters.runtime === 'long') params.set('with_runtime.gte', '120');
  }
  const yearRange = YEAR_FILTER_MAP[filters.year];
  if (yearRange) {
    if (mediaType === 'movie') {
      params.set('primary_release_date.gte', yearRange.gte);
      params.set('primary_release_date.lte', yearRange.lte);
    } else {
      params.set('first_air_date.gte', yearRange.gte);
      params.set('first_air_date.lte', yearRange.lte);
    }
  }
  return params;
}

async function fetchFilteredBatch(mediaType, queryString, pages = 1) {
  const endpoints = Array.from({ length: pages }, (_, idx) => `/discover/${mediaType}?${queryString}&page=${idx + 1}`);
  const responses = await Promise.allSettled(endpoints.map(endpoint => tmdbFetch(endpoint)));
  const aggregated = [];
  responses.forEach((result, idx) => {
    if (result.status === 'fulfilled' && result.value?.results?.length) {
      result.value.results.forEach(item => {
        aggregated.push({
          ...item,
          media_type: mediaType
        });
      });
    } else {
      console.warn(`[Filter] ${mediaType} page ${idx + 1} failed`, result.reason || result.value);
    }
  });
  return aggregated;
}

function scrollToCollectionsSection(options = {}) {
  const section = document.getElementById('collections-section');
  if (!section) return false;
  const behavior = options.behavior || 'smooth';
  section.scrollIntoView({ behavior });
  return true;
}

window.scrollToCollectionsSection = (opts) => scrollToCollectionsSection(opts || {});

function createHindiPlaceholderCard(entry) {
  return `
    <div class="min-w-[160px] bg-gray-900/60 border border-dashed border-gray-700 rounded-xl p-3 flex flex-col justify-between">
      <p class="text-sm font-semibold mb-2">${esc(entry.title)}</p>
      <p class="text-xs text-gray-500">Details coming soon</p>
    </div>
  `;
}

async function fetchHindiSeriesDetail(entry) {
  if (!entry.tmdbId) return null;
  if (HINDI_SHOW_CACHE.has(entry.tmdbId)) {
    return HINDI_SHOW_CACHE.get(entry.tmdbId);
  }
  try {
    const detail = await tmdbFetch(`/tv/${entry.tmdbId}`);
    if (detail && !isBannedItem(detail)) {
      HINDI_SHOW_CACHE.set(entry.tmdbId, detail);
      cacheTitle(detail);
      return detail;
    }
  } catch (error) {
    console.warn('Hindi OTT detail fetch failed:', entry.title, error);
  }
  return null;
}

window.scrollReviewsIntoView = function() {
  const reviewsSection = document.getElementById('reviews-section');
  if (!reviewsSection) return;
  reviewsSection.scrollIntoView({ behavior: 'smooth' });
};

function highlightThemeButtons(pref) {
  document.querySelectorAll('.theme-toggle-btn, .mobile-theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === pref);
  });
}

function highlightVibeButtons(vibe) {
  document.querySelectorAll('.vibe-btn, .mobile-vibe-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.vibe === vibe);
  });
}

function setupThemeControls() {
  document.querySelectorAll('.theme-toggle-btn, .mobile-theme-btn').forEach(btn => {
    btn.addEventListener('click', () => applyTheme(btn.dataset.theme || 'dark'));
  });
  document.querySelectorAll('.vibe-btn, .mobile-vibe-btn').forEach(btn => {
    btn.addEventListener('click', () => applyVibe(btn.dataset.vibe || DEFAULT_VIBE));
  });
  if (systemThemeQuery) {
    systemThemeQuery.addEventListener('change', () => {
      if (THEME_PREF === 'auto') applyTheme('auto');
    });
  }
  applyTheme(THEME_PREF);
  applyVibe(VIBE_PREF);
}

/* -----------------------------------------------------
    SKELETON LOADER
----------------------------------------------------- */
function createSkeleton() {
  return `
    <div class="cursor-pointer min-w-[150px] animate-pulse">
      <div class="bg-gray-800 rounded-lg aspect-[2/3] object-cover"></div>
      <div class="mt-1 bg-gray-800 h-4 rounded w-3/4"></div>
      <div class="mt-1 bg-gray-800 h-3 rounded w-1/2"></div>
    </div>
  `;
}

/* -----------------------------------------------------
    ENHANCED CARD WITH BADGES & HOVER EFFECTS
----------------------------------------------------- */
function makeCard(item, type = "movie") {
  const title = item.title || item.name || "Untitled";
  const year = (item.release_date || item.first_air_date || "N/A").split("-")[0];
  const rating = item.vote_average ? item.vote_average.toFixed(1) : "N/A";
  const pop = item.popularity ? Math.round(item.popularity) : "N/A";
  
  const img = item.poster_path
    ? `${IMAGE}/w500${item.poster_path}`
    : SAFE_PLACEHOLDER;

  // Determine badges
  const isNew = year === "2024" || year === "2023";
  const isTrending = item.popularity > 100;
  const isHighRated = item.vote_average >= 8.0;
  
  let badges = '';
  if (isNew) badges += '<span class="badge bg-green-600">NEW</span>';
  if (isTrending) badges += '<span class="badge bg-red-600">🔥 TRENDING</span>';
  if (isHighRated) badges += '<span class="badge bg-yellow-600">⭐ TOP</span>';

  return `
    <div class="movie-card cursor-pointer min-w-[150px] relative group"
         data-id="${item.id}" data-type="${type}">
      <div class="relative">
        <img src="${img}"
             alt="${esc(title)}"
             onerror="this.src='${SAFE_PLACEHOLDER}'"
             class="rounded-lg aspect-[2/3] object-cover hover:opacity-80 transition-all duration-300 group-hover:scale-105">
        
        <!-- Badges -->
        <div class="absolute top-2 left-2 flex flex-col gap-1">
          ${badges}
        </div>
        
        <!-- Quick Actions (show on hover) -->
        <div class="quick-actions absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onclick="event.stopPropagation(); quickAddToWatchlist(${item.id}, '${esc(title)}', '${type}')"
                  class="bg-red-600 hover:bg-red-700 p-2 rounded-full shadow-lg"
                  title="Add to Watchlist">
            ⭐
          </button>
          <button onclick="event.stopPropagation(); quickAddToWatchLater(${item.id}, '${esc(title)}', '${type}')"
                  class="bg-blue-600 hover:bg-blue-700 p-2 rounded-full shadow-lg"
                  title="Watch Later">
            🕒
          </button>
        </div>
        
        <!-- Rating overlay -->
        <div class="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold">
          ⭐ ${esc(rating)}
        </div>
      </div>
      
      <h3 class="mt-2 text-sm font-medium truncate">${esc(title)}</h3>
      <p class="text-gray-400 text-xs">${esc(year)} • 🔥 ${esc(pop)}</p>
    </div>
  `;
}

/* -----------------------------------------------------
    EXPANDED SECTIONS WITH SMART CATEGORIES
----------------------------------------------------- */
const SECTIONS = [
  { id:"quick-watch", title:"⚡ Quick Watch (Under 90 Minutes)",
    endpoint:"/discover/movie?with_runtime.lte=90&sort_by=popularity.desc", type:"movie" },

  { id:"best-hindi-movies", title:"🇮🇳 Best Hindi Movies (Bollywood)",
    endpoint:"/discover/movie?with_original_language=hi&sort_by=vote_average.desc&vote_count.gte=100", type:"movie" },

  { id:"hindi-premieres", title:"🇮🇳 Fresh Hindi Premieres",
    endpoint:"/discover/movie?with_original_language=hi&sort_by=primary_release_date.desc&primary_release_date.gte=2023-01-01", type:"movie" },

  { id:"trending-movies", title:"🔥 Trending Movies This Week",
    endpoint:"/trending/movie/week", type:"movie" },

  { id:"trending-tv", title:"📺 Trending TV Shows This Week",
    endpoint:"/trending/tv/week", type:"tv" },

  { id:"hindi-series", title:"🇮🇳 Best Hindi OTT Series",
    type:"tv", custom:"hindi-ott-curated" },

  { id:"top-rated-movies", title:"⭐ Top Rated Movies of All Time",
    endpoint:"/movie/top_rated", type:"movie" },

  { id:"top-rated-tv", title:"⭐ Top Rated TV Shows",
    endpoint:"/tv/top_rated", type:"tv" },

  { id:"popular-movies", title:"🎬 Popular Movies Right Now",
    endpoint:"/movie/popular", type:"movie" },

  { id:"popular-tv", title:"📺 Popular TV Shows",
    endpoint:"/tv/popular", type:"tv" },

  { id:"best-english-movies", title:"🇺🇸 Best English Movies",
    endpoint:"/discover/movie?with_original_language=en&sort_by=vote_average.desc&vote_count.gte=1000", type:"movie" },

  { id:"best-english-series", title:"🇬🇧 Best English Series",
    endpoint:"/discover/tv?with_original_language=en&sort_by=vote_average.desc&vote_count.gte=500", type:"tv" },

  { id:"best-kdrama", title:"🇰🇷 Best Korean Dramas (K-Drama)",
    endpoint:"/discover/tv?with_original_language=ko&sort_by=vote_average.desc&vote_count.gte=100", type:"tv", pages: 5 },

  { id:"best-cdrama", title:"🇨🇳 Best Chinese Dramas (C-Drama)",
    endpoint:"/discover/tv?with_original_language=zh&sort_by=vote_average.desc&vote_count.gte=50", type:"tv", pages: 5 },

  { id:"japanese-anime", title:"🇯🇵 Japanese Anime Series",
    endpoint:"/discover/tv?with_original_language=ja&with_genres=16&sort_by=popularity.desc", type:"tv" },

  { id:"action-movies", title:"💥 Action & Adventure Movies",
    endpoint:"/discover/movie?with_genres=28,12&sort_by=popularity.desc", type:"movie" },

  { id:"comedy-movies", title:"😂 Comedy Movies",
    endpoint:"/discover/movie?with_genres=35&sort_by=popularity.desc", type:"movie" },

  { id:"horror-movies", title:"👻 Horror & Thriller Movies",
    endpoint:"/discover/movie?with_genres=27,53&sort_by=popularity.desc", type:"movie" },

  { id:"romance-movies", title:"❤️ Romance Movies",
    endpoint:"/discover/movie?with_genres=10749&sort_by=popularity.desc", type:"movie" },

  { id:"scifi-movies", title:"🚀 Sci-Fi & Fantasy Movies",
    endpoint:"/discover/movie?with_genres=878,14&sort_by=popularity.desc", type:"movie" },

  { id:"crime-series", title:"🕵️ Crime & Mystery Series",
    endpoint:"/discover/tv?with_genres=80,9648&sort_by=popularity.desc", type:"tv" },

  { id:"documentary-series", title:"📽️ Documentary Series",
    endpoint:"/discover/tv?with_genres=99&sort_by=popularity.desc", type:"tv" },

  { id:"movies-2024", title:"🎬 2024 Movies",
    endpoint:"/discover/movie?primary_release_year=2024&sort_by=popularity.desc", type:"movie" },

  { id:"movies-2023", title:"🎬 2023 Movies",
    endpoint:"/discover/movie?primary_release_year=2023&sort_by=vote_average.desc&vote_count.gte=500", type:"movie" },

  { id:"upcoming-movies", title:"🆕 Upcoming Movies",
    endpoint:"/movie/upcoming", type:"movie" },

  { id:"now-playing", title:"🎥 Now Playing in Theaters",
    endpoint:"/movie/now_playing", type:"movie" },

  { id:"airing-today", title:"📡 TV Shows Airing Today",
    endpoint:"/tv/airing_today", type:"tv" },

  { id:"classic-movies", title:"🎞️ Classic Movies (1980-2000)",
    endpoint:"/discover/movie?primary_release_date.gte=1980-01-01&primary_release_date.lte=2000-12-31&sort_by=vote_average.desc&vote_count.gte=1000", type:"movie" }
];

/* Helper to add page parameter safely */
function addPageParam(endpoint, page) {
  const sep = endpoint.includes("?") ? "&" : "?";
  return `${endpoint}${sep}page=${page}`;
}

/* RENDER SECTION */
async function renderSection(section) {
  const wrap = document.getElementById("sections-container");
  
  const sectionDiv = document.createElement('div');
  sectionDiv.className = 'mb-10 section-wrapper';
  sectionDiv.id = `section-${section.id}`;
  sectionDiv.innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-xl font-semibold">${section.title}</h2>
      <button class="text-red-500 hover:underline"
              data-more="${section.id}">More ›</button>
    </div>
    <div id="${section.id}-row" class="flex overflow-x-auto space-x-3 pb-2">
      ${createSkeleton()}${createSkeleton()}${createSkeleton()}${createSkeleton()}
    </div>
  `;
  
  wrap.appendChild(sectionDiv);

  const row = document.getElementById(`${section.id}-row`);

  if (section.custom === 'hindi-ott-curated') {
    sectionDiv.querySelector(`[data-more="${section.id}"]`)?.classList.add('hidden');
    await renderHindiOttCurated(row);
    return;
  }

  const initialPages = Math.max(1, section.pages || 1);
  let aggregatedResults = [];

  for (let page = 1; page <= initialPages; page++) {
    const data = await tmdbFetch(addPageParam(section.endpoint, page));
    if (data?.results?.length) {
      aggregatedResults = aggregatedResults.concat(data.results);
    }
  }

  if (!aggregatedResults.length) {
    row.innerHTML = `<p class="text-gray-400 text-sm">Failed to load.</p>`;
    return;
  }

  const uniqueResults = aggregatedResults.filter(item => {
    if (ALL_LOADED_IDS.has(item.id)) return false;
    ALL_LOADED_IDS.add(item.id);
    return true;
  });
  let filtered = filterBanned(uniqueResults);
  if (section.id === 'hindi-premieres') {
    const today = new Date().toISOString().split('T')[0];
    filtered = filtered.filter(item => {
      const dateStr = (item.release_date || item.first_air_date || '').split('T')[0];
      return dateStr && dateStr <= today;
    });
  }
  filtered.forEach(cacheTitle);
  row.innerHTML = filtered.length ? filtered.map(it => makeCard(it, section.type)).join("") : `<p class="text-gray-400 text-sm">Nothing to show right now. Check back soon!</p>`;

  enableSectionRowScroll(section, row, initialPages);
}

async function renderHindiOttCurated(rowEl) {
  if (!rowEl) return;
  rowEl.className = 'flex flex-col gap-5 w-full';
  rowEl.innerHTML = '';

  for (const category of HINDI_CATEGORY_CONFIG) {
    const entries = CURATED_HINDI_SERIES.filter(item => item.category === category.id);
    if (!entries.length) continue;

    const block = document.createElement('div');
    block.className = 'bg-gray-900/70 border border-gray-800 rounded-2xl p-4';
    block.innerHTML = `
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <p class="text-sm uppercase tracking-wide text-gray-300">${category.emoji} ${category.title}</p>
          <p class="text-xs text-gray-500">${entries.length} hand-picked series</p>
        </div>
        <p class="text-xs text-gray-500">${category.tagline}</p>
      </div>
      <div class="flex overflow-x-auto gap-3 pt-3 pb-2" data-category-list="${category.id}">
        ${createSkeleton()}${createSkeleton()}${createSkeleton()}
      </div>
    `;
    rowEl.appendChild(block);

    const listEl = block.querySelector(`[data-category-list="${category.id}"]`);
    const details = await Promise.all(entries.map(fetchHindiSeriesDetail));
    const cards = details.map((detail, idx) => detail ? makeCard(detail, 'tv') : createHindiPlaceholderCard(entries[idx]));
    listEl.innerHTML = cards.join('');
  }
}

function enableSectionRowScroll(section, row, initialPage = 1) {
  if (!row) return;
  SECTION_PAGINATION.set(section.id, { page: initialPage, loading: false, done: false });
  row.addEventListener('scroll', () => handleSectionRowScroll(section, row));
}

async function handleSectionRowScroll(section, row) {
  const state = SECTION_PAGINATION.get(section.id);
  if (!state || state.loading || state.done) return;
  const nearEnd = row.scrollLeft + row.clientWidth >= row.scrollWidth - 200;
  if (!nearEnd) return;
  state.loading = true;
  const nextPage = state.page + 1;
  try {
    const data = await tmdbFetch(addPageParam(section.endpoint, nextPage));
    let newItems = data?.results || [];
    newItems = newItems.filter(item => {
      if (ALL_LOADED_IDS.has(item.id)) return false;
      ALL_LOADED_IDS.add(item.id);
      return true;
    });
    newItems = filterBanned(newItems);
    newItems.forEach(cacheTitle);
    if (!newItems.length) {
      state.done = true;
    } else {
      row.insertAdjacentHTML('beforeend', newItems.map(item => makeCard(item, section.type)).join(''));
      state.page = nextPage;
    }
  } catch (error) {
    console.warn(`Failed to extend section ${section.id}`, error);
    state.done = true;
  }
  state.loading = false;
}

/* -----------------------------------------------------
    FOR YOU RAIL
----------------------------------------------------- */
function getLocalLibrary(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '{}');
    return Object.values(raw);
  } catch {
    return [];
  }
}

function collectPreferenceSeeds() {
  const watchlist = getLocalLibrary('ourshow_watchlist');
  const watchlater = getLocalLibrary('ourshow_watchlater');
  return [...watchlist, ...watchlater]
    .filter(item => item && (item.id || item.tmdbId))
    .sort((a, b) => (b.time || 0) - (a.time || 0));
}

async function buildRecommendationsFromSeeds(seeds = []) {
  const recMap = new Map();
  const limitedSeeds = seeds.slice(0, 4);

  for (const seed of limitedSeeds) {
    const itemId = seed.id || seed.tmdbId;
    const mediaType = seed.type === 'tv' ? 'tv' : 'movie';
    if (!itemId) continue;
    const randomPage = Math.floor(Math.random() * 3) + 1;
    const endpoint = `/${mediaType}/${itemId}/similar?page=${randomPage}`;
    try {
      const res = await tmdbFetch(endpoint);
      const results = filterBanned(res?.results || []);
      results.forEach(result => {
        if (!recMap.has(result.id)) {
          recMap.set(result.id, { ...result, media_type: result.media_type || mediaType });
        }
      });
    } catch (error) {
      console.warn('For You seed fetch failed:', error);
    }
    if (recMap.size >= 30) break;
  }
  return Array.from(recMap.values());
}

async function loadForYouRail(forceShuffle = false) {
  const row = document.getElementById('for-you-row');
  const empty = document.getElementById('for-you-empty');
  const hint = document.getElementById('for-you-hint');
  if (!row) return;
  row.innerHTML = `${createSkeleton()}${createSkeleton()}${createSkeleton()}${createSkeleton()}${createSkeleton()}`;

  let seeds = collectPreferenceSeeds();
  if (forceShuffle) {
    seeds = seeds.sort(() => Math.random() - 0.5);
  }

  let recommendations = await buildRecommendationsFromSeeds(seeds);

  if (!recommendations.length) {
    const fallback = await tmdbFetch('/trending/all/day');
    recommendations = filterBanned(fallback?.results || []).map(item => ({
      ...item,
      media_type: item.media_type || item.type || 'movie'
    }));
    empty?.classList.remove('hidden');
    hint?.classList.remove('hidden');
  } else {
    empty?.classList.add('hidden');
    hint?.classList.add('hidden');
  }

  recommendations = recommendations.slice(0, 15);
  recommendations.forEach(cacheTitle);

  row.innerHTML = recommendations.length
    ? recommendations.map(item => makeCard(item, item.media_type || item.type || 'movie')).join('')
    : `<p class="text-gray-400 text-sm">Nothing to recommend yet.</p>`;
}

function setupForYouSection() {
  const refreshBtn = document.getElementById('refresh-for-you');
  refreshBtn?.addEventListener('click', () => loadForYouRail(true));
  loadForYouRail();
}

async function ensureSectionRendered(sectionIdentifier) {
  const targetId = sectionIdentifier.startsWith('section-') ? sectionIdentifier : `section-${sectionIdentifier}`;
  let element = document.getElementById(targetId);
  if (element) return element;

  const targetIndex = SECTIONS.findIndex(section => `section-${section.id}` === targetId);
  if (targetIndex === -1) return null;

  const previousLoading = IS_LOADING;
  IS_LOADING = true;

  const existingLoadBtn = document.getElementById('load-more-btn');
  existingLoadBtn?.remove();

  try {
    while (!element && LOADED_SECTIONS <= targetIndex && LOADED_SECTIONS < SECTIONS.length) {
      await renderSection(SECTIONS[LOADED_SECTIONS]);
      LOADED_SECTIONS++;
      element = document.getElementById(targetId);
    }
  } finally {
    IS_LOADING = previousLoading;
  }

  if (LOADED_SECTIONS < SECTIONS.length) {
    addLoadMoreButton();
  }

  return element || null;
}

async function scrollToSection(sectionId) {
  try {
    const targetId = sectionId.startsWith('section-') ? sectionId : `section-${sectionId}`;
    let el = document.getElementById(targetId) || document.getElementById(sectionId);
    if (!el) {
      el = await ensureSectionRendered(targetId);
    }
    if (!el) {
      console.warn('[Heading] Section not found:', sectionId);
      showToast?.('Section not available yet. Try again later.');
      return;
    }
    const top = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: 'smooth' });
  } catch (error) {
    console.error('Failed to scroll to section:', error);
  }
}

function getHeadingsData() {
  const base = [
    { id: 'for-you-section', title: '🎯 For You' },
    { id: 'collections-section', title: '🎛️ Collections' }
  ];
  const sectionEntries = SECTIONS.map(section => ({
    id: `section-${section.id}`,
    title: section.title
  }));
  return [...base, ...sectionEntries];
}

function setupBestHeadingsRow() {
  const row = document.getElementById('best-headings-row');
  if (!row) return;
  row.innerHTML = BEST_CATEGORY_SHORTCUTS.map(shortcut => `
    <button class="px-4 py-2 rounded-full bg-gray-800 border border-gray-700 hover:border-red-400 text-sm flex-shrink-0"
            data-jump="${shortcut.id}">
      ${shortcut.emoji} ${shortcut.label}
    </button>
  `).join('');
  row.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-jump]');
    if (!btn) return;
    scrollToSection(btn.dataset.jump);
  });
  const seeAllBtn = document.getElementById('best-headings-scroll');
  seeAllBtn?.addEventListener('click', () => {
    document.getElementById('headings-toggle')?.click();
  });
}

function setupHeadingsMenu() {
  const toggle = document.getElementById('headings-toggle');
  const overlay = document.getElementById('headings-overlay');
  const closeBtn = document.getElementById('close-headings-overlay');
  const listEl = document.getElementById('headings-list');
  const searchInput = document.getElementById('headings-search');

  if (!toggle || !overlay || !listEl) return;

  const renderList = (query = '') => {
    const q = query.toLowerCase();
    const items = getHeadingsData().filter(item => item.title.toLowerCase().includes(q));
    listEl.innerHTML = items.map(item => `
      <button class="text-left bg-gray-800/60 border border-gray-700 hover:border-red-400 rounded-xl px-4 py-3 transition flex items-center gap-3"
              data-jump-id="${item.id}">
        <span class="flex-1">${esc(item.title)}</span>
        <span class="text-red-400 text-sm">Go →</span>
      </button>
    `).join('');
  };

  const showOverlay = () => {
    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
    renderList(searchInput?.value || '');
    searchInput?.focus();
  };

  const hideOverlay = () => {
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
  };

  toggle.addEventListener('click', showOverlay);
  closeBtn?.addEventListener('click', hideOverlay);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) hideOverlay();
  });
  listEl.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-jump-id]');
    if (!btn) return;
    hideOverlay();
    scrollToSection(btn.dataset.jumpId);
  });
  searchInput?.addEventListener('input', (event) => {
    renderList(event.target.value);
  });
}

function setupTopListOverlay() {
  const toggle = document.getElementById('toplist-toggle');
  const overlay = document.getElementById('toplist-overlay');
  const closeBtn = document.getElementById('close-toplist-overlay');
  const grid = document.getElementById('toplist-grid');

  if (!toggle || !overlay || !grid) return;

  const renderCards = () => {
    grid.innerHTML = TOPLIST_PRESETS.map(preset => `
      <div class="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-3">
        <div class="flex items-center justify-between gap-3">
          <div class="text-lg font-semibold">${preset.emoji} ${esc(preset.title)}</div>
          <span class="text-xs uppercase tracking-wide text-amber-200">${esc(preset.vibe)} vibe</span>
        </div>
        <p class="text-sm text-gray-400">${esc(preset.description)}</p>
        <div class="flex flex-wrap gap-2 text-xs">
          ${preset.tags.map(tag => `<span class="px-2 py-1 rounded-full border border-gray-700 bg-gray-800/80">${esc(tag)}</span>`).join('')}
        </div>
        <div class="space-y-2">
          ${preset.rows.map(row => `
            <button class="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 hover:border-red-400 transition"
                    data-toplist-target="${row.target}">
              <span>${esc(row.label)}</span>
              <span class="text-red-400 text-sm">Go →</span>
            </button>
          `).join('')}
        </div>
      </div>
    `).join('');
  };

  const showOverlay = () => {
    renderCards();
    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
  };

  const hideOverlay = () => {
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
  };

  toggle.addEventListener('click', showOverlay);
  closeBtn?.addEventListener('click', hideOverlay);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) hideOverlay();
  });
  grid.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-toplist-target]');
    if (!btn) return;
    hideOverlay();
    scrollToSection(btn.dataset.toplistTarget);
  });
}

/* RENDER HOME PAGE */
async function renderHome() {
  const wrap = document.getElementById("sections-container");
  wrap.innerHTML = "";
  ALL_LOADED_IDS.clear();
  LOADED_SECTIONS = 0;

  const initialLoad = Math.min(5, SECTIONS.length);
  for (let i = 0; i < initialLoad; i++) {
    await renderSection(SECTIONS[i]);
    LOADED_SECTIONS++;
  }

  if (LOADED_SECTIONS < SECTIONS.length) {
    addLoadMoreButton();
  }
}

async function openFullSection(section) {
  CURRENT_SECTION = section;
  CURRENT_PAGE = 1;
  CURRENT_CONTEXTUAL_PRESET_ID = 'all';
  CURRENT_CONTEXTUAL_FILTERS = getContextualFilters(section.id);
  showPage("page-all");
  document.getElementById("all-title").textContent = section.title;
  renderContextualFilterBar(section);
  await renderAllPage({ reset: true });
}

function renderContextualFilterBar(section) {
  const bar = document.getElementById('contextual-filter-bar');
  const pills = document.getElementById('contextual-filter-pills');
  const desc = document.getElementById('contextual-filter-description');
  if (!bar || !pills) return;
  const filters = CURRENT_CONTEXTUAL_FILTERS.length ? CURRENT_CONTEXTUAL_FILTERS : getContextualFilters(section.id);
  if (!filters.length) {
    bar.classList.add('hidden');
    pills.innerHTML = '';
    desc.textContent = '';
    return;
  }
  bar.classList.remove('hidden');
  pills.innerHTML = filters.map(filter => `
    <button class="px-3 py-1 rounded-full border text-xs font-semibold ${filter.id === CURRENT_CONTEXTUAL_PRESET_ID ? 'bg-red-600 border-red-500' : 'bg-gray-800 border-gray-700'}"
            data-context-filter="${filter.id}">
      ${esc(filter.label)}
    </button>
  `).join('');
  const active = filters.find(f => f.id === CURRENT_CONTEXTUAL_PRESET_ID) || filters[0];
  desc.textContent = active?.description || '';
}

async function renderAllPage({ append = false } = {}) {
  const grid = document.getElementById("all-content");
  if (!CURRENT_SECTION || !grid) return;
  const filters = CURRENT_CONTEXTUAL_FILTERS.length ? CURRENT_CONTEXTUAL_FILTERS : getContextualFilters(CURRENT_SECTION.id);
  if (!filters.length) CURRENT_CONTEXTUAL_FILTERS = DEFAULT_CONTEXTUAL_FILTERS;
  const preset = filters.find(f => f.id === CURRENT_CONTEXTUAL_PRESET_ID) || filters[0];
  CURRENT_CONTEXTUAL_PRESET_ID = preset.id;
  const params = preset.buildParams ? preset.buildParams(CURRENT_SECTION) : (preset.params || {});
  const endpoint = buildEndpointWithParams(CURRENT_SECTION.endpoint, params, CURRENT_SECTION);
  CURRENT_CONTEXTUAL_ENDPOINT = endpoint;
  if (!append) {
    grid.innerHTML = '<p class="col-span-full text-center text-gray-400 text-sm py-4">Loading...</p>';
  }
  const data = await tmdbFetch(addPageParam(endpoint, CURRENT_PAGE));
  let items = filterBanned(data?.results || []);
  if (preset.transform) {
    try {
      items = preset.transform(items, CURRENT_SECTION, preset) || items;
    } catch (error) {
      console.warn('Contextual transform failed:', error);
    }
  }
  if (!items.length && !append) {
    grid.innerHTML = `<p class="text-gray-400 text-sm">No matches with this filter. Try another chip.</p>`;
    return;
  }
  const html = items.map(it => makeCard(it, it.media_type || CURRENT_SECTION.type)).join('');
  if (append) {
    grid.insertAdjacentHTML("beforeend", html);
  } else {
    grid.innerHTML = html;
  }
  renderContextualFilterBar(CURRENT_SECTION);
}

/* ADD LOAD MORE BUTTON */
function addLoadMoreButton() {
  const wrap = document.getElementById("sections-container");
  
  const existingBtn = document.getElementById('load-more-btn');
  if (existingBtn) existingBtn.remove();

  const btnDiv = document.createElement('div');
  btnDiv.id = 'load-more-btn';
  btnDiv.className = 'text-center my-8';
  btnDiv.innerHTML = `
    <button class="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 px-8 py-3 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105">
      Load More Content 🎬
    </button>
  `;
  
  wrap.appendChild(btnDiv);
  btnDiv.querySelector('button').addEventListener('click', loadMoreSections);
}

/* LOAD MORE SECTIONS */
async function loadMoreSections() {
  if (IS_LOADING || LOADED_SECTIONS >= SECTIONS.length) return;

  IS_LOADING = true;
  const btn = document.querySelector('#load-more-btn button');
  btn.textContent = 'Loading...';
  btn.disabled = true;

  const toLoad = Math.min(3, SECTIONS.length - LOADED_SECTIONS);
  for (let i = 0; i < toLoad; i++) {
    await renderSection(SECTIONS[LOADED_SECTIONS]);
    LOADED_SECTIONS++;
  }

  document.getElementById('load-more-btn').remove();
  
  if (LOADED_SECTIONS < SECTIONS.length) {
    addLoadMoreButton();
  } else {
    const wrap = document.getElementById("sections-container");
    const endDiv = document.createElement('div');
    endDiv.className = 'text-center my-8 text-gray-400';
    endDiv.innerHTML = `
      <p class="text-lg mb-2">🎉 You've reached the end!</p>
      <p class="text-sm">That's all the amazing content we have for now</p>
      <button onclick="window.scrollTo({top:0,behavior:'smooth'})" 
              class="mt-4 text-red-500 hover:underline">
        ↑ Back to Top
      </button>
    `;
    wrap.appendChild(endDiv);
  }

  IS_LOADING = false;
}

/* INFINITE SCROLL */
let scrollTimeout;
window.addEventListener('scroll', () => {
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    const scrollPosition = window.innerHeight + window.scrollY;
    const pageHeight = document.documentElement.scrollHeight;
    
    if (scrollPosition >= pageHeight * 0.8 && !IS_LOADING && LOADED_SECTIONS < SECTIONS.length) {
      loadMoreSections();
    }
  }, 200);
});

/* -----------------------------------------------------
    QUICK ADD FUNCTIONS
----------------------------------------------------- */
window.quickAddToWatchlist = async function(id, title, type) {
  const db = window.dbMod;
  const auth = window.authMod;
  
  if (!auth || !auth.currentUser) {
    alert("Please log in to add to watchlist");
    return;
  }
  
  const userId = auth.currentUser.uid;

  try {
    if (!ref || !set) await initModularFirebase();

    const watchlistRef = ref(db, `ourshow/users/${userId}/watchlist/${id}`);
    await set(watchlistRef, { id, title, type, time: Date.now() });

    const localWatchlist = JSON.parse(localStorage.getItem('ourshow_watchlist') || '{}');
    localWatchlist[id] = { id, title, type, time: Date.now() };
    localStorage.setItem('ourshow_watchlist', JSON.stringify(localWatchlist));

    showToast(`✅ Added "${title}" to Watchlist`);
    updateWatchlistCount();
  } catch (error) {
    showToast("❌ Failed to add to watchlist");
  }
};

window.quickAddToWatchLater = async function(id, title, type) {
  const db = window.dbMod;
  const auth = window.authMod;
  
  if (!auth || !auth.currentUser) {
    alert("Please log in");
    return;
  }
  
  const userId = auth.currentUser.uid;

  try {
    const watchLaterRef = ref(db, `ourshow/users/${userId}/watchlater/${id}`);
    await set(watchLaterRef, { id, title, type, time: Date.now() });

    const localWatchLater = JSON.parse(localStorage.getItem('ourshow_watchlater') || '{}');
    localWatchLater[id] = { id, title, type, time: Date.now() };
    localStorage.setItem('ourshow_watchlater', JSON.stringify(localWatchLater));

    showToast(`✅ Added "${title}" to Watch Later`);
    updateWatchLaterCount();
  } catch (error) {
    showToast("❌ Failed to add");
  }
};

/* TOAST NOTIFICATION */
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'fixed bottom-4 right-4 bg-gray-800 text-white px-6 py-3 rounded-lg shadow-lg z-[9999] animate-pulse';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.5s ease-out';
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}

function isDesktopDevice() {
  return !/android|iphone|ipad|ipod/i.test(navigator.userAgent || '');
}

function tryLaunchDeepLink(url, timeout = 1800) {
  return new Promise((resolve) => {
    if (SUPPORTS_MS_LAUNCH) {
      navigator.msLaunchUri(url, () => resolve(true), () => resolve(false));
      return;
    }

    let settled = false;
    let timer;
    const cleanup = () => {
      settled = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('pagehide', handleBlur);
      link?.remove();
    };

    const handleSuccess = () => {
      if (settled) return;
      cleanup();
      resolve(true);
    };

    const handleFail = () => {
      if (settled) return;
      cleanup();
      resolve(false);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        handleSuccess();
      }
    };

    const handleBlur = () => {
      // Some browsers blur window when switching to the app
      handleSuccess();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur, { once: true });
    window.addEventListener('pagehide', handleBlur, { once: true });

    timer = setTimeout(() => {
      if (document.visibilityState === 'hidden') return;
      handleFail();
    }, timeout);

    if (IS_SAFARI) {
      window.location.href = url;
      return;
    }

    const link = document.createElement('a');
    link.href = url;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
  });
}

window.launchWatchNow = function launchWatchNow() {
  const item = window.currentModalItem;
  if (isDesktopDevice()) {
    window.open(WATCH_PC_LINK, '_blank', 'noopener');
    return;
  }
  if (!item) {
    window.location.href = WATCH_PC_LINK;
    return;
  }
  const deepLink = `${PPCINE_SCHEME_BASE}?id=${item.id}&type=${item.type || 'movie'}`;
  showToast('🎬 Opening PP Cine…');
  tryLaunchDeepLink(deepLink).then((opened) => {
    if (opened) return;
    showToast('⬇️ Install PP Cine to continue');
    window.location.href = PPCINE_DOWNLOAD_URL;
  });
};

/* -----------------------------------------------------
    RANDOM MOVIE FEATURE
----------------------------------------------------- */
window.getRandomMovie = async function(forceType) {
  const type = forceType || (LAST_RANDOM_TYPE === 'movie' ? 'tv' : 'movie');
  LAST_RANDOM_TYPE = type;
  const label = type === 'movie' ? 'movie' : 'series';
  showToast(`🎲 Surfacing a random ${label}...`);
  const page = Math.floor(Math.random() * 10) + 1;
  const endpoint = type === 'movie'
    ? `/discover/movie?vote_average.gte=7.0&vote_count.gte=500&sort_by=popularity.desc&page=${page}`
    : `/discover/tv?vote_average.gte=7.0&vote_count.gte=300&sort_by=popularity.desc&page=${page}`;
  const data = await tmdbFetch(endpoint);
  if (data?.results?.length) {
    const pick = data.results[Math.floor(Math.random() * data.results.length)];
    openModal(pick.id, type);
  }
};

/* -----------------------------------------------------
    PAGE SWITCHER
----------------------------------------------------- */
function showPage(id) {
  document.querySelectorAll(".spa-page").forEach(p => p.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
}

/* SEARCH */
function setupSearchAutocomplete() {
  const input = document.getElementById("search-input");
  const suggestionsBox = document.getElementById("search-suggestions");

  if (!input || !suggestionsBox) return;

  let debounce;
  input.addEventListener('input', (e) => {
    const value = e.target.value.trim();
    clearTimeout(debounce);
    if (!value) {
      suggestionsBox.classList.add('hidden');
      suggestionsBox.innerHTML = '';
      return;
    }
    debounce = setTimeout(() => fetchSuggestions(value), 180);
  });

  document.addEventListener('click', (evt) => {
    if (!suggestionsBox.contains(evt.target) && evt.target !== input) {
      suggestionsBox.classList.add('hidden');
    }
  });

  suggestionsBox.addEventListener('click', (evt) => {
    const choice = evt.target.closest('[data-suggestion-id]');
    const fillTarget = evt.target.closest('[data-fill-text]');
    if (!choice && !fillTarget) return;
    if (choice) {
      const id = choice.dataset.suggestionId;
      const type = choice.dataset.mediaType || 'movie';
      if (id) openModal(id, type);
      suggestionsBox.classList.add('hidden');
    } else if (fillTarget?.dataset.fillText) {
      suggestionsBox.classList.add('hidden');
      performSearch(fillTarget.dataset.fillText);
    }
  });
}

async function fetchSuggestions(query) {
  const suggestionsBox = document.getElementById("search-suggestions");
  if (!suggestionsBox) return;

  try {
    if (suggestionAbortController) suggestionAbortController.abort();
    suggestionAbortController = new AbortController();
    const data = await tmdbFetch(`/search/multi?query=${encodeURIComponent(query)}&page=1`, {
      signal: suggestionAbortController.signal
    });
    if (!data?.results) {
      suggestionsBox.classList.add('hidden');
      return;
    }
    const items = filterBanned(data.results || [])
      .filter(item => ['movie', 'tv'].includes(item.media_type))
      .slice(0, 7);
    items.forEach(cacheTitle);
    renderSuggestions(items, query);
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.warn('Suggestion fetch failed', err);
    }
  }
}

function renderSuggestions(items, query) {
  const suggestionsBox = document.getElementById("search-suggestions");
  if (!suggestionsBox) return;
  if (!items.length) {
    suggestionsBox.innerHTML = `<p class="px-4 py-3 text-sm text-gray-400">No matches yet… try another title.</p>`;
    suggestionsBox.classList.remove('hidden');
    return;
  }

  const suggestion = getSpellingSuggestion(query);
  const listHtml = items.map(item => {
    const img = item.poster_path ? `${IMAGE}/w185${item.poster_path}` : SAFE_PLACEHOLDER;
    const title = esc(item.title || item.name || 'Untitled');
    const year = (item.release_date || item.first_air_date || 'N/A').split('-')[0];
    return `
      <button class="w-full flex gap-3 px-4 py-3 hover:bg-gray-800 transition items-center text-left"
              data-suggestion-id="${item.id}" data-media-type="${item.media_type}">
        <img src="${img}" alt="${title}" class="w-10 h-14 object-cover rounded">
        <div class="flex-1">
          <p class="font-semibold">${title}</p>
          <p class="text-xs text-gray-400">${item.media_type === 'tv' ? 'Series' : 'Movie'} • ${year}</p>
        </div>
      </button>
    `;
  }).join('');

  const spellingHtml = suggestion ? `
    <div class="px-4 py-2 border-t border-gray-800 text-xs text-gray-400">
      Did you mean 
      <button class="text-red-400 underline ml-1" data-fill-text="${esc(suggestion)}">${suggestion}</button>?
    </div>
  ` : '';

  suggestionsBox.innerHTML = listHtml + spellingHtml;
  suggestionsBox.classList.remove('hidden');
}
async function performSearch(query) {
  const q = (query || '').trim();
  if (!q) return;
  const input = document.getElementById("search-input");
  if (input) input.value = q;

  showPage("page-search");
  const data = await tmdbFetch(`/search/multi?query=${encodeURIComponent(q)}&page=1`);
  let results = data?.results || [];
  results = filterBanned(results);
  results.forEach(cacheTitle);

  document.getElementById("search-content").innerHTML =
    results.length
      ? results.map(it => makeCard(it, it.media_type || "movie")).join("")
      : `<p class="text-gray-400">No results found.</p>`;
}

const searchInput = document.getElementById("search-input");
if (searchInput) {
  searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      performSearch(e.target.value);
    }
  });
}

function setupSortOptions() {
  document.querySelectorAll('#sort-options .sort-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#sort-options .sort-pill').forEach(b => b.classList.remove('active-sort'));
      btn.classList.add('active-sort');
      CURRENT_SORT_MODE = btn.dataset.sort || 'trending';
      loadSortShowcase(CURRENT_SORT_MODE);
    });
  });

  const clearBtn = document.getElementById('clear-sort-showcase');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      document.getElementById('sort-showcase')?.classList.add('hidden');
      document.getElementById('sort-grid').innerHTML = '';
      document.querySelectorAll('#sort-options .sort-pill').forEach(b => b.classList.remove('active-sort'));
    });
  }
}

async function loadSortShowcase(mode = 'trending') {
  const config = SORT_CONFIG[mode];
  if (!config) return;
  const grid = document.getElementById('sort-grid');
  const section = document.getElementById('sort-showcase');
  if (!grid || !section) return;

  grid.innerHTML = `<p class="col-span-full text-gray-400 text-sm">Loading ${config.title}…</p>`;
  section.querySelector('h3').textContent = config.title;
  section.classList.remove('hidden');

  const data = await tmdbFetch(config.endpoint);
  let items = filterBanned(data?.results || []);
  if (!items.length) {
    grid.innerHTML = `<p class="text-gray-400 text-sm">No data found.</p>`;
    return;
  }
  items = items.slice(0, 10);
  items.forEach(cacheTitle);
  grid.innerHTML = items.map(item => makeCard(item, item.media_type || 'movie')).join('');
}

function setupFiltersPanel() {
  const toggleBtn = document.getElementById('filters-toggle');
  const panel = document.getElementById('filters-panel');
  const applyBtn = document.getElementById('apply-filters');
  const resetBtn = document.getElementById('reset-filters');
  const closeBtn = document.getElementById('close-filters-results');

  if (!applyBtn) {
    console.error('[Filter] Apply button not found!');
    return;
  }

  toggleBtn?.addEventListener('click', () => panel?.classList.toggle('hidden'));
  closeBtn?.addEventListener('click', () => {
    document.getElementById('filters-results')?.classList.add('hidden');
  });
  
  applyBtn.addEventListener('click', (e) => {
    e.preventDefault();
    console.log('[Filter] Apply button clicked');
    applyFiltersFromPanel({ sourceBtn: applyBtn });
  });
  
  resetBtn?.addEventListener('click', () => {
    ['genre','year','rating','language','runtime','type'].forEach(key => {
      const el = document.getElementById(`filter-${key}`);
      if (el) el.value = key === 'type' ? 'both' : '';
    });
    document.getElementById('filters-results')?.classList.add('hidden');
     updateFiltersSummaryDisplay({
       genre: '',
       year: '',
       rating: '',
       language: '',
       runtime: '',
       type: 'both'
     });
  });
  
  console.log('[Filter] Filter panel setup complete');
}

async function applyFiltersFromPanel(options = {}) {
  const { sourceBtn } = options;
  // Check if tmdbFetch is available
  if (typeof tmdbFetch === 'undefined') {
    console.error('tmdbFetch is not available. Make sure config.js is loaded.');
    const grid = document.getElementById('filters-grid');
    const wrap = document.getElementById('filters-results');
    if (grid && wrap) {
      wrap.classList.remove('hidden');
      grid.innerHTML = '<p class="text-red-400 text-sm text-center py-4">Error: API configuration not loaded. Please refresh the page.</p>';
    }
    return;
  }

  const filters = {
    genre: document.getElementById('filter-genre')?.value || '',
    year: document.getElementById('filter-year')?.value || '',
    rating: document.getElementById('filter-rating')?.value || '',
    language: document.getElementById('filter-language')?.value || '',
    runtime: document.getElementById('filter-runtime')?.value || '',
    type: document.getElementById('filter-type')?.value || 'both'
  };

  const grid = document.getElementById('filters-grid');
  const wrap = document.getElementById('filters-results');
  const meta = document.getElementById('filters-meta');

  if (!grid || !wrap) {
    console.error('Filter elements not found:', { grid: !!grid, wrap: !!wrap });
    alert('Filter elements not found. Please refresh the page.');
    return;
  }

  updateFiltersSummaryDisplay(filters);

  const hasSelection = filters.genre || filters.year || filters.rating || filters.language || filters.runtime || (filters.type && filters.type !== 'both');
  if (!hasSelection) {
    wrap.classList.remove('hidden');
    meta?.classList.remove('hidden');
    if (meta) meta.textContent = 'Tip: Pick at least one dropdown to generate personalized matches.';
    grid.innerHTML = `<p class="text-yellow-400 text-sm text-center py-4">Pick at least one filter option to get tailored matches.</p>`;
    scrollToFiltersResults();
    return;
  }

  if (sourceBtn) {
    sourceBtn.disabled = true;
    sourceBtn.textContent = 'Applying...';
  }

  wrap.classList.remove('hidden');
  if (meta) {
    meta.classList.remove('hidden');
    meta.textContent = 'Crunching TMDB filters...';
  }
  grid.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">Loading filtered results...</p>';

  const allResults = [];
  const typesToSearch = filters.type === 'both' ? ['movie', 'tv'] : [filters.type];
  const pagesToFetch = (filters.rating || filters.year) ? 3 : 2;

  try {
    for (const mediaType of typesToSearch) {
      const params = buildFilterQuery(mediaType, filters);
      const queryString = params.toString();
      console.log(`[Filter] Fetching ${mediaType} with query:`, queryString);
      const batch = await fetchFilteredBatch(mediaType, queryString, pagesToFetch);
      if (batch.length) {
        allResults.push(...batch);
        console.log(`[Filter] Added ${batch.length} ${mediaType} items`);
      }
    }

    console.log(`[Filter] Total results before filtering: ${allResults.length}`);

    if (allResults.length === 0) {
      const fallback = await tmdbFetch('/trending/all/day?page=1');
      const fallbackItems = filterBanned(fallback?.results || []).slice(0, 15);
      if (fallbackItems.length) {
        fallbackItems.forEach(item => cacheTitle(item));
        grid.innerHTML = fallbackItems.map(item => makeCard(item, item.media_type || item.type || 'movie')).join('');
        if (meta) meta.textContent = 'No exact matches, showing trending alternatives instead.';
      } else {
        grid.innerHTML = `<p class="text-gray-400 text-sm text-center py-4">No matches found. Try relaxing your filters or selecting different options.</p>`;
        if (meta) meta.textContent = 'Try mixing a different genre/year or switch between Movies and Series.';
      }
      scrollToFiltersResults();
      return;
    }

    const filteredItems = dedupeMediaItems(filterBanned(allResults))
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 30);
    console.log(`[Filter] Results after filtering banned items: ${filteredItems.length}`);
    filteredItems.forEach(cacheTitle);
    
    if (filteredItems.length === 0) {
      grid.innerHTML = `<p class="text-gray-400 text-sm text-center py-4">No family-safe matches found. Try adjusting your filters.</p>`;
      return;
    }
    
    grid.innerHTML = filteredItems.map(item => makeCard(item, item.media_type || 'movie')).join('');
    console.log(`[Filter] Successfully displayed ${filteredItems.length} filtered items`);
    if (meta) {
      meta.textContent = `${filteredItems.length} curated match${filteredItems.length === 1 ? '' : 'es'} across ${typesToSearch.includes('movie') && typesToSearch.includes('tv') ? 'movies & series' : typesToSearch[0] === 'movie' ? 'movies' : 'series'}.`;
    }
    scrollToFiltersResults();
    
  } catch (error) {
    console.error('[Filter] Unexpected error:', error);
    grid.innerHTML = `<p class="text-red-400 text-sm text-center py-4">Error: ${error.message || 'Failed to load results'}. Please try again.</p>`;
    if (meta) meta.textContent = 'Something went wrong while contacting TMDB. Please retry in a moment.';
  } finally {
    if (sourceBtn) {
      sourceBtn.disabled = false;
      sourceBtn.textContent = 'Apply Filters';
    }
  }
}

function setupSurpriseButtons() {
  ['surprise-btn-header', 'mobile-surprise-btn'].forEach(id => {
    const btn = document.getElementById(id);
    btn?.addEventListener('click', () => window.getRandomMovie());
  });
}

/* COLLECTIONS */
function loadCollections() {
  const raw = JSON.parse(localStorage.getItem(COLLECTIONS_KEY) || '[]');
  COLLECTIONS = Array.isArray(raw) ? raw : Object.values(raw);
  renderCollections();
}

function saveCollections() {
  localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(COLLECTIONS));
}

function renderCollections() {
  const list = document.getElementById('collections-list');
  if (!list) return;
  if (!COLLECTIONS.length) {
    list.innerHTML = `<p class="text-sm text-gray-400">No collections yet. Create your first vibe!</p>`;
    return;
  }
  list.innerHTML = COLLECTIONS.map(collection => `
    <div class="p-4 rounded-xl border border-gray-700 bg-gray-800 flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <div>
          <p class="font-semibold">${esc(collection.name)}</p>
          <p class="text-xs text-gray-400">${esc(collection.description || '')}</p>
        </div>
        <span class="text-[10px] uppercase tracking-wide text-gray-400">${collection.visibility}</span>
      </div>
      <p class="text-xs text-gray-400">${collection.items?.length || 0} titles saved</p>
      <div class="flex flex-wrap gap-2">
        <button class="px-3 py-1 text-xs rounded bg-blue-600/20 border border-blue-500/40 hover:bg-blue-600/30"
                onclick="shareCollection('${collection.id}')">Share</button>
        <button class="px-3 py-1 text-xs rounded bg-gray-700 border border-gray-600"
                onclick="copyCollectionLink('${collection.id}')">Copy Link</button>
      </div>
    </div>
  `).join('');
}

function setupCollectionsActions() {
  const createBtn = document.getElementById('create-collection');
  createBtn?.addEventListener('click', () => {
    const name = document.getElementById('collection-name')?.value.trim();
    const description = document.getElementById('collection-description')?.value.trim();
    const visibility = document.getElementById('collection-visibility')?.value || 'private';
    if (!name) {
      alert('Name your playlist first!');
      return;
    }
    const newCollection = {
      id: `col_${Date.now()}`,
      name,
      description,
      visibility,
      owner: window.authMod?.currentUser?.uid || 'guest',
      items: []
    };
    COLLECTIONS.push(newCollection);
    saveCollections();
    renderCollections();
    document.getElementById('collection-name').value = '';
    document.getElementById('collection-description').value = '';
    showToast(`🎉 "${name}" ready! Add picks from any modal.`);
  });

  const shareAllBtn = document.getElementById('share-all-collections');
  shareAllBtn?.addEventListener('click', () => {
    const text = COLLECTIONS.length
      ? COLLECTIONS.map(col => `${col.name}: ${col.items?.length || 0} titles`).join('\n')
      : 'No collections yet.';
    if (navigator.share) {
      navigator.share({ title: 'My OurShow Collections', text })
        .catch(() => copyToClipboard(text));
    } else {
      copyToClipboard(text);
    }
  });
}

window.shareCollection = function(collectionId) {
  const collection = COLLECTIONS.find(c => c.id === collectionId);
  if (!collection) return;
  const text = `🎬 ${collection.name} on OurShow\n${collection.description || ''}\nTitles: ${(collection.items || []).length}`;
  if (navigator.share) {
    navigator.share({ title: collection.name, text }).catch(() => copyToClipboard(text));
  } else {
    copyToClipboard(text);
    showToast('Link copied!');
  }
};

window.copyCollectionLink = function(collectionId) {
  const url = `${window.location.origin}/?collection=${collectionId}`;
  copyToClipboard(url);
  showToast('Shareable link copied!');
};

function copyToClipboard(text) {
  navigator.clipboard?.writeText(text).catch(() => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  });
}

function attachCollectionPicker() {
  window.openCollectionPicker = function() {
    const picker = document.getElementById('collection-picker');
    if (!picker) return;
    renderCollectionPicker();
    picker.classList.toggle('hidden');
  };
}

/* SHARE */
window.shareCurrent = function(target) {
  const item = window.currentModalItem;
  if (!item) return;
  const url = `${window.location.origin}/?media=${item.type}&id=${item.id}`;
  const text = `Check out ${item.title} on OurShow: ${url}`;

  if (target === 'copy') {
    copyToClipboard(text);
    showToast('Link copied!');
    return;
  }

  if (target === 'email') {
    window.location.href = `mailto:?subject=Watch ${encodeURIComponent(item.title)}&body=${encodeURIComponent(text)}`;
    return;
  }

  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(`Watch ${item.title} on OurShow`);
  const routes = {
    whatsapp: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
  };

  if (routes[target]) {
    window.open(routes[target], '_blank');
  } else if (navigator.share) {
    navigator.share({ title: item.title, text, url }).catch(()=>copyToClipboard(text));
  } else {
    copyToClipboard(text);
  }
};

function renderCollectionPicker() {
  const pickerList = document.getElementById('collection-picker-list');
  if (!pickerList) return;
  if (!COLLECTIONS.length) {
    pickerList.innerHTML = `<p class="text-xs text-gray-400">Create a collection first.</p>`;
    return;
  }
  pickerList.innerHTML = COLLECTIONS.map(col => `
    <button class="w-full flex justify-between items-center px-3 py-2 rounded bg-gray-700/50 hover:bg-gray-700"
            onclick="addItemToCollection('${col.id}')">
      <span>${esc(col.name)}</span>
      <span class="text-xs text-gray-400">${col.items?.length || 0}</span>
    </button>
  `).join('');
}

window.addItemToCollection = function(collectionId) {
  const item = window.currentModalItem;
  if (!item) return alert('Open a movie/show first.');
  const collection = COLLECTIONS.find(c => c.id === collectionId);
  if (!collection) return;
  collection.items = collection.items || [];
  if (!collection.items.find(existing => existing.id === item.id)) {
    collection.items.push({
      id: item.id,
      title: item.title,
      type: item.type
    });
    saveCollections();
    renderCollections();
    renderCollectionPicker();
    showToast(`📂 Added to "${collection.name}"`);
  } else {
    showToast('Already in that collection.');
  }
};

/* ASK AI */
let aiBusy = false;

window.toggleAiPanel = function() {
  document.getElementById('ai-panel')?.classList.toggle('hidden');
};

window.askAiAboutCurrent = async function(promptText) {
  if (aiBusy) return;
  const item = window.currentModalItem;
  const chatBody = document.getElementById('ai-chat-body');
  if (!item || !chatBody) return;

  const prompt = promptText || document.getElementById('ai-question-input')?.value.trim();
  if (!prompt) {
    alert('Ask something specific about the title.');
    return;
  }

  aiBusy = true;
  const userBubble = document.createElement('div');
  userBubble.className = 'p-3 rounded-lg bg-gray-700 mb-2 text-sm';
  userBubble.textContent = `🧑‍💻 ${prompt}`;
  chatBody.appendChild(userBubble);

  const thinking = document.createElement('div');
  thinking.className = 'p-3 rounded-lg bg-gray-800 mb-2 text-sm text-gray-400';
  thinking.textContent = '🤖 Thinking...';
  chatBody.appendChild(thinking);
  chatBody.scrollTop = chatBody.scrollHeight;

  try {
    const fullPrompt = `You are OurShow AI. User is viewing "${item.title}" (${item.type}). ${prompt}`;
    const reply = await geminiCall(fullPrompt) || 'I could not fetch Gemini right now.';
    thinking.textContent = reply;
  } catch (err) {
    thinking.textContent = 'Gemini is unavailable right now.';
  } finally {
    aiBusy = false;
    const input = document.getElementById('ai-question-input');
    if (input) input.value = '';
  }
};

/* NOTIFICATIONS */
function setupNotificationUI() {
  const bell = document.getElementById('notification-bell');
  const panel = document.getElementById('notifications-panel');
  const markBtn = document.getElementById('mark-notifications-read');

  bell?.addEventListener('click', () => {
    panel?.classList.toggle('hidden');
  });

  markBtn?.addEventListener('click', markNotificationsRead);

  document.addEventListener('click', (evt) => {
    if (!panel || !bell) return;
    if (!panel.contains(evt.target) && !bell.contains(evt.target)) {
      panel.classList.add('hidden');
    }
  });
}

function renderNotifications() {
  const list = document.getElementById('notifications-list');
  const countEl = document.getElementById('notification-count');
  if (!list || !countEl) return;

  if (!NOTIFICATIONS.length) {
    list.innerHTML = `<p class="text-xs text-gray-400 px-4 py-4">No alerts yet. Interact with the community to get updates.</p>`;
    countEl.classList.add('hidden');
    return;
  }

  list.innerHTML = NOTIFICATIONS.slice().reverse().map(note => `
    <div class="px-4 py-3 text-sm ${note.read ? 'text-gray-400' : 'text-white'}">
      <p>${esc(note.message)}</p>
      <p class="text-xs text-gray-500 mt-1">${new Date(note.time).toLocaleString()}</p>
    </div>
  `).join('');

  UNREAD_NOTIFICATIONS = NOTIFICATIONS.filter(n => !n.read).length;
  if (UNREAD_NOTIFICATIONS > 0) {
    countEl.textContent = UNREAD_NOTIFICATIONS;
    countEl.classList.remove('hidden');
  } else {
    countEl.classList.add('hidden');
  }
}

function markNotificationsRead() {
  const userId = window.authMod?.currentUser?.uid;
  if (!userId) return;
  NOTIFICATIONS = NOTIFICATIONS.map(n => ({ ...n, read: true }));
  renderNotifications();
  const db = window.dbMod;
  if (db) {
    const updates = {};
    NOTIFICATIONS.forEach(note => updates[note.id] = { ...note, read: true });
    update(ref(db, `ourshow/notifications/${userId}`), updates).catch(()=>{});
  }
}

async function subscribeToNotifications() {
  const auth = window.authMod;
  const db = window.dbMod;
  const userId = auth?.currentUser?.uid;
  if (notificationsListenerAttached) return;
  if (!db || !userId || !onValue) {
    setTimeout(subscribeToNotifications, 1500);
    return;
  }

  const notificationsRef = ref(db, `ourshow/notifications/${userId}`);
  notificationsListenerAttached = true;
  onValue(notificationsRef, (snapshot) => {
    const temp = [];
    snapshot.forEach(child => temp.push({ id: child.key, ...child.val() }));
    NOTIFICATIONS = temp;
    renderNotifications();
  });
}

async function createNotification(targetUserId, message, meta = {}) {
  if (!targetUserId || !message) return;
  const db = window.dbMod;
  if (!db || !push) return;
  try {
    const notesRef = ref(db, `ourshow/notifications/${targetUserId}`);
    await push(notesRef, {
      message,
      time: Date.now(),
      read: false,
      ...meta
    });
  } catch (err) {
    console.warn('Notification push failed', err);
  }
}

async function monitorWatchlistEpisodes() {
  const auth = window.authMod;
  const userId = auth?.currentUser?.uid;
  if (!userId) {
    setTimeout(monitorWatchlistEpisodes, 2000);
    return;
  }
  const localWatchlist = JSON.parse(localStorage.getItem('ourshow_watchlist') || '{}');
  const shows = Object.values(localWatchlist).filter(item => item.type === 'tv').slice(0, 5);
  for (const show of shows) {
    const cacheKey = `ourshow_episode_seen_${show.id}`;
    const lastSeen = localStorage.getItem(cacheKey);
    const data = await tmdbFetch(`/tv/${show.id}`);
    const latest = data?.last_episode_to_air?.air_date;
    if (latest && latest !== lastSeen) {
      await createNotification(userId, `New episode of ${show.title} just aired!`, { type: 'episode', itemId: show.id });
      localStorage.setItem(cacheKey, latest);
    }
  }
}

/* "More ›" SECTION PAGE */
document.body.addEventListener("click", async (e) => {
  const moreBtn = e.target.closest('[data-more]');
  if (!moreBtn) return;
  const section = SECTIONS.find(x => x.id === moreBtn.dataset.more);
  if (!section) return;
  await openFullSection(section);
});

// Back to Home button
const backHome = document.getElementById("back-home");
if (backHome) {
  backHome.addEventListener("click", () => showPage("page-home"));
}

// Infinite scroll for "All" page
const allContent = document.getElementById("all-content");
if (allContent) {
  allContent.addEventListener("scroll", async () => {
    if (!CURRENT_SECTION) return;
    const e = allContent;
    if (e.scrollLeft + e.clientWidth >= e.scrollWidth - 100) {
      CURRENT_PAGE++;
      await renderAllPage({ append: true });
    }
  });
}

const contextualFilterPills = document.getElementById('contextual-filter-pills');
if (contextualFilterPills) {
  contextualFilterPills.addEventListener('click', async (event) => {
    const pill = event.target.closest('[data-context-filter]');
    if (!pill || !CURRENT_SECTION) return;
    const selectedId = pill.dataset.contextFilter;
    if (selectedId === CURRENT_CONTEXTUAL_PRESET_ID) return;
    CURRENT_CONTEXTUAL_PRESET_ID = selectedId;
    CURRENT_PAGE = 1;
    await renderAllPage({ reset: true });
  });
}

/* -----------------------------------------------------
    MODAL WITH FULL REVIEW SYSTEM
----------------------------------------------------- */
const modal = document.getElementById("detail-modal");
const modalContent = document.getElementById("modal-content");
const closeModal = document.getElementById("close-modal");

if (closeModal) {
  closeModal.onclick = () => modal.classList.add("hidden");
}

document.body.addEventListener("click", async (e) => {
  const c = e.target.closest("[data-id]");
  if (!c) return;

  openModal(c.dataset.id, c.dataset.type || "movie");
});

async function openModal(id, type) {
  // Add to recently viewed
  addToRecentlyViewed(id, type);
  
  const res = await tmdbFetch(`/${type}/${id}?append_to_response=videos,credits,similar`);
  if (!res) {
    modalContent.innerHTML = `<p class="text-red-500">Failed to load details.</p>`;
    modal.classList.remove("hidden");
    return;
  }

  const trailer = res.videos?.results?.find(v => v.type === "Trailer" && v.site === "YouTube");
  const trailerUrl = trailer ? `https://www.youtube.com/embed/${trailer.key}` : "";

  const isTV = type === "tv";
  const seasons = res.number_of_seasons || "N/A";
  const episodes = res.number_of_episodes || "N/A";
  const episodeRuntime = res.episode_run_time?.[0] || res.runtime || "N/A";

  let tvDetails = "";
  if (isTV) {
    tvDetails = `
      <p><b>Seasons:</b> ${esc(String(seasons))}</p>
      <p><b>Episodes:</b> ${esc(String(episodes))}</p>
      <p><b>Episode Runtime:</b> ${esc(String(episodeRuntime))} min</p>
    `;
  }

  window.currentModalItem = {
    id,
    type,
    title: res.title || res.name,
    overview: res.overview,
    posterUrl: res.poster_path ? `${IMAGE}/w500${res.poster_path}` : SAFE_PLACEHOLDER,
    year: (res.release_date || res.first_air_date || "").split("-")[0],
    rating: res.vote_average,
    popularity: res.popularity
  };

  modalContent.innerHTML = `
    <div class="p-4">
      <h2 class="text-2xl font-bold">${esc(res.title || res.name)}</h2>
      <p class="mt-2 text-gray-300">${esc(res.overview || "No description available.")}</p>

      <div class="mt-3 text-gray-400 text-sm">
        <p><b>Year:</b> ${esc((res.release_date || res.first_air_date || "").split("-")[0])}</p>
        <p><b>Rating:</b> ⭐ ${res.vote_average?.toFixed(1) || "N/A"}</p>
        <p><b>Popularity:</b> 🔥 ${Math.round(res.popularity || 0)}</p>
        ${!isTV ? `<p><b>Runtime:</b> ${res.runtime || "N/A"} min</p>` : tvDetails}
      </div>

      <div class="mt-4 flex gap-2 flex-wrap">
        <button onclick="addToWatchlist()" class="bg-red-600 px-3 py-1 rounded hover:bg-red-700">➕ Watchlist</button>
        <button onclick="addToWatchLater()" class="bg-blue-600 px-3 py-1 rounded hover:bg-blue-700">🕒 Watch Later</button>
        <button onclick="scrollReviewsIntoView()" class="bg-green-600 px-3 py-1 rounded hover:bg-green-700">💬 Reviews</button>
        <button onclick="openCollectionPicker()" class="bg-purple-600 px-3 py-1 rounded hover:bg-purple-700">📂 Collections</button>
        <button onclick="toggleAiPanel()" class="bg-gray-700 px-3 py-1 rounded hover:bg-gray-600">🤖 Ask AI</button>
        <button onclick="launchWatchNow()" class="bg-orange-500 px-3 py-1 rounded hover:bg-orange-600 flex items-center gap-1">
          ▶️ Watch Now
        </button>
        <a href="watch&download.html" target="_blank" class="bg-orange-600 px-3 py-1 rounded hover:bg-orange-700 flex items-center gap-1">📥 Download & Mirrors</a>
      </div>

      <div id="collection-picker" class="hidden mt-3 bg-gray-800 p-3 rounded">
        <p class="text-sm text-gray-400 mb-2">Choose a playlist:</p>
        <div id="collection-picker-list" class="space-y-2"></div>
      </div>

      <div id="ai-panel" class="hidden mt-4 bg-gray-800 p-4 rounded-lg">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-semibold">🤖 Gemini Insights</h3>
          <button onclick="toggleAiPanel()" class="text-xs text-gray-400 hover:text-red-400">Close</button>
        </div>
        <div class="flex flex-wrap gap-2 mb-3">
          ${['Is it worth watching?', 'Plot summary?', 'Best scenes?'].map(q => `
            <button class="px-3 py-1 rounded bg-gray-700 text-xs hover:bg-gray-600" onclick="askAiAboutCurrent('${q}')">${q}</button>
          `).join('')}
        </div>
        <div id="ai-chat-body" class="bg-gray-900 rounded p-3 max-h-48 overflow-y-auto text-sm space-y-2"></div>
        <div class="mt-3 flex gap-2">
          <input id="ai-question-input" class="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm" placeholder="Ask anything about this title...">
          <button onclick="askAiAboutCurrent()" class="bg-red-600 px-4 py-2 rounded">Send</button>
        </div>
      </div>

      ${trailerUrl ? `<iframe class="mt-4 w-full h-48 rounded" src="${trailerUrl}" allowfullscreen allow="autoplay"></iframe>` : ""}

      ${res.credits?.cast && res.credits.cast.length > 0 ? `
        <h3 class="text-lg font-semibold mt-6">Top Cast</h3>
        <div class="flex gap-3 overflow-x-auto pb-2">
          ${res.credits.cast.slice(0, 10).map(c => `
            <div class="w-20 text-center flex-shrink-0">
              <img src="${c.profile_path ? IMAGE + '/w300' + c.profile_path : SAFE_PROFILE}"
                   alt="${esc(c.name)}"
                   onerror="this.src='${SAFE_PROFILE}'"
                   class="rounded-full w-16 h-16 object-cover mx-auto">
              <p class="text-xs mt-1 truncate">${esc(c.name)}</p>
            </div>
          `).join("")}
        </div>
      ` : ""}

      ${res.similar?.results && res.similar.results.length > 0 ? `
        <h3 class="text-lg font-semibold mt-6">Similar</h3>
        <div class="flex gap-3 overflow-x-auto pb-2">
          ${res.similar.results.slice(0, 8).map(it => makeCard(it, it.media_type || type)).join("")}
        </div>
      ` : ""}

      <!-- ENHANCED REVIEW SECTION -->
      <div class="mt-6 bg-gray-800 p-4 rounded-lg">
        <h3 class="text-lg font-semibold mb-3">📝 Write a Review</h3>
        
        <!-- Quick Rating -->
        <div class="mb-3">
          <label class="block mb-2 text-sm">Quick Rating:</label>
          <div class="flex gap-2 flex-wrap">
            <button onclick="selectQuickRating('👎 Bad')" class="quick-rating-btn px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded">👎 Bad</button>
            <button onclick="selectQuickRating('👌 One-time Watch')" class="quick-rating-btn px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded">👌 One-time</button>
            <button onclick="selectQuickRating('🙂 Satisfactory')" class="quick-rating-btn px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded">🙂 Satisfactory</button>
            <button onclick="selectQuickRating('👍 Good')" class="quick-rating-btn px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded">👍 Good</button>
            <button onclick="selectQuickRating('🔥 Perfection')" class="quick-rating-btn px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded">🔥 Perfection</button>
          </div>
        </div>

        <!-- Detailed Review -->
        <div class="mb-3">
          <label class="block mb-2 text-sm">Your Detailed Review (Optional):</label>
          <textarea id="review-text" 
                    placeholder="Share your thoughts about this ${isTV ? 'show' : 'movie'}... What did you like? What could be better?"
                    class="w-full bg-gray-700 p-3 rounded text-white text-sm"
                    rows="4"
                    maxlength="1000"></textarea>
          <p class="text-xs text-gray-500 mt-1"><span id="review-char-count">0</span>/1000 characters</p>
        </div>

        <input type="hidden" id="quick-rating-value" value="">
        
        <button onclick="submitFullReview()"
                class="bg-red-600 px-4 py-2 rounded hover:bg-red-700 w-full font-semibold">
          Submit Review
        </button>
      </div>

      <!-- REVIEWS DISPLAY SECTION -->
      <div id="reviews-section" class="mt-6 bg-gray-800 p-4 rounded-lg">
        <h3 class="text-lg font-semibold mb-3">💬 User Reviews</h3>
        <div id="reviews-list">
          <p class="text-gray-400 text-sm">Loading reviews...</p>
        </div>
      </div>

      <div class="mt-6 bg-gray-800 p-4 rounded-lg">
        <h3 class="text-lg font-semibold mb-3">🔗 Share with friends</h3>
        <div class="flex flex-wrap gap-2">
          <button class="px-3 py-2 rounded bg-green-600/20 border border-green-500/40" onclick="shareCurrent('whatsapp')">WhatsApp</button>
          <button class="px-3 py-2 rounded bg-blue-600/20 border border-blue-500/40" onclick="shareCurrent('facebook')">Facebook</button>
          <button class="px-3 py-2 rounded bg-cyan-600/20 border border-cyan-500/40" onclick="shareCurrent('twitter')">Twitter</button>
          <button class="px-3 py-2 rounded bg-gray-700 border border-gray-600" onclick="shareCurrent('email')">Recommend to friend</button>
          <button class="px-3 py-2 rounded bg-gray-700 border border-gray-600" onclick="shareCurrent('copy')">Copy link</button>
        </div>
      </div>
    </div>
  `;

  // Add character counter
  const reviewTextArea = document.getElementById('review-text');
  const charCount = document.getElementById('review-char-count');
  if (reviewTextArea && charCount) {
    reviewTextArea.addEventListener('input', () => {
      charCount.textContent = reviewTextArea.value.length;
    });
  }

  modal.classList.remove("hidden");
  
  // Load existing reviews
  loadReviewsInModal(id);
}

/* SELECT QUICK RATING */
window.selectQuickRating = function(rating) {
  document.getElementById('quick-rating-value').value = rating;
  
  // Visual feedback - highlight selected button
  document.querySelectorAll('.quick-rating-btn').forEach(btn => {
    btn.classList.remove('bg-red-600');
    btn.classList.add('bg-gray-700');
  });
  
  event.target.classList.remove('bg-gray-700');
  event.target.classList.add('bg-red-600');
};

/* SUBMIT FULL REVIEW */
window.submitFullReview = async function() {
  const item = window.currentModalItem;
  if (!item) return alert("No item selected");

  const quickRating = document.getElementById("quick-rating-value").value;
  const reviewText = document.getElementById("review-text").value.trim();

  if (!quickRating && !reviewText) {
    return alert("Please select a rating or write a review");
  }

  const db = window.dbMod;
  const userId = window.authMod?.currentUser?.uid;
  const userName = window.authMod?.currentUser?.displayName || "Anonymous";
  const userEmail = window.authMod?.currentUser?.email || "";
  
  if (!userId) {
    return alert("Please log in to submit a review");
  }

  try {
    const reviewsRef = ref(db, `ourshow/reviews/${item.id}`);
    await push(reviewsRef, {
      quickRating: quickRating || "No quick rating",
      reviewText: reviewText || "No detailed review",
      title: item.title,
      userId: userId,
      userName: userName,
      userEmail: userEmail,
      time: Date.now(),
      likes: 0,
      likedBy: {}
    });

    showToast("✅ Review submitted successfully!");
    
    // Clear form
    document.getElementById("quick-rating-value").value = "";
    document.getElementById("review-text").value = "";
    document.getElementById("review-char-count").textContent = "0";
    document.querySelectorAll('.quick-rating-btn').forEach(btn => {
      btn.classList.remove('bg-red-600');
      btn.classList.add('bg-gray-700');
    });
    
    // Reload reviews
    loadReviewsInModal(item.id);
  } catch (error) {
    console.error("Review error:", error);
    alert("Failed to add review: " + error.message);
  }
};

/* LOAD REVIEWS IN MODAL */
window.loadReviewsInModal = async function(id) {
  const db = window.dbMod;
  const reviewsList = document.getElementById("reviews-list");
  
  if (!db) {
    reviewsList.innerHTML = '<p class="text-gray-400 text-sm">Database not available</p>';
    return;
  }

  try {
    const reviewsRef = ref(db, `ourshow/reviews/${id}`);
    const snapshot = await get(reviewsRef);
    
    if (!snapshot.exists()) {
      reviewsList.innerHTML = '<p class="text-gray-400 text-sm">No reviews yet. Be the first to review!</p>';
      return;
    }

    const reviews = [];
    snapshot.forEach((childSnapshot) => {
      reviews.push({
        id: childSnapshot.key,
        ...childSnapshot.val()
      });
    });

    // Sort by time (newest first)
    reviews.sort((a, b) => b.time - a.time);

    reviewsList.innerHTML = reviews.map(review => {
      const date = new Date(review.time).toLocaleDateString();
      const isOwn = window.authMod?.currentUser?.uid === review.userId;
      const likeCount = review.likes || 0;
      const hasLiked = window.authMod?.currentUser?.uid && review.likedBy && review.likedBy[window.authMod.currentUser.uid];
      
      return `
        <div class="review-item bg-gray-700/50 p-4 rounded-lg mb-3 border border-gray-600">
          <div class="flex items-start justify-between mb-2">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-full bg-gradient-to-r from-red-500 to-pink-500 flex items-center justify-center font-bold text-sm">
                ${review.userName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p class="font-semibold text-sm">${esc(review.userName)}</p>
                <p class="text-xs text-gray-400">${date}</p>
              </div>
            </div>
            ${isOwn ? `
              <button onclick="deleteReview('${id}', '${review.id}')" 
                      class="text-red-400 hover:text-red-300 text-xs">
                🗑️ Delete
              </button>
            ` : ''}
          </div>
          
          <div class="mb-2">
            <span class="inline-block bg-gray-600 px-3 py-1 rounded-full text-sm font-semibold">
              ${review.quickRating}
            </span>
          </div>
          
          ${review.reviewText !== "No detailed review" ? `
            <p class="text-gray-300 text-sm whitespace-pre-wrap">${esc(review.reviewText)}</p>
          ` : ''}
          
          <div class="flex items-center gap-4 mt-3 pt-3 border-t border-gray-600">
            <button onclick="likeReview('${id}', '${review.id}')" 
                    class="flex items-center gap-1 text-sm ${hasLiked ? 'text-red-500' : 'text-gray-400'} hover:text-red-400">
              ${hasLiked ? '❤️' : '🤍'} ${likeCount > 0 ? likeCount : ''}
            </button>
            <button onclick="showComments('${id}', '${review.id}')" 
                    class="flex items-center gap-1 text-sm text-gray-400 hover:text-blue-400">
              💬 Comments
            </button>
          </div>
          
          <!-- Comments Section -->
          <div id="comments-${review.id}" class="hidden mt-3 pt-3 border-t border-gray-600">
            <div id="comments-list-${review.id}" class="space-y-2 mb-3">
              <!-- Comments will be loaded here -->
            </div>
            <div class="flex gap-2">
              <input type="text" 
                     id="comment-input-${review.id}" 
                     placeholder="Add a comment..."
                     class="flex-1 bg-gray-600 px-3 py-2 rounded text-sm"
                     maxlength="200">
              <button onclick="addComment('${id}', '${review.id}')" 
                      class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm">
                Post
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error("Error loading reviews:", error);
    reviewsList.innerHTML = '<p class="text-red-400 text-sm">Failed to load reviews</p>';
  }
};

/* LIKE REVIEW */
window.likeReview = async function(movieId, reviewId) {
  const db = window.dbMod;
  const userId = window.authMod?.currentUser?.uid;
  
  if (!userId) {
    return alert("Please log in to like reviews");
  }

  try {
    const { runTransaction } = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
    const reviewRef = ref(db, `ourshow/reviews/${movieId}/${reviewId}`);
    
    let addedLike = false;
    const result = await runTransaction(reviewRef, (review) => {
      if (review) {
        if (!review.likedBy) review.likedBy = {};
        if (!review.likes) review.likes = 0;
        
        if (review.likedBy[userId]) {
          // Unlike
          delete review.likedBy[userId];
          review.likes = Math.max(0, review.likes - 1);
        } else {
          // Like
          review.likedBy[userId] = true;
          review.likes = review.likes + 1;
          addedLike = true;
        }
      }
      return review;
    });
    
    if (addedLike) {
      const updated = result.snapshot?.val();
      const ownerId = updated?.userId;
      const title = updated?.title || 'your review';
      const currentUserName = window.authMod?.currentUser?.displayName || window.authMod?.currentUser?.email || 'Someone';
      if (ownerId && ownerId !== userId) {
        createNotification(ownerId, `${currentUserName} liked your review on ${title}.`, { type: 'like', itemId: movieId });
      }
    }

    loadReviewsInModal(movieId);
  } catch (error) {
    console.error("Error liking review:", error);
  }
};

/* DELETE REVIEW */
window.deleteReview = async function(movieId, reviewId) {
  if (!confirm("Are you sure you want to delete this review?")) return;
  
  const db = window.dbMod;
  const userId = window.authMod?.currentUser?.uid;
  
  if (!userId) return;

  try {
    const reviewRef = ref(db, `ourshow/reviews/${movieId}/${reviewId}`);
    const snapshot = await get(reviewRef);
    
    if (snapshot.exists() && snapshot.val().userId === userId) {
      await remove(reviewRef);
      showToast("✅ Review deleted");
      loadReviewsInModal(movieId);
    }
  } catch (error) {
    console.error("Error deleting review:", error);
  }
};

/* SHOW COMMENTS */
window.showComments = async function(movieId, reviewId) {
  const commentsDiv = document.getElementById(`comments-${reviewId}`);
  commentsDiv.classList.toggle('hidden');
  
  if (!commentsDiv.classList.contains('hidden')) {
    await loadComments(movieId, reviewId);
  }
};

/* LOAD COMMENTS */
async function loadComments(movieId, reviewId) {
  const db = window.dbMod;
  const commentsList = document.getElementById(`comments-list-${reviewId}`);
  
  try {
    const commentsRef = ref(db, `ourshow/reviews/${movieId}/${reviewId}/comments`);
    const snapshot = await get(commentsRef);
    
    if (!snapshot.exists()) {
      commentsList.innerHTML = '<p class="text-gray-500 text-xs">No comments yet</p>';
      return;
    }

    const comments = [];
    snapshot.forEach((childSnapshot) => {
      comments.push({
        id: childSnapshot.key,
        ...childSnapshot.val()
      });
    });

    comments.sort((a, b) => a.time - b.time);

    commentsList.innerHTML = comments.map(comment => {
      const isOwn = window.authMod?.currentUser?.uid === comment.userId;
      return `
        <div class="flex items-start gap-2 bg-gray-600/50 p-2 rounded">
          <div class="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center font-bold text-xs flex-shrink-0">
            ${comment.userName.charAt(0).toUpperCase()}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs font-semibold">${esc(comment.userName)}</p>
            <p class="text-xs text-gray-300">${esc(comment.text)}</p>
          </div>
          ${isOwn ? `
            <button onclick="deleteComment('${movieId}', '${reviewId}', '${comment.id}')" 
                    class="text-red-400 hover:text-red-300 text-xs">
              ✕
            </button>
          ` : ''}
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error("Error loading comments:", error);
  }
}

/* ADD COMMENT */
window.addComment = async function(movieId, reviewId) {
  const db = window.dbMod;
  const userId = window.authMod?.currentUser?.uid;
  const userName = window.authMod?.currentUser?.displayName || "Anonymous";
  
  if (!userId) {
    return alert("Please log in to comment");
  }

  const input = document.getElementById(`comment-input-${reviewId}`);
  const text = input.value.trim();
  
  if (!text) return;

  try {
    const commentsRef = ref(db, `ourshow/reviews/${movieId}/${reviewId}/comments`);
    await push(commentsRef, {
      text: text,
      userId: userId,
      userName: userName,
      time: Date.now()
    });
    
    input.value = '';
    await notifyReviewParticipants(movieId, reviewId, userName, userId);
    await loadComments(movieId, reviewId);
  } catch (error) {
    console.error("Error adding comment:", error);
  }
};

/* DELETE COMMENT */
window.deleteComment = async function(movieId, reviewId, commentId) {
  const db = window.dbMod;
  const userId = window.authMod?.currentUser?.uid;
  
  if (!userId) return;

  try {
    const commentRef = ref(db, `ourshow/reviews/${movieId}/${reviewId}/comments/${commentId}`);
    const snapshot = await get(commentRef);
    
    if (snapshot.exists() && snapshot.val().userId === userId) {
      await remove(commentRef);
      await loadComments(movieId, reviewId);
    }
  } catch (error) {
    console.error("Error deleting comment:", error);
  }
};

async function notifyReviewParticipants(movieId, reviewId, actorName, excludeUserId) {
  const db = window.dbMod;
  if (!db) return;
  try {
    const reviewRef = ref(db, `ourshow/reviews/${movieId}/${reviewId}`);
    const snapshot = await get(reviewRef);
    if (!snapshot.exists()) return;
    const review = snapshot.val();
    const targets = new Set();
    if (review.userId && review.userId !== excludeUserId) targets.add(review.userId);
    if (review.comments) {
      Object.values(review.comments).forEach(comment => {
        if (comment.userId && comment.userId !== excludeUserId) targets.add(comment.userId);
      });
    }
    for (const target of targets) {
      const title = review.title || 'this title';
      await createNotification(target, `${actorName} commented on ${title}.`, { type: 'comment', itemId: movieId });
    }
  } catch (err) {
    console.warn('notifyReviewParticipants failed', err);
  }
}

/* -----------------------------------------------------
    WATCHLIST & WATCH LATER FUNCTIONS
----------------------------------------------------- */
window.addToWatchlist = async function() {
  const item = window.currentModalItem;
  if (!item) return alert("No item selected");

  const db = window.dbMod;
  const auth = window.authMod;
  
  if (!auth || !auth.currentUser) {
    return alert("Please log in to add to watchlist");
  }
  
  const userId = auth.currentUser.uid;

  try {
    if (!ref || !set) await initModularFirebase();

    const watchlistRef = ref(db, `ourshow/users/${userId}/watchlist/${item.id}`);
    
    const itemData = {
      id: item.id,
      title: item.title,
      type: item.type || 'movie',
      posterUrl: item.posterUrl || '',
      overview: item.overview || '',
      year: item.year || 'N/A',
      rating: item.rating || 0,
      popularity: item.popularity || 0,
      time: Date.now()
    };
    
    await set(watchlistRef, itemData);

    const localWatchlist = JSON.parse(localStorage.getItem('ourshow_watchlist') || '{}');
    localWatchlist[item.id] = itemData;
    localStorage.setItem('ourshow_watchlist', JSON.stringify(localWatchlist));

    showToast(`✅ Added "${item.title}" to Watchlist`);
    updateWatchlistCount();
  } catch (error) {
    console.error("Watchlist error:", error);
    
    try {
      const localWatchlist = JSON.parse(localStorage.getItem('ourshow_watchlist') || '{}');
      localWatchlist[item.id] = {
        id: item.id,
        title: item.title,
        type: item.type || 'movie',
        posterUrl: item.posterUrl || '',
        time: Date.now()
      };
      localStorage.setItem('ourshow_watchlist', JSON.stringify(localWatchlist));
      showToast(`✅ Added "${item.title}" to Watchlist (saved locally)`);
      updateWatchlistCount();
    } catch (localError) {
      alert("Failed to add to watchlist");
    }
  }
};

window.addToWatchLater = async function() {
  const item = window.currentModalItem;
  if (!item) return alert("No item selected");

  const db = window.dbMod;
  const userId = window.authMod?.currentUser?.uid;
  
  if (!userId) {
    return alert("Please log in to add to watch later");
  }

  try {
    const watchLaterRef = ref(db, `ourshow/users/${userId}/watchlater/${item.id}`);
    await set(watchLaterRef, {
      id: item.id,
      title: item.title,
      type: item.type,
      posterUrl: item.posterUrl,
      overview: item.overview,
      year: item.year,
      rating: item.rating,
      popularity: item.popularity,
      time: Date.now()
    });

    const localWatchLater = JSON.parse(localStorage.getItem('ourshow_watchlater') || '{}');
    localWatchLater[item.id] = {
      id: item.id,
      title: item.title,
      type: item.type,
      posterUrl: item.posterUrl,
      time: Date.now()
    };
    localStorage.setItem('ourshow_watchlater', JSON.stringify(localWatchLater));

    showToast(`✅ Added "${item.title}" to Watch Later`);
    updateWatchLaterCount();
  } catch (error) {
    console.error("Watch Later error:", error);
    alert("Failed to add to watch later");
  }
};

function updateWatchlistCount() {
  try {
    const list = JSON.parse(localStorage.getItem('ourshow_watchlist') || '{}');
    const el = document.getElementById('watchlist-count');
    if (el) el.textContent = Object.keys(list).length;
  } catch (e) {
    console.error('Error updating watchlist count:', e);
  }
}

function updateWatchLaterCount() {
  try {
    const list = JSON.parse(localStorage.getItem('ourshow_watchlater') || '{}');
    const el = document.getElementById('watchlater-count');
    if (el) el.textContent = Object.keys(list).length;
  } catch (e) {
    console.error('Error updating watch later count:', e);
  }
}

/* -----------------------------------------------------
    RECENTLY VIEWED
----------------------------------------------------- */
function addToRecentlyViewed(id, type) {
  RECENTLY_VIEWED = RECENTLY_VIEWED.filter(item => item.id !== id);
  RECENTLY_VIEWED.unshift({ id, type, time: Date.now() });
  RECENTLY_VIEWED = RECENTLY_VIEWED.slice(0, 10);
  localStorage.setItem('ourshow_recent', JSON.stringify(RECENTLY_VIEWED));
}

/* -----------------------------------------------------
    KEYBOARD SHORTCUTS
----------------------------------------------------- */
document.addEventListener('keydown', (e) => {
  // Ignore if typing in input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  
  // '/' to focus search
  if (e.key === '/') {
    e.preventDefault();
    document.getElementById('search-input')?.focus();
  }
  
  // 'R' for random movie
  if (e.key === 'r' || e.key === 'R') {
    e.preventDefault();
    getRandomMovie();
  }
  
  // 'Escape' to close modal
  if (e.key === 'Escape') {
    modal.classList.add('hidden');
  }
});

/* -----------------------------------------------------
    INITIAL LOAD
----------------------------------------------------- */
async function init() {
  showPage("page-home");
  setupThemeControls();
  setupSearchAutocomplete();
  setupSortOptions();
  setupHeadingsMenu();
  setupTopListOverlay();
  setupBestHeadingsRow();
  setupForYouSection();
  loadSortShowcase(CURRENT_SORT_MODE);
  setupFiltersPanel();
  setupSurpriseButtons();
  setupNotificationUI();
  loadCollections();
  setupCollectionsActions();
  attachCollectionPicker();

  await renderHome();
  updateWatchlistCount();
  updateWatchLaterCount();
  if (window.location.hash === '#collections') {
    setTimeout(() => scrollToCollectionsSection({ behavior: 'smooth' }), 300);
  }
  setTimeout(() => {
    subscribeToNotifications();
    monitorWatchlistEpisodes();
  }, 1500);
  
  console.log('🔍 Firebase Status:');
  console.log('- Database:', window.dbMod ? '✅' : '❌');
  console.log('- Auth:', window.authMod ? '✅' : '❌');
  console.log('- User:', window.authMod?.currentUser?.email || 'Not logged in');
  console.log('🎮 Keyboard Shortcuts: "/" = Search, "R" = Random Movie, "Esc" = Close Modal');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

/* -----------------------------------------------------
    ADD CUSTOM STYLES FOR BADGES AND ANIMATIONS
----------------------------------------------------- */
const styleElement = document.createElement('style');
styleElement.textContent = `
  .badge {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: bold;
    text-transform: uppercase;
  }
  
  .quick-actions button {
    transition: transform 0.2s;
  }
  
  .quick-actions button:hover {
    transform: scale(1.1);
  }
  
  .movie-card {
    transition: transform 0.3s ease;
  }
  
  .movie-card:hover {
    z-index: 10;
  }
  
  @keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }
`;
document.head.appendChild(styleElement);
/* -----------------------------------------------------
    SURPRISE ME - SMART RECOMMENDATION FUNCTIONALITY
----------------------------------------------------- */

// Overwrite existing function with smarter version
window.getRandomMovie = async function () {
    try {
        showToast('ðŸŽ² Finding a surprise for you...');

        // Get user's watch history for personalized recommendations
        const watchedItems = JSON.parse(localStorage.getItem('ourshow_watched') || '{}');
        const watchlistItems = JSON.parse(localStorage.getItem('ourshow_watchlist') || '{}');

        let endpoint = '/trending/all/day';
        let recommendationType = 'trending';

        // If user has watch history, use personalized recommendations
        if (Object.keys(watchedItems).length > 0) {
            // Analyze user preferences
            const genres = {};
            const ratings = [];

            Object.values(watchedItems).forEach(item => {
                if (item.genres) {
                    item.genres.forEach(g => {
                        const genreName = typeof g === 'string' ? g : g.name;
                        genres[genreName] = (genres[genreName] || 0) + 1;
                    });
                }
                if (item.rating) ratings.push(item.rating);
            });

            // Find favorite genre
            const favoriteGenre = Object.keys(genres).sort((a, b) => genres[b] - genres[a])[0];

            // 40% chance: Recommend based on favorite genre
            if (favoriteGenre && Math.random() < 0.4) {
                const genreId = getGenreId(favoriteGenre);
                if (genreId) {
                    endpoint = `/discover/movie?with_genres=${genreId}&sort_by=vote_average.desc&vote_count.gte=500`;
                    recommendationType = `${favoriteGenre} movies`;
                }
            }
            // 30% chance: Highly rated content
            else if (Math.random() < 0.3) {
                endpoint = '/discover/movie?sort_by=vote_average.desc&vote_count.gte=1000&vote_average.gte=7.5';
                recommendationType = 'highly rated';
            }
            // 30% chance: Trending content
        }

        // Fetch recommendations
        const data = await tmdbFetch(endpoint);

        if (!data || !data.results || data.results.length === 0) {
            showToast('âŒ No recommendations available');
            return;
        }

        // Filter out already watched items
        let availableItems = data.results.filter(item =>
            !watchedItems[item.id] && !watchlistItems[item.id]
        );

        // If all items are watched, use all results
        if (availableItems.length === 0) {
            availableItems = data.results;
        }

        // Pick a random item
        const randomIndex = Math.floor(Math.random() * availableItems.length);
        const item = availableItems[randomIndex];

        // Determine type
        const type = item.media_type || (item.first_air_date ? 'tv' : 'movie');

        // Show the detail modal
        showToast(`ðŸŽ¬ Surprise! Here's a ${recommendationType} pick for you!`);
        // Use showDetail if available, otherwise openModal
        if (typeof showDetail === 'function') {
            await showDetail(item.id, type);
        } else if (typeof openModal === 'function') {
            openModal(item.id, type);
        }
    } catch (error) {
        console.error('Error getting random recommendation:', error);
        showToast('âŒ Failed to get surprise recommendation');
    }
};

// Helper function to get genre ID from name
function getGenreId(genreName) {
    const genreMap = {
        'Action': 28,
        'Adventure': 12,
        'Animation': 16,
        'Comedy': 35,
        'Crime': 80,
        'Documentary': 99,
        'Drama': 18,
        'Family': 10751,
        'Fantasy': 14,
        'History': 36,
        'Horror': 27,
        'Music': 10402,
        'Mystery': 9648,
        'Romance': 10749,
        'Science Fiction': 878,
        'TV Movie': 10770,
        'Thriller': 53,
        'War': 10752,
        'Western': 37
    };
    return genreMap[genreName] || null;
}

function setupSurpriseButtons() {
    console.log('ðŸŽ² Setting up surprise buttons...');
    // Mobile menu surprise button
    const mobileSurpriseBtn = document.getElementById('mobile-surprise-btn');
    if (mobileSurpriseBtn) {
        mobileSurpriseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.getRandomMovie();
            // Close mobile menu
            const mobileMenu = document.getElementById('mobile-menu');
            if (mobileMenu) mobileMenu.classList.add('hidden');
        });
        console.log('âœ… Mobile menu surprise button connected');
    }

    // Mobile header surprise button
    const mobileHeaderSurpriseBtn = document.getElementById('mobile-surprise-btn-header');
    if (mobileHeaderSurpriseBtn) {
        mobileHeaderSurpriseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.getRandomMovie();
        });
        console.log('âœ… Mobile header surprise button connected');
    }
}

// Initialize immediately
setupSurpriseButtons();
// Also try again on load just in case
window.addEventListener('DOMContentLoaded', setupSurpriseButtons);
