// AI Assistant with Hugging Face Integration
// Enhanced version with conversation history and better UX

// Conversation history
let conversationHistory = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Focus input on load
    document.getElementById('aiInput').focus();

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

// Handle movie recommendations
async function handleMovieRecommendation(userMessage) {
    const prompt = `You are a movie recommendation expert. 
User Request: "${userMessage}"

Provide 5 movie or TV show recommendations that match their request.
Return ONLY a JSON object in this exact format (no markdown, no extra text):
{
  "message": "A brief friendly response explaining why these recommendations fit",
  "recommendations": [
    {
      "title": "Movie Title",
      "year": "2020",
      "reason": "Brief reason why it fits (max 15 words)"
    }
  ]
}`;

    const response = await callHuggingFace(prompt);
    const data = parseAIResponse(response);

    if (data && data.recommendations && data.recommendations.length > 0) {
        // Add AI message
        addMessageToUI(data.message || 'Here are some great recommendations for you:', false);

        // Add conversation to history
        conversationHistory.push({
            role: 'assistant',
            content: data.message
        });

        // Display movie cards
        await displayMovieCards(data.recommendations);
    } else {
        throw new Error('Could not parse movie recommendations');
    }
}

// Handle general chat
async function handleGeneralChat(userMessage) {
    const prompt = `You are a friendly, knowledgeable movie assistant for OurShow, a movie streaming platform.
User said: "${userMessage}"

Respond in a helpful, conversational way. Keep responses under 100 words.
If they ask about movies, provide thoughtful insights. Be enthusiastic about cinema!`;

    const response = await callHuggingFace(prompt);

    // Add AI response to UI
    addMessageToUI(response, false);

    // Add to conversation history
    conversationHistory.push({
        role: 'assistant',
        content: response
    });
}

// Call Hugging Face API
async function callHuggingFace(prompt) {
    if (!window.APP_CONFIG || !window.APP_CONFIG.HUGGINGFACE_API_KEY) {
        throw new Error('Hugging Face API key not configured in config.js');
    }

    const HF_API_KEY = window.APP_CONFIG.HUGGINGFACE_API_KEY;
    const HF_MODEL = 'meta-llama/Llama-3.2-3B-Instruct';
    const url = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${HF_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            inputs: prompt,
            parameters: {
                max_new_tokens: 400,
                temperature: 0.7,
                top_p: 0.9,
                return_full_text: false
            }
        })
    });

    if (!response.ok) {
        const errorData = await response.json();

        if (errorData.error && errorData.error.includes('loading')) {
            throw new Error('AI model is warming up. Please try again in a few seconds.');
        }

        if (errorData.error && errorData.error.includes('rate limit')) {
            throw new Error('Too many requests. Please wait a moment and try again.');
        }

        throw new Error(errorData.error || 'Failed to get AI response');
    }

    const data = await response.json();

    if (Array.isArray(data) && data[0]?.generated_text) {
        return data[0].generated_text.trim();
    } else if (typeof data === 'string') {
        return data.trim();
    } else {
        throw new Error('Unexpected response format from AI');
    }
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
            posterSrc = `${window.APP_CONFIG.TMDB_IMAGE_SMALL_URL}${tmdbData.poster_path}`;
            movieId = tmdbData.id;
            mediaType = tmdbData.media_type || 'movie';
        }

        card.innerHTML = `
            <img src="${posterSrc}" alt="${rec.title}" onerror="this.src='https://via.placeholder.com/200x300?text=${encodeURIComponent(rec.title)}'">
            <div class="info">
                <div class="title">${rec.title}</div>
                <div class="reason">${rec.reason}</div>
            </div>
        `;

        if (movieId) {
            card.onclick = () => window.location.href = `watchanddownload.html?id=${movieId}&type=${mediaType}`;
        }

        movieGrid.appendChild(card);
    }

    chatContainer.appendChild(movieGrid);
    scrollToBottom();
}

// Search TMDB
async function searchTMDB(query, year) {
    if (!window.APP_CONFIG || !window.APP_CONFIG.TMDB_API_KEY) {
        return null;
    }

    const url = new URL(`${window.APP_CONFIG.TMDB_BASE_URL}/search/multi`);
    url.searchParams.append('api_key', window.APP_CONFIG.TMDB_API_KEY);
    url.searchParams.append('query', query);
    if (year) url.searchParams.append('year', year);

    try {
        const res = await fetch(url);
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
function clearConversation() {
    if (confirm('Clear conversation history?')) {
        conversationHistory = [];
        localStorage.removeItem('aiConversation');

        // Clear UI (keep welcome message)
        const chatContainer = document.getElementById('chatContainer');
        const messages = chatContainer.querySelectorAll('.chat-message:not(:first-child)');
        messages.forEach(msg => msg.remove());

        const movieGrids = chatContainer.querySelectorAll('.movie-grid');
        movieGrids.forEach(grid => grid.remove());
    }
}

// Expose functions to window
window.usePrompt = usePrompt;
window.sendMessage = sendMessage;
window.clearConversation = clearConversation;
