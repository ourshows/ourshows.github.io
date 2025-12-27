import { auth, db, getDocs, collection, query, orderBy, limit } from './firebase-wrapper.js';

// AI Assistant with Hugging Face Integration
// Enhanced version with conversation history and better UX

// Conversation history
let conversationHistory = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('aiInput');
    if (window.ourShowLoader) window.ourShowLoader.show();

    // Load conversation history from localStorage
    const saved = localStorage.getItem('aiConversation');
    if (saved) {
        try {
            conversationHistory = JSON.parse(saved);
            // Restore messages (skip the welcome message)
            conversationHistory.forEach(msg => {
                if (msg.role !== 'system') {
                    addMessageToUI(msg.content, msg.role === 'user');
                }
            });
        } catch (e) {
            console.error('Failed to load conversation history');
        }
    }

    if (window.ourShowLoader) window.ourShowLoader.hide();
});

// Fetch User Context (History & Watchlist)
async function fetchUserContext() {
    if (!auth.currentUser) return "User is not logged in. Treat as a guest.";

    let context = `User Profile (${auth.currentUser.displayName || 'User'}):\n`;

    try {
        // 1. Watched History (Last 50)
        const watchedQ = query(collection(db, 'users', auth.currentUser.uid, 'watched'), orderBy('timestamp', 'desc'), limit(50));
        const watchedSnap = await getDocs(watchedQ);
        if (!watchedSnap.empty) {
            const watchedTitles = watchedSnap.docs.map(d => {
                const data = d.data();
                return `${data.movieTitle} [${data.mediaType || 'movie'}]`;
            });
            context += `- Recently Watched: ${watchedTitles.join(', ')}\n`;
        } else {
            context += `- Recently Watched: None recorded.\n`;
        }

        // 2. Watchlist (Last 50)
        const watchlistQ = query(collection(db, 'users', auth.currentUser.uid, 'watchlist'), orderBy('timestamp', 'desc'), limit(50));
        const watchlistSnap = await getDocs(watchlistQ);
        if (!watchlistSnap.empty) {
            const watchlistTitles = watchlistSnap.docs.map(d => d.data().movieTitle);
            context += `- Watchlist: ${watchlistTitles.join(', ')}\n`;
        } else {
            context += `- Watchlist: Empty.\n`;
        }

    } catch (e) {
        console.error("Error fetching user context:", e);
        context += "(Error retrieving history)\n";
    }

    return context;
}


// Quick prompt function
window.usePrompt = function (promptText) {
    document.getElementById('aiInput').value = promptText;
    sendMessage();
}

// Main send message function
window.sendMessage = async function () {
    const input = document.getElementById('aiInput');
    const message = input.value.trim();

    if (!message) return;

    // Add user message to UI
    addMessageToUI(message, true);

    // Add to conversation history
    conversationHistory.push({
        role: 'user',
        content: message
    });

    // Clear input
    input.value = '';

    // Show typing indicator
    showTyping(true);

    // Disable send button
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) sendBtn.disabled = true;

    try {
        // Fetch Context dynamically
        const userContext = await fetchUserContext();

        // Determine if user wants movie recommendations
        const wantsMovies = isMovieRequest(message);

        if (wantsMovies) {
            await handleMovieRecommendation(message, userContext);
        } else {
            await handleGeneralChat(message, userContext);
        }

    } catch (error) {
        console.error('AI Error:', error);
        addMessageToUI(
            `😅 Oops! ${error.message || 'Something went wrong. Please try again.'}`,
            false
        );
    } finally {
        showTyping(false);
        if (sendBtn) sendBtn.disabled = false;
        if (input) input.focus();

        // Save conversation
        saveConversation();
    }
}

// Check if message is requesting movie recommendations
function isMovieRequest(message) {
    const lowerMessage = message.toLowerCase();

    // Explicitly exclude history/list requests so they go to General Chat (Text List)
    const historyKeywords = ['history', 'what i watched', 'my list', 'watched list', 'have i watched'];
    if (historyKeywords.some(k => lowerMessage.includes(k))) return false;

    const keywords = [
        'recommend', 'suggest', 'movie', 'film', 'show', 'series',
        'watch', 'looking for', 'want to see', 'similar to',
        'like', 'genre', 'trending', 'popular', 'best'
    ];

    return keywords.some(keyword => lowerMessage.includes(keyword));
}

