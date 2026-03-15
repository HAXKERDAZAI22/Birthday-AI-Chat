import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import { CHARACTERS } from "../characters/index.js";

const router: IRouter = Router();

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

const OPENROUTER_API_KEY =
  process.env.OPENAI_API_KEY2 ||
  process.env.OPENROUTER_API_KEY ||
  process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY ||
  "";

const MODEL = "deepseek/deepseek-chat-v3-0324";

type ConversationMode = "romantic" | "caring" | "funny" | "mixed";

function getModeInstruction(mode: ConversationMode): string {
  switch (mode) {
    case "romantic":
      return "\n\nConversation mode: Romantic. Be affectionate, warm, tender, and deeply caring. Express gentle feelings naturally.";
    case "caring":
      return "\n\nConversation mode: Caring. Be supportive, understanding, nurturing, and emotionally present.";
    case "funny":
      return "\n\nConversation mode: Funny. Be playful, witty, tease gently, make jokes in character.";
    case "mixed":
      return "\n\nConversation mode: Mixed. Balance all moods naturally — caring, playful, warm, and real.";
  }
}

interface ChatRequestBody {
  messages: { role: string; content: string }[];
  characterId: string;
  mode: ConversationMode;
  memory?: string;
  isGroup?: boolean;
  characters?: string[];
  systemPrompt?: string;
}

async function callOpenRouter(
  messages: { role: string; content: string }[],
  stream: boolean,
  maxTokens: number = 600
) {
  return fetch(OPENROUTER_BASE_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://birthday-gift-app.replit.app",
      "X-Title": "Birthday AI Gift App",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream,
      max_tokens: maxTokens,
      temperature: 0.88,
      top_p: 0.95,
    }),
  });
}

router.post("/chat", async (req: Request, res: Response) => {
  const body = req.body as ChatRequestBody;
  const { messages, characterId, mode, memory, systemPrompt: customSystemPrompt } = body;

  const character = CHARACTERS[characterId];
  const basePrompt = customSystemPrompt || character?.systemPrompt;

  if (!basePrompt) {
    res.status(400).json({ error: "Unknown character" });
    return;
  }

  const modeInstruction = getModeInstruction(mode);
  const systemContent = `${basePrompt}${modeInstruction}${memory ? `\n\n${memory}` : ""}`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    const openRouterRes = await callOpenRouter(
      [{ role: "system", content: systemContent }, ...messages],
      true,
      600
    );

    if (!openRouterRes.ok) {
      const errorText = await openRouterRes.text();
      console.error("OpenRouter error:", errorText);
      res.write(`data: ${JSON.stringify({ content: "*takes a slow breath* Something got in the way. Try again?", characterId })}\n\n`);
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

    const systemContent = `${character.systemPrompt}${modeInstruction}\n\nThis is a group conversation. Respond in character with 1-2 sentences only. Be concise and immersive. Use the *action* format only if needed.`;

    try {
      const openRouterRes = await callOpenRouter(
        [{ role: "system", content: systemContent }, ...messages],
        false,
        160
      );

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

router.post("/generate-character", async (req: Request, res: Response) => {
  const { name, description } = req.body as { name: string; description: string };

  if (!name || !description) {
    res.status(400).json({ error: "name and description are required" });
    return;
  }

  const prompt = `You are a character designer AI. A user wants to create a custom AI character for roleplay conversations.

Character Name: ${name}
User Description: ${description}

Generate a detailed system prompt for this character that:
1. Defines their exact personality traits and speech patterns
2. Specifies how they act in romantic, caring, playful, and serious situations
3. Describes their quirks and unique mannerisms
4. Uses *asterisks* to denote physical actions in conversation
5. Makes them feel real, immersive and emotionally engaging

Respond with ONLY the system prompt text, nothing else.`;

  try {
    const openRouterRes = await callOpenRouter(
      [
        { role: "system", content: "You are an expert at creating immersive AI character system prompts for roleplay." },
        { role: "user", content: prompt },
      ],
      false,
      500
    );

    if (!openRouterRes.ok) {
      const fallback = buildFallbackPrompt(name, description);
      res.json({ systemPrompt: fallback });
      return;
    }

    const data = await openRouterRes.json() as {
      choices?: { message?: { content?: string } }[];
    };
    const systemPrompt = data.choices?.[0]?.message?.content ?? buildFallbackPrompt(name, description);
    res.json({ systemPrompt });
  } catch (err) {
    console.error("generate-character error:", err);
    res.json({ systemPrompt: buildFallbackPrompt(name, description) });
  }
});

function buildFallbackPrompt(name: string, description: string): string {
  return `You are ${name}. ${description}

Rules:
- Stay in character as ${name} at all times
- Place all physical actions between *asterisks* like *smiles softly*
- Dialogue goes outside asterisks
- Be immersive and emotionally engaging
- Stay true to the personality described
- Vary your responses and never repeat the same opening line`;
}

export default router;
