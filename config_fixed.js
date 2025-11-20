// API Configuration - Secure API Keys

const API_CONFIG = {
  TMDB: {
    readAccessToken:
      "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI3OThhZTdkZTU0MGIyNWU5MDhjNjhlYTJjYTQwODM0NyIsIm5iZiI6MTc2MzEzMTEzMy41OTcsInN1YiI6IjY5MTczZWZkYjgzYWRmMjI4ZWFjMmIzYyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.h7oLTTe5UHaaXPZHZSMtQs_c5fa8DBQq8b0gN2gVIPw",
    apiKey: "798ae7de540b25e908c68ea2ca408347",
    baseUrl: "https://api.themoviedb.org/3",
    imageBaseUrl: "https://image.tmdb.org/t/p"
  },

  GEMINI: {
    apiKey: "AIzaSyALqwEoXfXKDe4AqxaaIi8-8aWgYPzQFYE",
    baseUrl: "https://generativelanguage.googleapis.com/v1"
  }
};

// ------------------------ TMDB FETCH ------------------------

async function tmdbFetch(endpoint, options = {}) {
  const url = `${API_CONFIG.TMDB.baseUrl}${endpoint}`;

  const headers = {
    Authorization: `Bearer ${API_CONFIG.TMDB.readAccessToken}`,
    "Content-Type": "application/json;charset=utf-8",
    ...options.headers
  };

  try {
    const response = await fetch(url, {
      method: options.method || "GET",
      headers,
      ...options
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.warn("Token expired, switching to API key…");
        return tmdbFetchWithKey(endpoint, options);
      }
      throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("TMDB Fetch Error (token method):", error);

    try {
      console.warn("Trying API key fallback...");
      const fallback = await tmdbFetchWithKey(endpoint, options);
      if (fallback) return fallback;
    } catch (e) {
      console.error("TMDB Fallback Error:", e);
    }

    return null;
  }
}

async function tmdbFetchWithKey(endpoint, options = {}) {
  const sep = endpoint.includes("?") ? "&" : "?";
  const url = `${API_CONFIG.TMDB.baseUrl}${endpoint}${sep}api_key=${API_CONFIG.TMDB.apiKey}`;

  try {
    const response = await fetch(url, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json;charset=utf-8",
        ...options.headers
      },
      ...options
    });

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("TMDB Fetch Error:", error);
    return null;
  }
}

// ------------------------ GEMINI FETCH ------------------------

async function geminiCall(prompt) {
  // FIXED: Using YOUR actual available models
  const models = [
    'gemini-2.0-flash',
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash-001'
  ];
  
  for (const model of models) {
    const url = `${API_CONFIG.GEMINI.baseUrl}/models/${model}:generateContent?key=${API_CONFIG.GEMINI.apiKey}`;
    
    try {
      console.log(`🔄 Trying model: ${model}...`);
      
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.7
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`❌ Model ${model} failed:`, errorText);
        continue; // Try next model
      }

      const data = await response.json();
      console.log(`✅ Success with model: ${model}`);

      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text;
      }

      if (data.candidates?.[0]?.finishReason === 'SAFETY') {
        return "Sorry, I couldn't generate recommendations due to safety filters. Please try a different prompt.";
      }
    } catch (error) {
      console.warn(`Model ${model} error:`, error.message);
      continue; // Try next model
    }
  }
  
  // If all models failed
  console.error('❌ All Gemini models failed. Check API key at: https://aistudio.google.com/apikey');
  return null;
}

// Export (Node compatibility)
if (typeof module !== "undefined" && module.exports) {
  module.exports = { API_CONFIG, tmdbFetch, tmdbFetchWithKey, geminiCall };
}
