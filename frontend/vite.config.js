import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { processTurn } = require("../src/runtime.js");

function affectRuntimeBridge() {
  return {
    name: "emoai-affect-runtime-bridge",
    configureServer(server) {
      server.middlewares.use("/api/affect", async (request, response) => {
        if (request.method !== "POST") {
          response.statusCode = 405;
          response.end("Method Not Allowed");
          return;
        }
        let body = "";
        request.setEncoding("utf8");
        request.on("data", (chunk) => { body += chunk; });
        request.on("end", () => {
          try {
            const result = processTurn(body ? JSON.parse(body) : {});
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            response.end(JSON.stringify(result));
          } catch (error) {
            response.statusCode = 400;
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            response.end(JSON.stringify({ error: error.message || String(error) }));
          }
        });
      });
      server.middlewares.use("/api/chat", async (request, response) => {
        if (request.method !== "POST") {
          response.statusCode = 405;
          response.end("Method Not Allowed");
          return;
        }
        let body = "";
        request.setEncoding("utf8");
        request.on("data", (chunk) => { body += chunk; });
        request.on("end", async () => {
          try {
            const payload = body ? JSON.parse(body) : {};
            if (!payload.url || !payload.body) throw new Error("Missing upstream URL or request body");
            const upstream = await fetch(payload.url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(payload.accessKey ? { Authorization: `Bearer ${payload.accessKey}` } : {}),
              },
              body: JSON.stringify(payload.body),
            });
            response.statusCode = upstream.status;
            response.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
            response.end(await upstream.text());
          } catch (error) {
            response.statusCode = 502;
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            response.end(JSON.stringify({ error: { message: error.message || String(error) } }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), affectRuntimeBridge()],
  server: { port: 5173 },
});
