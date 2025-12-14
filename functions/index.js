const functions = require("firebase-functions");
const admin = require("firebase-admin");
const Groq = require("groq-sdk");

admin.initializeApp();

/**
 * Proxy for Groq API (replacing Hugging Face)
 * Expects: { messages: [{role: string, content: string}], systemPrompt?: string }
 */
exports.aiProxy = functions.https.onRequest(async (req, res) => {
    // CORS configuration
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }

    // Check for API key in environment config
    // Run: firebase functions:config:set groq.key="YOUR_KEY"
    const GROQ_API_KEY = functions.config().groq?.key;

    if (!GROQ_API_KEY) {
        console.error("Groq API key not found in functions config.");
        res.status(500).json({ error: "Server configuration error: API Key missing." });
        return;
    }

    const groq = new Groq({ apiKey: GROQ_API_KEY });

    try {
        const { messages, systemPrompt, jsonMode } = req.body;

        if (!messages || !Array.isArray(messages)) {
            res.status(400).json({ error: "Missing or invalid 'messages' in request body." });
            return;
        }

        // Construct messages array
        let fullMessages = [];
        if (systemPrompt) {
            fullMessages.push({ role: "system", content: systemPrompt });
        }
        fullMessages = fullMessages.concat(messages);

        const completion = await groq.chat.completions.create({
            messages: fullMessages,
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            max_tokens: 1024,
            top_p: 1,
            stream: false,
            response_format: jsonMode ? { type: "json_object" } : { type: "text" }
        });

        const reply = completion.choices[0]?.message?.content || "";
        res.status(200).json({ reply });

    } catch (error) {
        console.error("Groq API Error:", error);
        res.status(500).json({ error: error.message || "Internal server error" });
    }
});

// Keep legacy export name alias if needed, or we just update firebase.json rewrites
exports.huggingFaceProxy = exports.aiProxy;
