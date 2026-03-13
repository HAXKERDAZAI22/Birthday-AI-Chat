import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import { CHARACTERS } from "../characters/index.js";

const router: IRouter = Router();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "deepseek/deepseek-chat";

type ConversationMode = "romantic" | "caring" | "funny" | "mixed";

function getModeInstruction(mode: ConversationMode): string {
  switch (mode) {
    case "romantic":
      return "Conversation mode: Romantic. Be affectionate, warm, tender, and deeply caring. Express gentle feelings naturally.";
    case "caring":
      return "Conversation mode: Caring. Be supportive, understanding, nurturing, and emotionally present.";
    case "funny":
      return "Conversation mode: Funny. Be playful, witty, tease gently, make jokes in character.";
    case "mixed":
      return "Conversation mode: Mixed. Balance all moods naturally — caring, playful, warm, and real.";
  }
}

interface ChatRequestBody {
  messages: { role: string; content: string }[];
  characterId: string;
  mode: ConversationMode;
  memory?: string;
  isGroup?: boolean;
  characters?: string[];
}

router.post("/chat", async (req: Request, res: Response) => {
  const body = req.body as ChatRequestBody;
  const { messages, characterId, mode, memory } = body;

  const character = CHARACTERS[characterId];
  if (!character) {
    res.status(400).json({ error: "Unknown character" });
    return;
  }

  const modeInstruction = getModeInstruction(mode);
  const systemContent = `${character.systemPrompt}\n\n${modeInstruction}${memory || ""}`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    const openRouterRes = await fetch(OPENROUTER_BASE_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://birthday-gift-app.replit.app",
        "X-Title": "Birthday AI Gift App",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemContent },
          ...messages,
        ],
        stream: true,
        max_tokens: 800,
        temperature: 0.85,
      }),
    });

    if (!openRouterRes.ok) {
      const errorText = await openRouterRes.text();
      console.error("OpenRouter error:", errorText);
      res.write(`data: ${JSON.stringify({ content: "*sighs* I seem to be having trouble at the moment.", characterId })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    const reader = openRouterRes.body?.getReader();
    if (!reader) {
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            res.write(`data: ${JSON.stringify({ content, characterId })}\n\n`);
          }
        } catch {}
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("Stream error:", err);
    res.write(`data: ${JSON.stringify({ content: "*pauses* Something went wrong on my end.", characterId })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

router.post("/group-chat", async (req: Request, res: Response) => {
  const body = req.body as ChatRequestBody;
  const { messages, mode, characters = Object.keys(CHARACTERS) } = body;

  const modeInstruction = getModeInstruction(mode);
  const results: { characterId: string; text: string }[] = [];

  for (const charId of characters) {
    const character = CHARACTERS[charId];
    if (!character) continue;

    const systemContent = `${character.systemPrompt}\n\n${modeInstruction}\n\nThis is a group conversation with all 5 characters. Other characters may have spoken. Respond in character with 1-3 sentences only. Be concise but immersive.`;

    try {
      const openRouterRes = await fetch(OPENROUTER_BASE_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://birthday-gift-app.replit.app",
          "X-Title": "Birthday AI Gift App",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: systemContent },
            ...messages,
          ],
          max_tokens: 200,
          temperature: 0.85,
        }),
      });

      if (!openRouterRes.ok) {
        results.push({ characterId: charId, text: character.greetingGroup });
        continue;
      }

      const data = await openRouterRes.json() as {
        choices?: { message?: { content?: string } }[];
      };
      const text = data.choices?.[0]?.message?.content ?? character.greetingGroup;
      results.push({ characterId: charId, text });
    } catch {
      results.push({ characterId: charId, text: character.greetingGroup });
    }
  }

  res.json({ responses: results });
});

export default router;
