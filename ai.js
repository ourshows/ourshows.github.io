// AI Assistant with Hugging Face Integration
// Enhanced version with conversation history and better UX

// Conversation history
let conversationHistory = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('aiInput');
    if (!input) return; // Exit if AI elements aren't present

    // Focus input on load (only if standalone page, maybe not in modal to avoid annoying scroll)
    // input.focus(); 

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
});

// Quick prompt function
function usePrompt(promptText) {
    document.getElementById('aiInput').value = promptText;
    sendMessage();
}

// Main send message function
async function sendMessage() {
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
    sendBtn.disabled = true;

    try {
        // Determine if user wants movie recommendations
        const wantsMovies = isMovieRequest(message);

        if (wantsMovies) {
            await handleMovieRecommendation(message);
        } else {
            await handleGeneralChat(message);
        }

    } catch (error) {
        console.error('AI Error:', error);
        addMessageToUI(
            `😅 Oops! ${error.message || 'Something went wrong. Please try again.'}`,
            false
        );
    } finally {
        showTyping(false);
        sendBtn.disabled = false;
        input.focus();

        // Save conversation
        saveConversation();
    }
}

// Check if message is requesting movie recommendations
function isMovieRequest(message) {
    const keywords = [
        'recommend', 'suggest', 'movie', 'film', 'show', 'series',
        'watch', 'looking for', 'want to see', 'similar to',
        'like', 'genre', 'trending', 'popular', 'best'
    ];

    const lowerMessage = message.toLowerCase();
    return keywords.some(keyword => lowerMessage.includes(keyword));
}