// Call AI API (Via Proxy or Direct)
window.callAI = async function (messages, systemPrompt, jsonMode = false) {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // 1. Priority: Client-Side Direct Call (Public Config)
    if (window.PUBLIC_CONFIG && window.PUBLIC_CONFIG.GROQ_API_KEY) {
        const url = "https://api.groq.com/openai/v1/chat/completions";

        // Prepare messages
        let fullMessages = [];
        if (systemPrompt) fullMessages.push({ role: "system", content: systemPrompt });
        fullMessages = fullMessages.concat(messages);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.PUBLIC_CONFIG.GROQ_API_KEY}`
                },
                body: JSON.stringify({
                    messages: fullMessages,
                    model: "llama-3.3-70b-versatile",
                    temperature: 0.7,
                    max_tokens: 1024,
                    response_format: jsonMode ? { type: "json_object" } : { type: "text" }
                })
            });

            if (!response.ok) throw new Error(`Groq Direct Error: ${response.status}`);
            const data = await response.json();
            return data.choices[0]?.message?.content || "";
        } catch (e) {
            console.error("Direct AI Error:", e);
            throw e;
        }
    }

    // 2. Fallback: Local Fallback for Groq (App Config)
    if (isLocal && window.APP_CONFIG && window.APP_CONFIG.GROQ_API_KEY) {
        const url = "https://api.groq.com/openai/v1/chat/completions";

        // Prepare messages
        let fullMessages = [];
        if (systemPrompt) fullMessages.push({ role: "system", content: systemPrompt });
        fullMessages = fullMessages.concat(messages);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.APP_CONFIG.GROQ_API_KEY}`
                },
                body: JSON.stringify({
                    messages: fullMessages,
                    model: "llama-3.3-70b-versatile",
                    temperature: 0.7,
                    max_tokens: 1024,
                    response_format: jsonMode ? { type: "json_object" } : { type: "text" }
                })
            });

            if (!response.ok) throw new Error(`Groq Direct Error: ${response.status}`);
            const data = await response.json();
            return data.choices[0]?.message?.content || "";
        } catch (e) {
            console.error("Direct AI Error:", e);
            throw e;
        }
    }

    // 3. Cloudflare Proxy
    let url = "/api/ai";
    if (window.PUBLIC_CONFIG?.API_BASE_URL) {
        if (window.PUBLIC_CONFIG.API_BASE_URL.includes('workers.dev')) {
            url = window.PUBLIC_CONFIG.API_BASE_URL; // Use root for workers
        } else {
            url = `${window.PUBLIC_CONFIG.API_BASE_URL}/api/ai`;
        }
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: messages,
                systemPrompt: systemPrompt,
                jsonMode: jsonMode
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `AI Proxy Error: ${response.status}`);
        }

        const data = await response.json();
        return data.reply || "";

    } catch (error) {
        console.error('AI Request Error:', error);
        throw error;
    }
}

// Handle movie recommendations
async function handleMovieRecommendation(userMessage, userContext) {
    const systemPrompt = `You are an expert Movie Recommendation Engine. 
    You have access to the user's viewing history:
    ${userContext}

    Instructions:
    1. Base your recommendations heavily on their 'Recently Watched' favorites (high ratings) and 'Watchlist' interests.
    2. If they ask for something different or specific, prioritize their request but use history for style matching.
    3. IMPORTANT: Do NOT recommend any title that appears in the 'Recently Watched' or 'Watchlist' sections above. The user has already seen them.
    4. If the user asks to "list my watched history" or similar, YOU CAN AND SHOULD list the movies from the context provided.
    5. You MUST respond with a valid JSON object strictly matching this schema:
    {
      "message": "Friendly text intro explaining WHY you picked these based on their history.",
      "recommendations": [
        { "title": "Exact Title", "year": "YYYY", "reason": "Connection to their history" }
      ]
    }
    Provide 5 top-tier recommendations.`;

    const messages = [{ role: 'user', content: userMessage }];

    const responseText = await window.callAI(messages, systemPrompt, true); // jsonMode = true
    const data = parseAIResponse(responseText);

    if (data && data.recommendations && data.recommendations.length > 0) {
        addMessageToUI(data.message || 'Here are my picks:', false);

        conversationHistory.push({
            role: 'assistant',
            content: data.message
        });

        await displayMovieCards(data.recommendations);
    } else {
        addMessageToUI("I found some movies but couldn't display them properly. " + responseText, false);
    }
}

// Handle general chat
async function handleGeneralChat(userMessage, userContext) {
    const systemPrompt = `You are 'OurShow AI', a witty, knowledgeable, and opinionated movie buff companion.
    
    Context about the User:
    ${userContext}

    Guidelines:

    - Use their history to make personalized references (e.g., "Since you asked about X, and I know you loved Y...").
    - If the user asks to list their watched video/history, you CAN do so using the context provided.
    - IMPORTANT: When listing history, use a clean numbered format (e.g., "1. Title\n2. Title"). Do NOT include ratings or extra text unless asked.
    - If the user asks for "only movies" or "only series", filter the history context using the [movie] or [tv] tags provided.
    - If they haven't watched much, be encouraging.
    - Keep responses concise (under 3 sentences) unless asked for a deep dive or a list. 
    - Be enthusiastic about cinema.`;

    // Construct conversation context (last 6 messages max)
    const context = conversationHistory.slice(-6).map(msg => ({
        role: msg.role,
        content: msg.content
    }));

    // Add current message acts as the trigger, so we don't need to append it again if we rely on ai.js callAI to just take messages.
    // However, our callAI takes 'messages' array. 
    // We should ensure the latest user message is the last one in the array sent to API.

    // Check if the last message in context is the current one. 
    // In sendMessage, we pushed to conversationHistory BEFORE calling this. So yes.

    const responseText = await window.callAI(context, systemPrompt, false);

    addMessageToUI(responseText, false);

    conversationHistory.push({
        role: 'assistant',
        content: responseText
    });
}

