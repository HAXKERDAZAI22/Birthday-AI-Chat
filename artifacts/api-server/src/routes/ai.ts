import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import { CHARACTERS } from "../characters/index.js";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "../db/schema.js";

const router: IRouter = Router();

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

const OPENROUTER_API_KEY =
  process.env.OPENAI_API_KEY2 ||
  process.env.OPENROUTER_API_KEY ||
  process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY ||
  "";

const DATABASE_URL = process.env.DATABASE_URL || "";

const MODEL = "deepseek/deepseek-chat-v3-0324";
const SUMMARY_MODEL = "anthropic/claude-3-haiku";

// ==================== NEON POSTGRES SETUP ====================
const sql = neon(DATABASE_URL);
const db = drizzle(sql, { schema });

// ==================== SECURITY: SANITIZATION ====================
function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/['";\\]/g, '')
    .replace(/[<>]/g, '')
    .replace(/--/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim()
    .slice(0, 100);
}

function validateUserId(userId: string): boolean {
  return /^[a-zA-Z0-9_-]{1,50}$/.test(userId);
}

function validateCharacterId(charId: string): boolean {
  return /^[a-zA-Z0-9_-]{1,50}$/.test(charId);
}

// ==================== نظام النجمتين المتقدم ====================
function parseAsteriskSystem(text: string): { 
  actions: string[]; 
  dialogue: string; 
  raw: string;
} {
  const actions: string[] = [];
  let dialogue = "";
  let lastIndex = 0;
  const actionPattern = /\*([\s\S]*?)\*/g;
  let match;
  
  while ((match = actionPattern.exec(text)) !== null) {
    const beforeAction = text.slice(lastIndex, match.index).trim();
    if (beforeAction) dialogue += (dialogue ? " " : "") + beforeAction;
    
    const actionContent = match[1].trim();
    if (actionContent) actions.push(actionContent);
    
    lastIndex = match.index + match[0].length;
  }
  
  const afterLast = text.slice(lastIndex).trim();
  if (afterLast) dialogue += (dialogue ? " " : "") + afterLast;
  
  return { actions, dialogue: dialogue.trim(), raw: text };
}

// ==================== تحليل المشاعر السياقي ====================
function analyzeContextualEmotion(text: string): { emotion: string; confidence: number } {
  const lowerText = text.toLowerCase();
  
  const patterns: Array<{ regex: RegExp; emotion: string; weight: number }> = [
    { regex: /(الحمدلله|أشعر.*(رائع|ممتاز)|يوم.*(جميل| wonderful))/i, emotion: 'genuine_happy', weight: 0.9 },
    { regex: /(لست.*(حزين|محبط)|لا.*(أبكي|حزن)|أتجاوز)/i, emotion: 'not_sad', weight: 0.8 },
    { regex: /(فقدت.*(شخص|صديق)|قلبي.*(مكسور|ثقيل))/i, emotion: 'grief', weight: 0.95 },
    { regex: /(غاضب.*(جداً|كثيراً)|أشعر.*(غضب|حنق))/i, emotion: 'anger', weight: 0.85 },
    { regex: /(أحبك.*(حقاً|بصدق)|أشتاق.*(إليك|لرؤيتك))/i, emotion: 'deep_romantic', weight: 0.9 },
    { regex: /(هل.*(بخير|صحيح)|أخاف.*(عليك|من))/i, emotion: 'genuine_care', weight: 0.85 },
  ];
  
  let maxConfidence = 0;
  let detectedEmotion = 'neutral';
  
  for (const pattern of patterns) {
    if (pattern.regex.test(text) && pattern.weight > maxConfidence) {
      maxConfidence = pattern.weight;
      detectedEmotion = pattern.emotion;
    }
  }
  
  return { emotion: detectedEmotion, confidence: maxConfidence };
}

// ==================== الوعي الزماني ====================
function calculateTimeContext(lastTimestamp: string | null): {
  gap: string;
  context: string;
  emotionalImpact: string;
} {
  if (!lastTimestamp) {
    return { gap: 'first_time', context: '', emotionalImpact: 'curious' };
  }
  
  const last = new Date(lastTimestamp);
  const now = new Date();
  const diffMs = now.getTime() - last.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);
  
  if (diffMins < 5) {
    return { gap: 'moments', context: 'الحديث لا يزال مستمراً', emotionalImpact: 'present' };
  } else if (diffMins < 30) {
    return { gap: 'minutes', context: `انقطع حديثنا قبل ${diffMins} دقيقة`, emotionalImpact: 'mild_concern' };
  } else if (diffHours < 2) {
    return { gap: 'hour', context: `غبت عني ساعة تقريباً`, emotionalImpact: 'noticing_absence' };
  } else if (diffHours < 12) {
    return { gap: 'hours', context: `انقطعنا ${diffHours} ساعات`, emotionalImpact: 'questioning' };
  } else if (diffDays < 2) {
    return { gap: 'day', context: `يوم كامل... هل نمت جيداً؟`, emotionalImpact: 'caring_check' };
  } else if (diffDays < 7) {
    return { gap: 'days', context: `${diffDays} أيام من الصمت`, emotionalImpact: 'relief_worry' };
  } else if (diffWeeks < 4) {
    return { gap: 'weeks', context: `${diffWeeks} أسابيع... شعرت بالغياب`, emotionalImpact: 'hurt_concern' };
  } else {
    return { gap: 'months', context: `وقت طويل جداً... ${diffWeeks} أسابيع`, emotionalImpact: 'bittersweet' };
  }
}

