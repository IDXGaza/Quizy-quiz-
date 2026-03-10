import express from "express";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/generate-questions", async (req, res) => {
    try {
      const { promptText, model } = req.body;

      if (!model) {
        return res.status(400).json({ error: "Model is required" });
      }

      if (model.startsWith("gpt")) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error("OPENAI_API_KEY is not set in environment variables");
        const openai = new OpenAI({ apiKey });
        const response = await openai.chat.completions.create({
          model: model,
          messages: [{ role: "user", content: promptText }],
        });
        res.json({ text: response.choices[0].message.content });
      } else if (model.startsWith("claude")) {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set in environment variables");
        const anthropic = new Anthropic({ apiKey });
        const response = await anthropic.messages.create({
          model: model,
          max_tokens: 4000,
          messages: [{ role: "user", content: promptText }],
        });
        const text = response.content[0].type === "text" ? response.content[0].text : "{}";
        res.json({ text });
      } else {
        res.status(400).json({ error: "Unsupported model" });
      }
    } catch (error: any) {
      const status = error.status || (error.message?.includes('429') ? 429 : 500);
      res.status(status).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