// Call AI API (Via Proxy)
// Call AI API (Via Proxy or Direct Callback)
async function callAI(messages, systemPrompt, jsonMode = false) {
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

    // 3. Cloudflare Proxy (Works for Prod & Local)
    const url = (window.PUBLIC_CONFIG?.API_BASE_URL)
        ? `${window.PUBLIC_CONFIG.API_BASE_URL}/api/ai`
        : "/api/ai";

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
async function handleMovieRecommendation(userMessage) {
    const systemPrompt = `You are a movie recommendation engine. 
    You MUST respond with a valid JSON object strictly matching this schema:
    {
      "message": "Friendly text intro",
      "recommendations": [
        { "title": "Exact Title", "year": "YYYY", "reason": "Short reason" }
      ]
    }
    Provide 5 top-tier recommendations based on the user's request.`;

    // We can send just the user request or recent history. 
    // For recommendations, the immediate query is usually most important.
    const messages = [{ role: 'user', content: userMessage }];

    const responseText = await callAI(messages, systemPrompt, true); // jsonMode = true
    const data = parseAIResponse(responseText);

    if (data && data.recommendations && data.recommendations.length > 0) {
        addMessageToUI(data.message || 'Here are my picks:', false);

        conversationHistory.push({
            role: 'assistant',
            content: data.message
        });

        await displayMovieCards(data.recommendations);
    } else {
        // Fallback if JSON fails (rare with jsonMode)
        addMessageToUI("I found some movies but couldn't display them properly. " + responseText, false);
    }
}

// Handle general chat
async function handleGeneralChat(userMessage) {
    const systemPrompt = `You are 'OurShow AI', a witty and knowledgeable movie companion. 
    Keep responses concise (under 3 sentences) unless asked for a deep dive. 
    Be enthusiastic about cinema.`;

    // Construct conversation context (last 6 messages max to save tokens)
    const context = conversationHistory.slice(-6).map(msg => ({
        role: msg.role,
        content: msg.content
    }));

    // Add current message if not already in history (it was added to history in sendMessage before calling this, but let's be safe)
    // Actually sendMessage adds it to history array global BEFORE calling this. 
    // So context includes the latest user message.

    const responseText = await callAI(context, systemPrompt, false);

    addMessageToUI(responseText, false);

    conversationHistory.push({
        role: 'assistant',
        content: responseText
    });
}

// Parse AI response (try to extract JSON if present)
function parseAIResponse(text) {
    try {
        // Remove markdown code blocks
        let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        // Try to find JSON in the response
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        // If no JSON found, return as text
        return { message: cleaned };
    } catch (e) {
        // If parsing fails, return as text
        return { message: text };
    }
}

// Display movie cards
async function displayMovieCards(recommendations) {
    const chatContainer = document.getElementById('chatContainer');

    // Create movie grid container
    const movieGrid = document.createElement('div');
    movieGrid.className = 'movie-grid';
    movieGrid.style.animation = 'fadeInUp 0.5s ease-out';

    for (const rec of recommendations) {
        // Search TMDB for the movie
        const tmdbData = await searchTMDB(rec.title, rec.year);

        const card = document.createElement('div');
        card.className = 'movie-card-mini';

        let posterSrc = 'https://via.placeholder.com/200x300?text=No+Image';
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
            <img src="${posterSrc}" alt="${rec.title}" onerror="this.src='https://via.placeholder.com/200x300?text=${encodeURIComponent(rec.title)}'">
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
    console.log(`[AI] Searching TMDB for: ${query} (${year})`);

    // 1. Check Public Config
    if (window.PUBLIC_CONFIG && window.PUBLIC_CONFIG.TMDB_KEY) {
        console.log('[AI] Using Public Config Key');

        const url = new URL(`${window.PUBLIC_CONFIG.TMDB_BASE_URL}/search/multi`);
        url.searchParams.append('api_key', window.PUBLIC_CONFIG.TMDB_KEY);
        url.searchParams.append('query', query);
        if (year) url.searchParams.append('year', year);

        try {
            const res = await fetch(url);
            if (!res.ok) return null;
            const data = await res.json();
            return data.results && data.results[0] ? data.results[0] : null;
        } catch (e) { return null; }
    }

    // 2. Check App Config (Local/Dev)
    if (window.APP_CONFIG && window.APP_CONFIG.TMDB_API_KEY) {
        console.log('[AI] Using APP_CONFIG Key');
        const baseUrl = window.APP_CONFIG.TMDB_BASE_URL || "https://api.themoviedb.org/3";
        const url = new URL(`${baseUrl}/search/multi`);
        url.searchParams.append('api_key', window.APP_CONFIG.TMDB_API_KEY);
        url.searchParams.append('query', query);
        if (year) url.searchParams.append('year', year);

        try {
            const res = await fetch(url);
            if (!res.ok) {
                console.error('[AI] TMDB Fetch Failed (Local):', res.status);
                return null;
            }
            const data = await res.json();
            const result = data.results && data.results[0] ? data.results[0] : null;
            console.log('[AI] Search Result (Local):', result ? result.title || result.name : 'None found');
            return result;
        } catch (e) {
            console.error('[AI] TMDB Fetch Exception (Local):', e);
            return null;
        }
    }

    // Proxy fallback
    const url = new URL('/api/tmdb', window.location.origin);
    url.searchParams.append('endpoint', '/search/multi');
    url.searchParams.append('query', query);
    if (year) url.searchParams.append('year', year);

    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        return data.results && data.results[0] ? data.results[0] : null;
    } catch (error) {
        console.error('TMDB search error:', error);
        return null;
    }
}

// Add message to UI
function addMessageToUI(content, isUser) {
    const chatContainer = document.getElementById('chatContainer');

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

    // Insert before typing indicator
    const typingIndicator = document.getElementById('typingIndicator');
    chatContainer.insertBefore(messageDiv, typingIndicator);

    scrollToBottom();
}

// Show/hide typing indicator
function showTyping(show) {
    const indicator = document.getElementById('typingIndicator');
    if (show) {
        indicator.classList.add('active');
    } else {
        indicator.classList.remove('active');
    }
    scrollToBottom();
}

// Scroll chat to bottom
function scrollToBottom() {
    const chatContainer = document.getElementById('chatContainer');
    setTimeout(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 100);
}

// Save conversation to localStorage
function saveConversation() {
    try {
        localStorage.setItem('aiConversation', JSON.stringify(conversationHistory));
    } catch (e) {
        console.error('Failed to save conversation');
    }
}

// Clear conversation
// Clear conversation
function clearConversation() {
    console.log('[AI] Clearing conversation...');

    // Reset state
    conversationHistory = [];
    localStorage.removeItem('aiConversation');

    // Clear UI
    const chatContainer = document.getElementById('chatContainer');
    if (!chatContainer) return;

    // Remove all chat messages except the first one (Welcome)
    // And ensure we don't remove the typing indicator
    const contentToRemove = chatContainer.querySelectorAll('.chat-message:not(:first-child), .movie-grid');
    contentToRemove.forEach(el => el.remove());

    console.log('[AI] Chat cleared.');
}

// Modal functions
function openAIModal() {
    const modal = document.getElementById('aiModal');
    if (modal) {
        modal.style.display = 'block';
        setTimeout(() => {
            const input = document.getElementById('aiInput');
            if (input) input.focus();
        }, 100);
    } else {
        // Fallback if modal missing (e.g. on other pages) -> redirect
        window.location.href = 'ai.html';
    }
}

function closeAIModal() {
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

// Expose functions to window
window.usePrompt = usePrompt;
window.sendMessage = sendMessage;
window.clearConversation = clearConversation;
window.openAIModal = openAIModal;
window.closeAIModal = closeAIModal;
window.callAI = callAI;
