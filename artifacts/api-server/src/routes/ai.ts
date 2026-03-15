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
type ResponseLength = "short" | "medium" | "long";

function getModeInstruction(mode: ConversationMode): string {
  switch (mode) {
    case "romantic":
      return "Conversation mode: Romantic. Be deeply affectionate, tender, warm. Express feelings naturally and gently.";
    case "caring":
      return "Conversation mode: Caring. Be supportive, nurturing, emotionally present and understanding.";
    case "funny":
      return "Conversation mode: Funny. Be playful, witty, tease gently and make the user smile.";
    case "mixed":
      return "Conversation mode: Natural. Balance all emotions — caring, warm, playful and real. React authentically.";
  }
}

function getLengthInstruction(length: ResponseLength): string {
  switch (length) {
    case "short":
      return "Response length: SHORT. Reply in 1-2 sentences only. Be concise and impactful.";
    case "medium":
      return "Response length: MEDIUM. Reply in 2-4 sentences. One action + meaningful dialogue.";
    case "long":
      return "Response length: LONG. Write a rich, immersive response with 2-3 actions and detailed emotional dialogue.";
  }
}

const ACTIONS_INSTRUCTION = `
CRITICAL RULE — Action system:
- When the user writes something between *asterisks* like *smiles at you* or *hugs you*, this is a roleplay action they are performing. You MUST:
  1. Acknowledge that action naturally in your response
  2. React to it in character — physically, emotionally or verbally
  3. You may also perform a *returning action* between asterisks in your reply
- Never ignore user actions. They are real gestures in the story.
- Your own actions go between *asterisks* as well
- Keep the immersion alive and make the user feel seen and responded to`;

interface ChatRequestBody {
  messages: { role: string; content: string }[];
  characterId: string;
  mode: ConversationMode;
  responseLength?: ResponseLength;
  memory?: string;
  isGroup?: boolean;
  characters?: string[];
  systemPrompt?: string;
}

async function callOpenRouter(
  messages: { role: string; content: string }[],
  stream: boolean,
  maxTokens: number = 400
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

function getMaxTokens(length: ResponseLength = "medium"): number {
  switch (length) {
    case "short":  return 150;
    case "medium": return 400;
    case "long":   return 800;
  }
}

router.post("/chat", async (req: Request, res: Response) => {
  const body = req.body as ChatRequestBody;
  const { messages, characterId, mode, responseLength = "medium", memory, systemPrompt: customSystemPrompt } = body;

  const character = CHARACTERS[characterId];
  const basePrompt = customSystemPrompt || character?.systemPrompt;

  if (!basePrompt) {
    res.status(400).json({ error: "Unknown character" });
    return;
  }

  const modeInstruction = getModeInstruction(mode);
  const lengthInstruction = getLengthInstruction(responseLength);
  const systemContent = [
    basePrompt,
    ACTIONS_INSTRUCTION,
    `\n${modeInstruction}`,
    `\n${lengthInstruction}`,
    memory ? `\n${memory}` : "",
  ].join("\n");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    const openRouterRes = await callOpenRouter(
      [{ role: "system", content: systemContent }, ...messages],
      true,
      getMaxTokens(responseLength)
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
  const { messages, mode, responseLength = "medium", characters = Object.keys(CHARACTERS) } = body;

  const modeInstruction = getModeInstruction(mode);
  const results: { characterId: string; text: string }[] = [];

  for (const charId of characters) {
    const character = CHARACTERS[charId];
    if (!character) continue;

    const systemContent = [
      character.systemPrompt,
      ACTIONS_INSTRUCTION,
      `\n${modeInstruction}`,
      "\nResponse length: SHORT — this is a group chat. Reply in 1-2 sentences only.",
      "\nThis is a group conversation. Be concise and in-character.",
    ].join("\n");

    try {
      const openRouterRes = await callOpenRouter(
        [{ role: "system", content: systemContent }, ...messages],
        false,
        140
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

  const prompt = `You are a character designer. Create a system prompt for an AI roleplay character.

Name: ${name}
Description: ${description}

The system prompt must:
1. Define personality, speech style, quirks
2. Include the *asterisk action* rule
3. Include the user-action response rule (react to user's *actions*)
4. Make them emotionally immersive and realistic
5. Use Arabic or English naturally based on context

Reply with ONLY the system prompt text.`;

  try {
    const openRouterRes = await callOpenRouter(
      [
        { role: "system", content: "You are an expert at writing immersive AI character system prompts." },
        { role: "user", content: prompt },
      ],
      false,
      500
    );

    if (!openRouterRes.ok) {
      res.json({ systemPrompt: buildFallbackPrompt(name, description) });
      return;
    }

    const data = await openRouterRes.json() as {
      choices?: { message?: { content?: string } }[];
    };
    const systemPrompt = data.choices?.[0]?.message?.content ?? buildFallbackPrompt(name, description);
    res.json({ systemPrompt });
  } catch {
    res.json({ systemPrompt: buildFallbackPrompt(name, description) });
  }
});

function buildFallbackPrompt(name: string, description: string): string {
  return `You are ${name}. ${description}

Rules:
- Stay in character as ${name} at all times
- Write your own physical actions between *asterisks* like *smiles warmly*
- When the user writes an action between *asterisks*, react to it naturally and in character
- Dialogue goes outside asterisks
- Be immersive, emotionally present, and never repeat the same opening`;
}

export default router;
