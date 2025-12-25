export default {
    async fetch(request, env, ctx) {
        // 1. Handle CORS
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        };

        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        const url = new URL(request.url);

        // ROUTE 1: AI (Groq) - /api/ai
        if (url.pathname.endsWith("/api/ai") || url.pathname.endsWith("/ai")) {
            if (request.method !== "POST") {
                return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
            }
            const apiKey = env.GROQ_API_KEY;
            if (!apiKey) return new Response(JSON.stringify({ error: "Missing Groq Key" }), { status: 500, headers: corsHeaders });

            try {
                const { messages, systemPrompt, jsonMode } = await request.json();
                let fullMessages = [];
                if (systemPrompt) fullMessages.push({ role: "system", content: systemPrompt });
                if (messages) fullMessages = fullMessages.concat(messages);

                const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
                    body: JSON.stringify({
                        messages: fullMessages,
                        model: "llama-3.3-70b-versatile",
                        temperature: 0.7,
                        max_tokens: 1024,
                        response_format: jsonMode ? { type: "json_object" } : { type: "text" }
                    })
                });

                const data = await groqResponse.json();
                return new Response(JSON.stringify({ reply: data.choices?.[0]?.message?.content || "" }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            } catch (err) {
                return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
            }
        }

        // ROUTE 2: NewsAPI - /api/news
        if (url.pathname.endsWith("/api/news") || url.pathname.endsWith("/news")) {
            const apiKey = env.NEWS_API_KEY;
            if (!apiKey) return new Response(JSON.stringify({ error: "Missing News Key" }), { status: 500, headers: corsHeaders });

            // Extract query params from original request
            const q = url.searchParams.get("q") || "movies";
            const page = url.searchParams.get("page") || "1";

            const newsUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=en&sortBy=publishedAt&page=${page}&pageSize=12&apiKey=${apiKey}`;

            try {
                const newsResponse = await fetch(newsUrl, { headers: { "User-Agent": "OurShow-Proxy/1.0" } });
                const data = await newsResponse.json();
                return new Response(JSON.stringify(data), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            } catch (err) {
                return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
            }
        }

        return new Response("Not Found", { status: 404, headers: corsHeaders });
    },
};
