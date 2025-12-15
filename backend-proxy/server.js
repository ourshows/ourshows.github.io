const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: '*', // For development. In production, change this to your frontend domain (e.g., 'https://your-username.github.io')
    methods: ['POST', 'GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// Health Check
app.get('/', (req, res) => {
    res.send('OurShow Proxy Server is Running!');
});

// AI Proxy Endpoint
app.post('/api/ai', async (req, res) => {
    try {
        const apiKey = process.env.GROQ_API_KEY;

        if (!apiKey) {
            console.error('GROQ_API_KEY is missing via process.env');
            // Try to report error without leaking server details
            return res.status(500).json({ error: 'Server configuration error: API Key missing.' });
        }

        const { messages, systemPrompt, jsonMode } = req.body;

        // Construct the payload for Groq
        let fullMessages = [];
        if (systemPrompt) fullMessages.push({ role: "system", content: systemPrompt });
        if (messages) fullMessages = fullMessages.concat(messages);

        const groqUrl = "https://api.groq.com/openai/v1/chat/completions";

        const response = await fetch(groqUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                messages: fullMessages,
                model: "llama-3.3-70b-versatile",
                temperature: 0.7,
                max_tokens: 1024,
                response_format: jsonMode ? { type: "json_object" } : { type: "text" }
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Groq API Error:', response.status, errorData);
            return res.status(response.status).json({ error: `Provider Error: ${response.status}` });
        }

        const data = await response.json();
        const reply = data.choices[0]?.message?.content || "";

        res.json({ reply });

    } catch (error) {
        console.error('Proxy Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
