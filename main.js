// Import Firebase modules
import { auth, db, onAuthStateChanged, collection, addDoc, serverTimestamp, doc, setDoc } from './firebase-config.js';

// Import custom lists
import { CUSTOM_LISTS, REGIONAL_CONFIG } from './custom_lists.js';

// Global state variables
let currentUser = null;
let currentMovieId = null;
let currentMovieData = null;
let userRating = null;

// Initialize auth state listener
onAuthStateChanged(auth, (user) => {
    window.switchTab = switchTab;
    window.rateMovie = rateMovie;
    window.submitReview = submitReview;
    window.markAsWatched = markAsWatched;
    window.addToWatchLater = addToWatchLater;
    window.watchNow = watchNow;
    window.askAI = askAI;
    window.openMovieModal = openMovieModal;
    window.openSearch = openSearch;
    window.closeSearch = closeSearch;

    document.addEventListener('DOMContentLoaded', () => {
        initApp();
    });


    // --- API Helper ---
    async function fetchTMDB(endpoint, params = {}) {
        console.log(`Fetching TMDB: ${endpoint}`, params);
        if (!window.APP_CONFIG) {
            console.error("APP_CONFIG not loaded");
            return null;
        }

        const url = new URL(`${window.APP_CONFIG.TMDB_BASE_URL}${endpoint}`);
        url.searchParams.append('api_key', window.APP_CONFIG.TMDB_API_KEY);

        // Add default params
        url.searchParams.append('language', 'en-US');
        url.searchParams.append('include_adult', 'false');

        // Add custom params
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            const data = await response.json();
            console.log(`TMDB Success: ${endpoint}`, data);
            return data;
        } catch (error) {
            console.error('Fetch error:', error);
            return null;
        }
    }

    async function renderCustomList(containerId, listConfig, mediaType) {
        if (!listConfig) return;

        // If listConfig is an array of IDs (manual curation)
        if (Array.isArray(listConfig)) {
            // Not implemented for now, assuming query based
            return;
        }

        // If listConfig is a query object
        const data = await fetchTMDB('/discover/' + mediaType, listConfig);
        if (data) renderCards(data.results, containerId, mediaType);
    }

    async function initApp() {
        if (!window.APP_CONFIG) {
            console.error("Config not found!");
            return;
        }

        // Initialize theme system FIRST
        initThemeVibe();
        setupAppearanceUI();

        setupNavbar();
        setupSearch();

        await loadHeroContent();
        await loadTrending();
        await loadPopular();
        await loadTopRated();
        await loadUpcoming();
        await loadNowPlaying();
        await loadNepaliContent();
        await loadHindiContent();

        // New content rows
        await loadNewToStream();
        await loadHighestGrossing();
        await loadCultClassics();
        await loadUnderratedGems();
        await loadActionThrillers();
        await loadDramaRomance();

        // Add "More >>" links to section headings
        addMoreLinks();
    }

    // Add "More >>" links to section headings
    function addMoreLinks() {
        const sections = [
            { id: 'trendingScroller', category: 'trending', title: 'Trending Now' },
            { id: 'popularScroller', category: 'popular', title: 'Popular' },
            { id: 'topRatedScroller', category: 'top_rated', title: 'Top Rated' },
            { id: 'upcomingScroller', category: 'upcoming', title: 'Coming Soon' },
            { id: 'nowPlayingScroller', category: 'now_playing', title: 'Now in Theaters' },
            { id: 'nepaliScroller', category: 'nepali', title: 'Nepali Hits 🇳🇵' },
            { id: 'hindiScroller', category: 'hindi', title: 'Bollywood & Hindi 🇮🇳' },
            { id: 'newToStreamScroller', category: 'new_to_stream', title: 'New to Stream' },
            { id: 'highestGrossingScroller', category: 'highest_grossing', title: 'Highest Grossing (2020+)' },
            { id: 'cultClassicsScroller', category: 'cult_classics', title: 'Cult Classics' },
            { id: 'underratedGemsScroller', category: 'underrated_gems', title: 'Underrated Gems' },
            { id: 'actionThrillersScroller', category: 'action_thrillers', title: 'Action & Thrillers' },
            { id: 'dramaRomanceScroller', category: 'drama_romance', title: 'Drama & Romance' }
        ];

        sections.forEach(section => {
            const scroller = document.getElementById(section.id);
            if (scroller) {
                const sectionElement = scroller.closest('.content-section');
                const titleElement = sectionElement?.querySelector('.section-title');
                if (titleElement) {
                    const moreLink = document.createElement('a');
                    moreLink.href = `view_all.html?category=${section.category}`;
                    moreLink.textContent = 'More >>';
                    moreLink.style.cssText = 'margin-left: auto; font-size: 0.9rem; color: var(--primary-color); text-decoration: none; font-weight: 600;';
                    titleElement.style.display = 'flex';
                    titleElement.style.justifyContent = 'space-between';
                    titleElement.appendChild(moreLink);
                }
            }
        });
    }

    // --- UI Setup ---
    function setupNavbar() {
        const navbar = document.getElementById('navbar');
        const mobileBtn = document.getElementById('mobileMenuBtn');
        const navLinks = document.getElementById('navLinks');

        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });

        if (mobileBtn && navLinks) {
            mobileBtn.addEventListener('click', () => {
                navLinks.classList.toggle('active');
                const icon = mobileBtn.querySelector('i');
                if (navLinks.classList.contains('active')) {
                    icon.classList.remove('fa-bars');
                    icon.classList.add('fa-times');
                }

                // --- Movie Modal ---
                async function openMovieModal(id, type = 'movie') {
                    currentMovieId = id;
                    const modal = document.getElementById('movieModal');
                    modal.style.display = 'block';
                    document.body.style.overflow = 'hidden';

                    // Fetch movie details
                    const details = await fetchTMDB(`/${type}/${id}`, { append_to_response: 'videos,credits,reviews,similar' });
                    if (!details) return;

                    currentMovieData = details;
                    currentMovieData.media_type = type; // Ensure media type is set

                    // Update modal header
                    document.getElementById('modalPoster').src = `${window.APP_CONFIG.TMDB_IMAGE_SMALL_URL}${details.poster_path}`;
                    document.getElementById('modalTitle').textContent = details.title || details.name;
                    document.getElementById('modalRating').textContent = details.vote_average ? details.vote_average.toFixed(1) : 'N/A';
                    document.getElementById('modalYear').textContent = (details.release_date || details.first_air_date || '').split('-')[0];
                    document.getElementById('modalRuntime').textContent = details.runtime ? `${details.runtime} min` : '';
                    document.getElementById('modalOverview').textContent = details.overview;

                    // Load trailer
                    loadTrailer(details.videos);

                    // Load genres
                    loadGenres(details.genres);

                    // Load cast
                    loadCast(details.credits);

                    // Load reviews
                    loadReviews(details.reviews);

                    // Load similar
                    loadSimilar(details.similar);
                }

                function closeModal() {
                    document.getElementById('movieModal').style.display = 'none';
                    document.body.style.overflow = 'auto';
                    currentMovieId = null;
                    currentMovieData = null;
                }

                function switchTab(tabName) {
                    console.log(`Switching to tab: ${tabName}`);

                    // Hide all tabs
                    const tabs = document.querySelectorAll('.tab-content');
                    console.log(`Found ${tabs.length} tabs to hide`);
                    tabs.forEach(tab => {
                        tab.style.display = 'none';
                        tab.classList.remove('active');
                    });

                    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

                    // Show selected tab
                    const selectedTab = document.getElementById(`tab-${tabName}`);
                    if (selectedTab) {
                        console.log(`Found tab-${tabName}, setting display to block`);
                        selectedTab.style.display = 'block';
                        selectedTab.classList.add('active');
                    } else {
                        console.error(`Tab not found: tab-${tabName}`);
                        // List all available IDs for debugging
                        const allIds = Array.from(document.querySelectorAll('*[id]')).map(el => el.id);
                        console.log('Available IDs:', allIds.filter(id => id.startsWith('tab-')));
                    }

                    // Find and activate the corresponding button
                    const buttons = document.querySelectorAll('.tab-btn');
                    buttons.forEach(btn => {
                        if (btn.textContent.toLowerCase().includes(tabName.toLowerCase()) ||
                            (tabName === 'overview' && btn.textContent === 'Overview') ||
                            (tabName === 'cast' && btn.textContent === 'Cast & Crew') ||
                            (tabName === 'reviews' && btn.textContent === 'Reviews') ||
                            (tabName === 'similar' && btn.textContent === 'Similar') ||
                            (tabName === 'ai' && btn.textContent === 'Ask AI')) {
                            btn.classList.add('active');
                        }
                    });
                }

                function loadTrailer(videos) {
                    const trailerContainer = document.getElementById('modalTrailer');
                    if (!videos || !videos.results || videos.results.length === 0) {
                        trailerContainer.innerHTML = '';
                        return;
                    }

                    const trailer = videos.results.find(v => v.type === 'Trailer' && v.site === 'YouTube') || videos.results[0];
                    if (trailer) {
                        trailerContainer.innerHTML = `
            <div style="margin-bottom: 2rem;">
                <h3>Trailer</h3>
                <iframe width="100%" height="400" src="https://www.youtube.com/embed/${trailer.key}" 
                    frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen style="border-radius: 12px; margin-top: 1rem;"></iframe>
            </div>
        `;
                    }
                }

                function loadGenres(genres) {
                    const genresContainer = document.getElementById('modalGenres');
                    if (!genres || genres.length === 0) {
                        genresContainer.innerHTML = '';
                        return;
                    }

                    genresContainer.innerHTML = `
        <div style="margin-bottom: 1.5rem;">
            <strong>Genres:</strong> ${genres.map(g => g.name).join(', ')}
        </div>
    `;
                }

                function loadCast(credits) {
                    const castContainer = document.getElementById('modalCast');
                    if (!credits || !credits.cast || credits.cast.length === 0) {
                        castContainer.innerHTML = '<p>No cast information available.</p>';
                        return;
                    }

                    castContainer.innerHTML = credits.cast.slice(0, 12).map(person => `
        <div class="cast-card">
            <img src="${person.profile_path ? window.APP_CONFIG.TMDB_IMAGE_SMALL_URL + person.profile_path : 'https://via.placeholder.com/150x225?text=No+Image'}" 
                alt="${person.name}">
            <div style="font-weight: 600; font-size: 0.9rem;">${person.name}</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">${person.character}</div>
        </div>
    `).join('');
                }

                async function loadReviews(tmdbReviews) {
                    const reviewsContainer = document.getElementById('modalReviews');
                    if (!reviewsContainer) return;

                    reviewsContainer.innerHTML = '<div class="skeleton" style="height: 100px; width: 100%;"></div>';

                    let allReviews = [];

                    // 1. Fetch Firestore Reviews
                    if (currentMovieId) {
                        try {
                            const q = query(collection(db, 'reviews'), where('movieId', '==', currentMovieId), orderBy('timestamp', 'desc'));
                            const querySnapshot = await getDocs(q);
                            querySnapshot.forEach((doc) => {
                                const data = doc.data();
                                allReviews.push({
                                    author: data.username,
                                    rating: data.rating, // Already 1-5
                                    content: data.review,
                                    source: 'User'
                                });
                            });
                        } catch (error) {
                            console.error('Error fetching user reviews:', error);
                        }
                    }

                    // 2. Process TMDB Reviews
                    if (tmdbReviews && tmdbReviews.results) {
                        tmdbReviews.results.forEach(review => {
                            // Map 1-10 to 1-5
                            let rating = 3; // Default
                            if (review.author_details.rating) {
                                const tmdbRating = review.author_details.rating;
                                if (tmdbRating <= 2) rating = 1;
                                else if (tmdbRating <= 4) rating = 2;
                                else if (tmdbRating <= 6) rating = 3;
                                else if (tmdbRating <= 8) rating = 4;
                                else rating = 5;
                            }

                            allReviews.push({
                                author: review.author,
                                rating: rating,
                                content: review.content,
                                source: 'TMDB'
                            });
                        });
                    }

                    if (allReviews.length === 0) {
                        reviewsContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No reviews yet. Be the first to review!</p>';
                        return;
                    }

                    // 3. Render Reviews
                    reviewsContainer.innerHTML = allReviews.map(review => {
                        const ratingConfig = getRatingConfig(review.rating);
                        return `
        <div class="review-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <strong>${review.author} <span style="font-size: 0.8rem; color: var(--text-secondary); font-weight: normal;">(${review.source})</span></strong>
                <span style="color: ${ratingConfig.color}; font-weight: bold;">${ratingConfig.label} ${ratingConfig.icon}</span>
            </div>
            
            <!-- Meter -->
            <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; margin-bottom: 0.75rem; overflow: hidden;">
                <div style="width: ${(review.rating / 5) * 100}%; height: 100%; background: ${ratingConfig.color}; border-radius: 3px;"></div>
            </div>

            <p style="color: var(--text-secondary); line-height: 1.6; font-size: 0.95rem;">
                ${review.content.substring(0, 300)}${review.content.length > 300 ? '...' : ''}
            </p>
        </div>
    `}).join('');
                }

                function getRatingConfig(rating) {
                    switch (parseInt(rating)) {
                        case 1: return { label: 'Bad', color: '#ef4444', icon: '🔴' };
                        case 2: return { label: 'One Time Watch', color: '#f97316', icon: '🟠' };
                        case 3: return { label: 'Good', color: '#eab308', icon: '🟡' };
                        case 4: return { label: 'Go For It', color: '#22c55e', icon: '🟢' };
                        case 5: return { label: 'Perfection', color: '#ffd700', icon: '🌟' };
                        default: return { label: 'Rated', color: '#94a3b8', icon: '⭐' };
                    }
                }

                function loadSimilar(similar) {
                    const similarContainer = document.getElementById('modalSimilar');
                    if (!similar || !similar.results || similar.results.length === 0) {
                        similarContainer.innerHTML = '<p style="color: var(--text-secondary);">No similar titles found.</p>';
                        return;
                    }

                    // Reuse renderCards logic but for the modal container
                    // Since renderCards might expect a specific structure or clear the container, 
                    // we'll manually render for the modal to be safe and consistent with the modal style.

                    similarContainer.innerHTML = '';

                    similar.results.slice(0, 10).forEach(item => {
                        const card = document.createElement('div');
                        card.className = 'media-card';
                        card.style.minWidth = '140px'; // Slightly smaller for modal
                        card.style.width = '140px';

                        const posterPath = item.poster_path
                            ? window.APP_CONFIG.TMDB_IMAGE_SMALL_URL + item.poster_path
                            : 'https://via.placeholder.com/150x225?text=No+Image';

                        const year = (item.release_date || item.first_air_date || '').split('-')[0];
                        const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';

                        card.innerHTML = `
            <div class="media-poster-container">
                <img src="${posterPath}" alt="${item.title || item.name}" class="media-poster" loading="lazy">
                <div class="card-rating-badge">★ ${rating}</div>
            </div>
            <div class="media-info">
                <h3 class="media-title">${item.title || item.name}</h3>
                <div class="media-year">${year}</div>
            </div>
        `;

                        // Click to open this movie in the same modal (recursion-like)
                        card.onclick = () => {
                            // Close current modal logic if needed or just update content
                            // For simplicity, we just call openMovieModal which updates the current modal
                            openMovieModal(item.id, item.media_type || 'movie');
                            // Scroll to top of modal
                            document.querySelector('.modal').scrollTop = 0;
                        };

                        similarContainer.appendChild(card);
                    });
                }



                // --- User Actions ---
                function rateMovie(rating) {
                    userRating = rating;
                    document.querySelectorAll('.rating-btn').forEach(btn => btn.classList.remove('selected'));
                    document.querySelector(`.rating-btn[data-rating="${rating}"]`).classList.add('selected');
                }

                async function submitReview() {
                    const reviewText = document.getElementById('reviewText').value;
                    if (!userRating) {
                        alert('Please select a rating first!');
                        return;
                    }
                    if (!reviewText.trim()) {
                        alert('Please write a review!');
                        return;
                    }

                    if (!currentUser) {
                        alert('Please log in to submit a review!');
                        window.location.href = 'login.html';
                        return;
                    }

                    try {
                        // Save review to Firestore
                        await addDoc(collection(db, 'reviews'), {
                            userId: currentUser.uid,
                            username: currentUser.displayName || currentUser.email,
                            movieId: currentMovieId,
                            movieTitle: currentMovieData.title || currentMovieData.name,
                            rating: userRating,
                            review: reviewText.trim(),
                            timestamp: serverTimestamp()
                        });

                        alert('Review submitted successfully!');
                        document.getElementById('reviewText').value = '';
                        userRating = null;
                        document.querySelectorAll('.rating-btn').forEach(btn => btn.classList.remove('selected'));
                    } catch (error) {
                        console.error('Error submitting review:', error);
                        alert('Failed to submit review. Please try again.');
                    }
                }

                async function markAsWatched() {
                    if (!currentUser) {
                        alert('Please log in to mark as watched!');
                        window.location.href = 'login.html';
                        return;
                    }

                    try {
                        await setDoc(doc(db, 'users', currentUser.uid, 'watched', String(currentMovieId)), {
                            movieId: currentMovieId,
                            movieTitle: currentMovieData.title || currentMovieData.name,
                            posterPath: currentMovieData.poster_path,
                            rating: currentMovieData.vote_average,
                            mediaType: currentMovieData.media_type || 'movie', // Save media type
                            timestamp: serverTimestamp()
                        });

                        alert('Added to watched list!');
                    } catch (error) {
                        console.error('Error marking as watched:', error);
                        alert('Failed to add to watched list. Please try again.');
                    }
                }

                async function addToWatchLater() {
                    if (!currentUser) {
                        alert('Please log in to add to watch later!');
                        window.location.href = 'login.html';
                        return;
                    }

                    try {
                        await setDoc(doc(db, 'users', currentUser.uid, 'watchlist', String(currentMovieId)), {
                            movieId: currentMovieId,
                            movieTitle: currentMovieData.title || currentMovieData.name,
                            posterPath: currentMovieData.poster_path,
                            rating: currentMovieData.vote_average,
                            mediaType: currentMovieData.media_type || 'movie', // Save media type
                            timestamp: serverTimestamp()
                        });

                        alert('Added to watch later!');
                    } catch (error) {
                        console.error('Error adding to watch later:', error);
                        alert('Failed to add to watch later. Please try again.');
                    }
                }

                function watchNow() {
                    window.location.href = `watchanddownload.html?id=${currentMovieId}&type=movie`;
                }

                // --- AI Chat ---
                async function askAI() {
                    const question = document.getElementById('aiQuestion').value.trim();
                    if (!question) return;

                    const chatContainer = document.getElementById('aiChat');

                    // Add user message
                    const userMsg = document.createElement('div');
                    userMsg.className = 'ai-message user';
                    userMsg.textContent = question;
                    chatContainer.appendChild(userMsg);

                    document.getElementById('aiQuestion').value = '';

                    // Call Gemini API
                    const prompt = `You are a movie expert. Answer this question about "${currentMovieData.title || currentMovieData.name}": ${question}. Keep the answer concise and informative.`;

                    try {
                        const response = await callGemini(prompt);
                        const aiMsg = document.createElement('div');
                        aiMsg.className = 'ai-message ai';
                        aiMsg.textContent = response;
                        chatContainer.appendChild(aiMsg);
                        chatContainer.scrollTop = chatContainer.scrollHeight;
                    } catch (error) {
                        console.error('AI Error:', error);
                        const aiMsg = document.createElement('div');
                        aiMsg.className = 'ai-message ai';
                        aiMsg.textContent = 'Sorry, I encountered an error. Please try again.';
                        chatContainer.appendChild(aiMsg);
                    }
                }

                async function callGemini(prompt) {
                    // Using Hugging Face API (free and no quota issues!)
                    const HF_API_KEY = "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";
                    const HF_MODEL = "meta-llama/Llama-3.2-3B-Instruct";

                    const url = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

                    try {
                        const response = await fetch(url, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${HF_API_KEY}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                inputs: prompt,
                                parameters: {
                                    max_new_tokens: 250,
                                    temperature: 0.7,
                                    top_p: 0.9,
                                    return_full_text: false
                                }
                            })
                        });

                        if (!response.ok) {
                            const errorData = await response.json();
                            console.error('Hugging Face API Error:', errorData);

                            // Handle model loading state
                            if (errorData.error && errorData.error.includes('loading')) {
                                throw new Error('AI model is warming up. Please try again in a few seconds.');
                            }

                            throw new Error(`API Error: ${errorData.error || response.statusText}`);
                        }

                        const data = await response.json();

                        // Hugging Face returns an array with generated text
                        if (Array.isArray(data) && data[0]?.generated_text) {
                            return data[0].generated_text;
                        } else if (typeof data === 'string') {
                            return data;
                        } else {
                            console.error('Unexpected API response:', data);
                            throw new Error('Invalid response format from AI.');
                        }
                    } catch (error) {
                        console.error('AI Error:', error);
                        throw error;
                    }
                }


                // ============================================
                // GLOBAL THEME & VIBE CONTROLLER
                // ============================================

                const THEME_SETTINGS = [
                    { name: 'Dark Mode', class: 'theme-dark', default: true },
                    { name: 'Light Mode', class: 'theme-light' }
                ];

                const VIBE_SETTINGS = [
                    { name: 'Default Vibe', class: 'vibe-default', default: true },
                    { name: 'Retro Glitch', class: 'vibe-retro-glitch' },
                    { name: 'Forest Binge', class: 'vibe-forest-binge' },
                    { name: 'Tropical Sunset', class: 'vibe-tropical-sunset' },
                    { name: 'Cyber Noir', class: 'vibe-cyber-noir' },
                    { name: 'Vintage Sepia', class: 'vibe-vintage-sepia' },
                    { name: 'Cherry Blossom', class: 'vibe-cherry-blossom' },
                    { name: 'Industrial Grit', class: 'vibe-industrial-grit' },
                    { name: 'Cosmic Drift', class: 'vibe-cosmic-drift' },
                    { name: 'Pixel Arcade', class: 'vibe-pixel-arcade' },
                    { name: 'Zen Garden', class: 'vibe-zen-garden' }
                ];

                function applyTheme(themeClass) {
                    // Remove all theme classes
                    THEME_SETTINGS.forEach(t => document.body.classList.remove(t.class));
                    // Add new theme class
                    document.body.classList.add(themeClass);
                    // Save
                    localStorage.setItem('os_theme', themeClass);
                    // Update UI
                    updateAppearanceUI();
                    // Debug logging
                    console.log(`Theme applied: ${themeClass}`);
                    console.log(`Body className: ${document.body.className}`);
                }

                function applyVibe(vibeClass) {
                    // Remove all vibe classes
                    VIBE_SETTINGS.forEach(v => document.body.classList.remove(v.class));
                    // Add new vibe class
                    document.body.classList.add(vibeClass);
                    // Save
                    localStorage.setItem('os_vibe', vibeClass);
                    // Update UI
                    updateAppearanceUI();
                    console.log(`Vibe applied: ${vibeClass}`);
                }

                function initThemeVibe() {
                    // Load Theme
                    const savedTheme = localStorage.getItem('os_theme');
                    if (savedTheme && THEME_SETTINGS.some(t => t.class === savedTheme)) {
                        applyTheme(savedTheme);
                    } else {
                        const defaultTheme = THEME_SETTINGS.find(t => t.default);
                        applyTheme(defaultTheme.class);
                    }

                    // Load Vibe
                    const savedVibe = localStorage.getItem('os_vibe');
                    if (savedVibe && VIBE_SETTINGS.some(v => v.class === savedVibe)) {
                        applyVibe(savedVibe);
                    } else {
                        const defaultVibe = VIBE_SETTINGS.find(t => t.default);
                        applyVibe(defaultVibe.class);
                    }
                }



                function updateAppearanceUI() {
                    // Update Theme Buttons
                    document.querySelectorAll('.theme-btn').forEach(btn => {
                        const onclick = btn.getAttribute('onclick');
                        if (onclick) {
                            const match = onclick.match(/'([^']+)'/);
                            if (match) {
                                const themeClass = match[1];
                                if (document.body.classList.contains(themeClass)) {
                                    btn.classList.add('active');
                                } else {
                                    btn.classList.remove('active');
                                }
                            }
                        }
                    });

                    // Update Vibe Select
                    const select = document.querySelector('.vibe-select');
                    if (select) {
                        VIBE_SETTINGS.forEach(v => {
                            if (document.body.classList.contains(v.class)) {
                                select.value = v.class;
                            }
                        });
                    }
                }

                // Expose to window
                window.applyTheme = applyTheme;
                window.applyVibe = applyVibe;
                window.initThemeVibe = initThemeVibe;
                window.fetchTMDB = fetchTMDB;
                window.renderCustomList = renderCustomList;
                console.log('Exposed to window:', {
                    fetchTMDB: typeof window.fetchTMDB,
                    renderCustomList: typeof window.renderCustomList
                });

                // --- Theme & Vibe System ---
                function initThemeVibe() {
                    const savedTheme = localStorage.getItem('theme') || 'dark';
                    const savedVibe = localStorage.getItem('vibe') || 'cosmic-night';
                    applyTheme(savedTheme);
                    applyVibe(savedVibe);
                }

                function setupAppearanceUI() {
                    const headerActions = document.getElementById('headerActions');
                    if (!headerActions) return;

                    // Theme Toggle
                    let themeBtn = document.getElementById('themeBtn');
                    if (!themeBtn) {
                        themeBtn = document.createElement('button');
                        themeBtn.id = 'themeBtn';
                        themeBtn.className = 'icon-btn';
                        themeBtn.innerHTML = '<i class="fas fa-moon"></i>';
                        themeBtn.title = 'Toggle Theme';
                        themeBtn.onclick = () => {
                            const currentTheme = document.body.getAttribute('data-theme') || 'dark';
                            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                            applyTheme(newTheme);
                        };
                        headerActions.appendChild(themeBtn);
                    }
                }

                function applyTheme(theme) {
                    document.body.setAttribute('data-theme', theme);
                    localStorage.setItem('theme', theme);
                    const themeBtn = document.getElementById('themeBtn');
                    if (themeBtn) {
                        themeBtn.innerHTML = theme === 'dark' ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
                    }
                }

                function applyVibe(vibe) {
                    document.body.setAttribute('data-vibe', vibe);
                    localStorage.setItem('vibe', vibe);
                }

                function updateAppearanceUI() {
                    // Optional: Update UI elements based on current vibe/theme if needed
                }

            });
