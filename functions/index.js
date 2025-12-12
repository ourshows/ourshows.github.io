const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * Proxy for Hugging Face API
 * Expects: { inputs: string, parameters: object }
 */
exports.huggingFaceProxy = functions.https.onRequest(async (req, res) => {
    // CORS configuration
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }

    // Check for API key in environment config
    // Run: firebase functions:config:set huggingface.key="YOUR_KEY"
    const HF_API_KEY = functions.config().huggingface?.key;

    if (!HF_API_KEY) {
        console.error("Hugging Face API key not found in functions config.");
        res.status(500).json({ error: "Server configuration error: API Key missing." });
        return;
    }

    const HF_MODEL = "meta-llama/Llama-3.2-3B-Instruct";
    const url = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

    try {
        const { inputs, parameters } = req.body;

        if (!inputs) {
            res.status(400).json({ error: "Missing 'inputs' in request body." });
            return;
        }

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${HF_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                inputs,
                parameters: parameters || {
                    max_new_tokens: 400,
                    temperature: 0.7,
                    top_p: 0.9,
                    return_full_text: false
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Hugging Face API Error:", response.status, errorText);
            let errorJson;
            try {
                errorJson = JSON.parse(errorText);
            } catch (e) {
                errorJson = { error: errorText };
            }
            res.status(response.status).json(errorJson);
            return;
        }

        const data = await response.json();
        res.status(200).json(data);

    } catch (error) {
        console.error("Proxy error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