function buildTimeAwarePrompt(
  basePrompt: string,
  timeContext: ReturnType<typeof calculateTimeContext>,
  relationshipStage: string
): string {
  let timeInstruction = `[TIME GAP: ${timeContext.gap}] [EMOTION: ${timeContext.emotionalImpact}]\n[CONTEXT: ${timeContext.context}]`;
  
  const relationshipModifier = relationshipStage === 'intimate' 
    ? ' Your intimacy makes the absence feel heavier.'
    : relationshipStage === 'stranger'
    ? ' Keep it light, you barely know each other.'
    : '';
  
  return `${basePrompt}\n\n${timeInstruction}${relationshipModifier}`;
}

// ==================== DATABASE OPERATIONS ====================
async function getOrCreateConversation(userId: string, characterId: string) {
  const existing = await db.query.conversations.findFirst({
    where: (conv, { eq, and }) => and(eq(conv.userId, userId), eq(conv.characterId, characterId))
  });
  
  if (existing) {
    await db.update(schema.conversations)
      .set({ lastInteraction: new Date() })
      .where(schema.conversations.id.eq(existing.id));
    return existing;
  }
  
  const result = await db.insert(schema.conversations).values({
    userId,
    characterId,
    relationshipStage: 'stranger',
    userPreferences: '{}',
    sharedMemories: '[]',
    emotionalHistory: '[]'
  }).returning();
  
  return result[0];
}

async function saveMessage(
  conversationId: number, 
  role: string, 
  content: string
) {
  const parsed = parseAsteriskSystem(content);
  const emotion = analyzeContextualEmotion(parsed.dialogue);
  
  await db.insert(schema.messages).values({
    conversationId,
    role,
    content,
    actions: JSON.stringify(parsed.actions),
    dialogue: parsed.dialogue,
    emotionDetected: emotion.emotion,
    emotionConfidence: emotion.confidence
  });
  
  await db.update(schema.conversations)
    .set({ totalMessages: sql`${schema.conversations.totalMessages} + 1` })
    .where(schema.conversations.id.eq(conversationId));
  
  return { parsed, emotion };
}

async function getEternalMemory(conversationId: number) {
  const recentMessages = await db.query.messages.findMany({
    where: (msg, { eq, gte }) => and(
      eq(msg.conversationId, conversationId),
      gte(msg.timestamp, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    ),
    orderBy: (msg, { asc }) => asc(msg.timestamp),
    limit: 50
  });
  
  const summaries = await db.query.memorySummaries.findMany({
    where: eq(schema.memorySummaries.conversationId, conversationId),
    orderBy: (sum, { desc }) => desc(sum.createdAt)
  });
  
  const conversation = await db.query.conversations.findFirst({
    where: eq(schema.conversations.id, conversationId)
  });
  
  const lastMsg = recentMessages[recentMessages.length - 1];
  
  return {
    recentMessages,
    summaries,
    lastInteraction: lastMsg?.timestamp || null,
    relationshipStage: conversation?.relationshipStage || 'stranger'
  };
}

// ==================== AI SUMMARIZATION ====================
async function createAISummary(conversationId: number) {
  const oldMessages = await db.query.messages.findMany({
    where: (msg, { eq, lt }) => and(
      eq(msg.conversationId, conversationId),
      lt(msg.timestamp, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    ),
    orderBy: (msg, { asc }) => asc(msg.timestamp)
  });
  
  if (oldMessages.length < 10) return;
  
  const text = oldMessages.map(m => `${m.role}: ${m.dialogue || m.content}`).join('\n');
  
  try {
    const response = await fetch(OPENROUTER_BASE_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: SUMMARY_MODEL,
        messages: [
          { role: "system", content: "Summarize this conversation history. Return JSON: {summary, emotional_arc, key_topics[], unresolved_threads[]}" },
          { role: "user", content: text.slice(0, 3000) }
        ],
        max_tokens: 400,
        temperature: 0.3
      }),
    });
    
    if (!response.ok) return;
    
    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content || '';
    
    let parsed: any = {};
    try {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    } catch {}
    
    await db.insert(schema.memorySummaries).values({
      conversationId,
      summaryText: parsed.summary || content.slice(0, 500),
      emotionalArc: parsed.emotional_arc || 'unknown',
      keyTopics: JSON.stringify(parsed.key_topics || []),
      unresolvedThreads: JSON.stringify(parsed.unresolved_threads || []),
      periodStart: oldMessages[0].timestamp,
      periodEnd: oldMessages[oldMessages.length - 1].timestamp,
      messageCount: oldMessages.length
    });
    
    await db.delete(schema.messages)
      .where(
        and(
          eq(schema.messages.conversationId, conversationId),
          lt(schema.messages.timestamp, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        )
      );
  } catch (err) {
    console.error("Summarization failed:", err);
  }
}

