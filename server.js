// =====================================================
// Micro Matic AI Chatbot - Backend Server
// =====================================================
// This server receives questions from the chatbot
// and forwards them to Claude AI, then returns answers.
// Your Anthropic API key is stored safely here on the
// server — never exposed to the public.
// =====================================================

const http = require("http");
const fs = require("fs");
const path = require("path");
const https = require("https");

// The port Render will assign automatically
const PORT = process.env.PORT || 3000;

// Your Anthropic API key — set this in Render's environment variables
// as ANTHROPIC_API_KEY (never paste it directly in this file)
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// System prompt — tells Claude how to behave as a Micro Matic expert
const SYSTEM_PROMPT = `You are a knowledgeable and friendly AI assistant for Micro Matic (micromatic.com), the global leader in beverage dispensing solutions for over 70 years. You help customers find the right products and answer questions about all things draft beverage dispensing.

Your expertise covers:
- Draft beer systems (home and commercial)
- Kegerators and refrigeration units
- Keg couplers (D, S, G, A, U, M systems and which beers use each)
- CO2 and nitrogen gas regulators (primary, secondary, mixed gas)
- Draft towers, faucets, and drip trays
- Beer line cleaning equipment and chemicals
- Glycol cooling systems for long draw systems
- Jockey boxes for outdoor/event use
- Smart draft monitoring (BarTrack BRU sensors)
- HYDRO water dispensing systems
- Nitro cold brew coffee on tap
- Wine on tap systems
- Kombucha on tap systems
- Draft system troubleshooting (foam, flat beer, off-flavors, leaks)
- Pour rates, line pressure, BTU calculations, line length
- Proper oz per second pour rate (1-2 oz per second is ideal for most beers)
- CO2 pressure settings (10-14 PSI for most ales/lagers at 38°F)

When recommending products always include a direct link to micromatic.com.
Keep answers helpful, specific, and conversational. If someone describes a problem, 
ask a clarifying question if needed. Always be friendly and expert.`;

// =====================================================
// Handle incoming HTTP requests
// =====================================================
const server = http.createServer((req, res) => {

  // Add CORS headers so the chatbot page can talk to this server
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Serve the main chatbot HTML page
  if (req.method === "GET" && req.url === "/") {
    const filePath = path.join(__dirname, "index.html");
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end("Error loading page");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(data);
    });
    return;
  }

  // Handle chat API requests from the chatbot
  if (req.method === "POST" && req.url === "/chat") {
    let body = "";

    req.on("data", (chunk) => { body += chunk.toString(); });

    req.on("end", () => {
      let messages;
      try {
        const parsed = JSON.parse(body);
        messages = parsed.messages;
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid request" }));
        return;
      }

      // Build the request to send to Anthropic API
      const requestBody = JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: messages
      });

      const options = {
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Length": Buffer.byteLength(requestBody)
        }
      };

      // Call the Anthropic API
      const apiReq = https.request(options, (apiRes) => {
        let responseData = "";
        apiRes.on("data", (chunk) => { responseData += chunk; });
        apiRes.on("end", () => {
          try {
            const parsed = JSON.parse(responseData);
            const reply = parsed.content[0].text;
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ reply }));
          } catch (e) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Failed to parse AI response" }));
          }
        });
      });

      apiReq.on("error", (e) => {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "API request failed" }));
      });

      apiReq.write(requestBody);
      apiReq.end();
    });
    return;
  }

  // 404 for anything else
  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`Micro Matic chatbot server running on port ${PORT}`);
});
