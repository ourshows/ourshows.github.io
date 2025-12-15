export default {
    async fetch(request, env, ctx) {
        // 1. Handle CORS (Allow all for now, restrict in production if needed)
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        };

        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        // 2. Only allow POST requests to /
        const url = new URL(request.url);
        if (request.method !== "POST") {
            return new Response("Method Not Allowed. Use POST.", { status: 405, headers: corsHeaders });
        }

        // 3. Get API Key from Environment Secrets
        const apiKey = env.GROQ_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ error: "Server config error: Missing API Key" }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // 4. Proxy Logic
        try {
            const { messages, systemPrompt, jsonMode } = await request.json();

            let fullMessages = [];
            if (systemPrompt) fullMessages.push({ role: "system", content: systemPrompt });
            if (messages) fullMessages = fullMessages.concat(messages);

            const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    messages: fullMessages,
                    model: "llama-3.3-70b-versatile",
                    temperature: 0.7,
                    max_tokens: 1024,
                    response_format: jsonMode ? { type: "json_object" } : { type: "text" }
                })
            });

            if (!groqResponse.ok) {
                const errorText = await groqResponse.text();
                return new Response(JSON.stringify({ error: `Groq Error: ${groqResponse.status}`, details: errorText }), {
                    status: groqResponse.status,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            const data = await groqResponse.json();
            const reply = data.choices[0]?.message?.content || "";

            return new Response(JSON.stringify({ reply }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });

        } catch (err) {
            return new Response(JSON.stringify({ error: "Internal Worker Error", details: err.message }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }
    },
};
