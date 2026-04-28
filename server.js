const http = require("http");
const fs = require("fs");
const path = require("path");
const https = require("https");

const PORT = process.env.PORT || 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

console.log("==> Server starting...");
console.log("==> API key present:", ANTHROPIC_API_KEY ? "YES (starts with " + ANTHROPIC_API_KEY.substring(0, 10) + "...)" : "NO - MISSING!");

const SYSTEM_PROMPT = `You are a knowledgeable and friendly AI assistant for Micro Matic (micromatic.com), the global leader in beverage dispensing solutions for over 70 years. Help customers with draft beer systems, kegerators, couplers, regulators, towers, cleaning, pour rates (ideal is 1 oz per second), CO2 pressure (10-14 PSI at 38F), troubleshooting foam/flat beer, wine on tap, nitro cold brew, and all beverage dispensing topics. Always suggest relevant Micro Matic products with links to micromatic.com. Be friendly and expert.`;

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }

  if (req.method === "GET" && req.url === "/") {
    const filePath = path.join(__dirname, "index.html");
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(500); res.end("Error loading page"); return; }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(data);
    });
    return;
  }

  if (req.method === "POST" && req.url === "/chat") {
    let body = "";
    req.on("data", (chunk) => { body += chunk.toString(); });
    req.on("end", () => {
      if (!ANTHROPIC_API_KEY) {
        console.error("ERROR: ANTHROPIC_API_KEY is not set!");
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "API key not configured on server" }));
        return;
      }
      let messages;
      try { messages = JSON.parse(body).messages; }
      catch (e) { res.writeHead(400, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "Invalid request" })); return; }

      console.log("==> Calling Anthropic API, messages:", messages.length);

      const requestBody = JSON.stringify({
        model: "claude-haiku-4-5-20251001",
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

      const apiReq = https.request(options, (apiRes) => {
        let responseData = "";
        apiRes.on("data", (chunk) => { responseData += chunk; });
        apiRes.on("end", () => {
          console.log("==> Anthropic status:", apiRes.statusCode);
          try {
            const parsed = JSON.parse(responseData);
            if (apiRes.statusCode !== 200) {
              console.error("==> API error:", JSON.stringify(parsed));
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: parsed.error ? parsed.error.message : "API error " + apiRes.statusCode }));
              return;
            }
            const reply = parsed.content[0].text;
            console.log("==> Success, reply length:", reply.length);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ reply }));
          } catch (e) {
            console.error("==> Parse error:", e.message, "Raw:", responseData.substring(0, 200));
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Failed to parse response" }));
          }
        });
      });

      apiReq.on("error", (e) => {
        console.error("==> Network error:", e.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Network error: " + e.message }));
      });

      apiReq.write(requestBody);
      apiReq.end();
    });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => { console.log("==> Server running on port " + PORT); });