// ==================== ENDPOINTS ====================
router.get("/memory/:userId/:characterId", async (req: Request, res: Response) => {
  const userId = sanitizeInput(req.params.userId);
  const characterId = sanitizeInput(req.params.characterId);
  
  if (!validateUserId(userId) || !validateCharacterId(characterId)) {
    res.status(400).json({ error: "Invalid ID format" });
    return;
  }
  
  try {
    const conversation = await db.query.conversations.findFirst({
      where: (conv, { eq, and }) => and(eq(conv.userId, userId), eq(conv.characterId, characterId))
    });
    
    if (!conversation) {
      res.json({ exists: false });
      return;
    }
    
    const memory = await getEternalMemory(conversation.id);
    const timeContext = calculateTimeContext(memory.lastInteraction);
    
    res.json({
      exists: true,
      relationship: conversation.relationshipStage,
      timeGap: timeContext.gap,
      timeContext: timeContext.context,
      recentCount: memory.recentMessages.length,
      summaryCount: memory.summaries.length
    });
  } catch (err) {
    console.error("Memory error:", err);
    res.status(500).json({ error: "Failed to fetch memory" });
  }
});

router.post("/chat", async (req: Request, res: Response) => {
  const body = req.body as any;
  const { 
    messages, 
    characterId, 
    mode = 'mixed', 
    responseLength = 'medium',
    userId = 'anonymous'
  } = body;

  const safeUserId = sanitizeInput(userId);
  const safeCharId = sanitizeInput(characterId);
  
  if (!validateUserId(safeUserId) || !validateCharacterId(safeCharId)) {
    res.status(400).json({ error: "Invalid user_id or character_id" });
    return;
  }

  const character = CHARACTERS[safeCharId];
  if (!character?.systemPrompt) {
    res.status(400).json({ error: "Unknown character" });
    return;
  }

  let conversationId: number | null = null;
  let memory: any = null;
  let timeContext: any = null;

  if (safeUserId !== 'anonymous') {
    try {
      const conv = await getOrCreateConversation(safeUserId, safeCharId);
      conversationId = conv.id;
      memory = await getEternalMemory(conversationId);
      timeContext = calculateTimeContext(memory.lastInteraction);
      
      const userMsgs = messages.filter((m: any) => m.role === 'user');
      for (const msg of userMsgs) {
        await saveMessage(conversationId, 'user', msg.content);
      }
    } catch (err) {
      console.error("Memory error:", err);
    }
  }

  let systemPrompt = character.systemPrompt;
  if (timeContext) {
    systemPrompt = buildTimeAwarePrompt(systemPrompt, timeContext, memory?.relationshipStage || 'stranger');
  }

  let memoryContext = '';
  if (memory?.summaries?.length > 0) {
    memoryContext = '\n\n[PAST]:\n' + memory.summaries.map((s: any) => `- ${s.summaryText.slice(0, 200)}`).join('\n');
  }

  const fullSystem = `${systemPrompt}${memoryContext}`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.flushHeaders();

  try {
    const contextMessages = memory?.recentMessages?.slice(-15).map((m: any) => ({
      role: m.role,
      content: m.content
    })) || [];

    const openRouterRes = await fetch(OPENROUTER_BASE_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: fullSystem },
          ...contextMessages,
          ...messages.slice(-3)
        ],
        stream: true,
        max_tokens: responseLength === 'short' ? 120 : responseLength === 'long' ? 700 : 350,
        temperature: 0.85,
        frequency_penalty: 0.3,
        presence_penalty: 0.4,
      }),
    });

    if (!openRouterRes.ok) throw new Error("OpenRouter failed");

    const reader = openRouterRes.body?.getReader();
    if (!reader) throw new Error("No reader");

    const decoder = new TextDecoder();
    let buffer = "";
    let fullResponse = "";

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
            fullResponse += content;
            res.write(`data: ${JSON.stringify({ content, characterId: safeCharId })}\n\n`);
          }
        } catch {}
      }
    }

    if (conversationId && fullResponse) {
      await saveMessage(conversationId, 'assistant', fullResponse);
      
      if (memory?.recentMessages?.length > 0 && memory.recentMessages.length % 100 === 0) {
        createAISummary(conversationId).catch(console.error);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("Chat error:", err);
    res.write(`data: ${JSON.stringify({ content: "*takes a breath* Something went wrong...", characterId: safeCharId })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

export default router;