// Parse AI response (try to extract JSON if present)
function parseAIResponse(text) {
    try {
        let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return { message: cleaned };
    } catch (e) {
        return { message: text };
    }
}

// Display movie cards
async function displayMovieCards(recommendations) {
    const chatContainer = document.getElementById('chatContainer');

    const movieGrid = document.createElement('div');
    movieGrid.className = 'movie-grid';
    movieGrid.style.animation = 'fadeInUp 0.5s ease-out';

    for (const rec of recommendations) {
        const tmdbData = await searchTMDB(rec.title, rec.year);
        const card = document.createElement('div');
        card.className = 'movie-card-mini';

        let posterSrc = 'https://placehold.co/200x300?text=No+Image';
        let movieId = '';
        let mediaType = 'movie';

        if (tmdbData) {
            const baseUrl = (window.PUBLIC_CONFIG && window.PUBLIC_CONFIG.TMDB_IMAGE_SMALL_URL)
                ? window.PUBLIC_CONFIG.TMDB_IMAGE_SMALL_URL
                : (window.APP_CONFIG ? window.APP_CONFIG.TMDB_IMAGE_SMALL_URL : 'https://image.tmdb.org/t/p/w500');

            posterSrc = `${baseUrl}${tmdbData.poster_path}`;
            movieId = tmdbData.id;
            mediaType = tmdbData.media_type || 'movie';
        }

        card.innerHTML = `
            <img src="${posterSrc}" alt="${rec.title}" onerror="this.src='https://placehold.co/200x300?text=${encodeURIComponent(rec.title)}'">
            <div class="info">
                <div class="title" title="${rec.title}">${rec.title}</div>
            </div>
        `;

        if (movieId) {
            card.onclick = () => window.location.href = `watchanddownload.html?id=${movieId}&type=${mediaType}`;
        }

        movieGrid.appendChild(card);
    }

    const typingIndicator = document.getElementById('typingIndicator');
    chatContainer.insertBefore(movieGrid, typingIndicator);
    scrollToBottom();
}

// Search TMDB
async function searchTMDB(query, year) {
    const config = window.PUBLIC_CONFIG || window.APP_CONFIG;
    if (!config) return null;

    const apiKey = config.TMDB_API_KEY || config.TMDB_KEY;
    if (!apiKey) return null;

    const baseUrl = config.TMDB_BASE_URL || "https://api.themoviedb.org/3";
    const url = new URL(`${baseUrl}/search/multi`);

    url.searchParams.append('api_key', apiKey);
    url.searchParams.append('query', query);
    url.searchParams.append('include_adult', 'false');
    if (year) url.searchParams.append('year', year);

    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();

        // Prioritize exact matches if possible, but taking the first result is usually fine for AI context
        return data.results && data.results[0] ? data.results[0] : null;
    } catch (e) {
        console.error("TMDB Search Error:", e);
        return null;
    }
}

// Add message to UI
function addMessageToUI(content, isUser) {
    const chatContainer = document.getElementById('chatContainer');
    if (!chatContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isUser ? 'user' : ''}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = isUser ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.innerHTML = `<p>${content}</p>`;

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(messageContent);

    const typingIndicator = document.getElementById('typingIndicator');
    chatContainer.insertBefore(messageDiv, typingIndicator);

    scrollToBottom();
}

// Show/hide typing indicator
function showTyping(show) {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        if (show) indicator.classList.add('active');
        else indicator.classList.remove('active');
        scrollToBottom();
    }
}

// Scroll chat to bottom
function scrollToBottom() {
    const chatContainer = document.getElementById('chatContainer');
    if (chatContainer) {
        setTimeout(() => {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }, 100);
    }
}

// Save conversation
function saveConversation() {
    try {
        localStorage.setItem('aiConversation', JSON.stringify(conversationHistory));
    } catch (e) {
        console.error('Failed to save conversation');
    }
}

// Clear conversation
window.clearConversation = function () {
    conversationHistory = [];
    localStorage.removeItem('aiConversation');
    const chatContainer = document.getElementById('chatContainer');
    if (!chatContainer) return;
    const contentToRemove = chatContainer.querySelectorAll('.chat-message:not(:first-child), .movie-grid');
    contentToRemove.forEach(el => el.remove());
}

// Modal functions
window.openAIModal = function () {
    const modal = document.getElementById('aiModal');
    if (modal) {
        modal.style.display = 'block';
        setTimeout(() => {
            const input = document.getElementById('aiInput');
            if (input) input.focus();
        }, 100);
    } else {
        window.location.href = 'ai.html';
    }
}

window.closeAIModal = function () {
    const modal = document.getElementById('aiModal');
    if (modal) modal.style.display = 'none';
}

// Close modal if clicked outside
window.addEventListener('click', (e) => {
    const modal = document.getElementById('aiModal');
    if (e.target === modal) {
        modal.style.display = 'none';
    }
});
