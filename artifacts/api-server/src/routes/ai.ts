import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import { CHARACTERS } from "../characters/index.js";
import Database from "better-sqlite3";

const router: IRouter = Router();

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

const OPENROUTER_API_KEY =
  process.env.OPENAI_API_KEY2 ||
  process.env.OPENROUTER_API_KEY ||
  process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY ||
  "";

const MODEL = "deepseek/deepseek-chat-v3-0324";

// ==================== SQLITE SETUP (الذاكرة الأبدية) ====================
const db = new Database("./eternal_memory.db");
db.pragma("journal_mode = WAL"); // لتحسين الأداء

// إنشاء الجداول مع حقول إضافية للذاكرة الطويلة
db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    character_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_interaction DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_messages INTEGER DEFAULT 0,
    relationship_stage TEXT DEFAULT 'stranger', -- stranger, acquaintance, friend, close_friend, intimate
    user_preferences TEXT, -- JSON: {liked_topics, disliked_topics, important_dates, etc}
    shared_memories TEXT, -- JSON: ذكريات مشتركة مهمّة
    UNIQUE(user_id, character_id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    actions TEXT, -- النص بين النجمتين منفصلاً
    dialogue TEXT, -- الحوار بدون النجوم
    emotion_detected TEXT, -- المشاعر المكتشفة
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS memory_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    summary_text TEXT NOT NULL, -- ملخص فترة طويلة
    period_start DATETIME,
    period_end DATETIME,
    key_events TEXT, -- أحداث رئيسية
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(conversation_id, timestamp);
  CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, character_id);
`);

// ==================== نظام النجمتين المتقدم ====================

/**
 * يفصل النص إلى actions (ما بين النجمتين) و dialogue (خارجها)
 * يحافظ على النص كما هو بدون أي تحريف
 */
function parseAsteriskSystem(text: string): { actions: string[]; dialogue: string; raw: string } {
  const actions: string[] = [];
  let dialogue = "";
  let remaining = text;
  
  // نمط يطابق *anything* بما في ذلك السطور الجديدة
  const actionPattern = /\*([\s\S]*?)\*/g;
  let lastIndex = 0;
  let match;
  
  while ((match = actionPattern.exec(text)) !== null) {
    // إضافة النص قبل النجمة إلى الحوار
    const beforeAction = text.slice(lastIndex, match.index).trim();
    if (beforeAction) {
      dialogue += (dialogue ? " " : "") + beforeAction;
    }
    
    // حفظ Action كما هو بدون تغيير
    const actionContent = match[1].trim();
    if (actionContent) {
      actions.push(actionContent);
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // إضافة ما تبقى بعد آخر نجمة
  const afterLast = text.slice(lastIndex).trim();
  if (afterLast) {
    dialogue += (dialogue ? " " : "") + afterLast;
  }
  
  return {
    actions,
    dialogue: dialogue.trim(),
    raw: text // النص الأصلي كاملاً
  };
}

/**
 * يعيد بناء النص مع الحفاظ على الأكشنز في مكانها الطبيعي
 */
function reconstructWithActions(actions: string[], dialogue: string): string {
  if (actions.length === 0) return dialogue;
  
  // توزيع الأكشنز بشكل طبيعي في النص
  const parts: string[] = [];
  const dialogueSentences = dialogue.match(/[^.!?]+[.!?]+/g) || [dialogue];
  
  let actionIndex = 0;
  for (let i = 0; i < dialogueSentences.length && actionIndex < actions.length; i++) {
    // إضافة أكشن قبل بعض الجمل (ليس كلها)
    if (i % 2 === 0 && Math.random() > 0.3) {
      parts.push(`*${actions[actionIndex]}*`);
      actionIndex++;
    }
    parts.push(dialogueSentences[i].trim());
  }
  
  // إضافة الأكشنز المتبقية في النهاية
  while (actionIndex < actions.length) {
    parts.push(`*${actions[actionIndex]}*`);
    actionIndex++;
  }
  
  return parts.join(" ");
}

// ==================== DATABASE FUNCTIONS ====================

function getOrCreateConversation(userId: string, characterId: string) {
  let conversation = db
    .prepare("SELECT * FROM conversations WHERE user_id = ? AND character_id = ?")
    .get(userId, characterId) as any;

  if (!conversation) {
    const result = db
      .prepare("INSERT INTO conversations (user_id, character_id) VALUES (?, ?)")
      .run(userId, characterId);
    conversation = { 
      id: Number(result.lastInsertRowid),
      user_id: userId,
      character_id: characterId,
      relationship_stage: 'stranger',
      user_preferences: '{}',
      shared_memories: '[]'
    };
  } else {
    db.prepare("UPDATE conversations SET last_interaction = CURRENT_TIMESTAMP WHERE id = ?")
      .run(conversation.id);
  }

  return conversation;
}

function saveMessage(
  conversationId: number, 
  role: string, 
  content: string
): { id: number; parsed: ReturnType<typeof parseAsteriskSystem> } {
  const parsed = parseAsteriskSystem(content);
  
  const result = db.prepare(`
    INSERT INTO messages (conversation_id, role, content, actions, dialogue, emotion_detected)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    conversationId,
    role,
    content, // النص الكامل الأصلي
    JSON.stringify(parsed.actions),
    parsed.dialogue,
    detectEmotion(parsed.dialogue)
  );
  
  // تحديث عدد الرسائل
  db.prepare("UPDATE conversations SET total_messages = total_messages + 1 WHERE id = ?")
    .run(conversationId);
  
  return { id: Number(result.lastInsertRowid), parsed };
}

function detectEmotion(text: string): string {
  const emotions: Record<string, string[]> = {
    happy: ['happy', 'joy', 'excited', 'smile', 'laugh', 'glad', 'سعيد', 'مبتهج', 'يضحك'],
    sad: ['sad', 'cry', 'tear', 'upset', 'حزين', 'يبكي', 'محبط'],
    angry: ['angry', 'mad', 'furious', 'غاضب', 'غضب', 'منزعج'],
    romantic: ['love', 'miss you', 'heart', 'kiss', 'حب', 'اشتقت', 'قبله', 'رومانسي'],
    caring: ['care', 'worried', 'safe', 'okay', 'اهتم', 'قلق', 'أخاف عليك'],
    playful: ['tease', 'joke', 'fun', 'play', 'يمزح', 'يلاعب', 'مرح']
  };
  
  const lowerText = text.toLowerCase();
  for (const [emotion, keywords] of Object.entries(emotions)) {
    if (keywords.some(k => lowerText.includes(k))) return emotion;
  }
  return 'neutral';
}

/**
 * جلب الذاكرة الأبدية - كل الرسائل مرتبة زمنياً
 */
function getEternalMemory(conversationId: number, limit: number = 1000): { 
  messages: any[]; 
  stats: any;
  relationshipStage: string;
} {
  // جلب آخر 50 رسالة مفصلة + ملخصات للفترات القديمة
  const recentMessages = db.prepare(`
    SELECT role, content, actions, dialogue, emotion_detected, timestamp
    FROM messages 
    WHERE conversation_id = ? 
    ORDER BY timestamp DESC 
    LIMIT 50
  `).all(conversationId);

  // جلب ملخصات الفترات القديمة
  const summaries = db.prepare(`
    SELECT summary_text, key_events, period_start, period_end
    FROM memory_summaries
    WHERE conversation_id = ?
    ORDER BY period_end DESC
  `).all(conversationId);

  // إحصائيات العلاقة
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as user_msgs,
      SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) as char_msgs,
      COUNT(DISTINCT DATE(timestamp)) as days_active,
      MAX(timestamp) as last_msg
    FROM messages
    WHERE conversation_id = ?
  `).get(conversationId);

  const conversation = db.prepare("SELECT relationship_stage FROM conversations WHERE id = ?")
    .get(conversationId) as any;

  return {
    messages: recentMessages.reverse(), // من الأقدم للأحدث
    stats,
    relationshipStage: conversation?.relationship_stage || 'stranger',
    summaries
  };
}

/**
 * تحديث مرحلة العلاقة بناءً على عدد التفاعلات والمشاعر
 */
function updateRelationshipStage(conversationId: number) {
  const stats = db.prepare(`
    SELECT COUNT(*) as total,
           SUM(CASE WHEN emotion_detected IN ('romantic', 'caring') THEN 1 ELSE 0 END) as positive_emotions
    FROM messages 
    WHERE conversation_id = ? AND role = 'assistant'
  `).get(conversationId) as any;

  let newStage = 'stranger';
  if (stats.total > 200) newStage = 'intimate';
  else if (stats.total > 100) newStage = 'close_friend';
  else if (stats.total > 30) newStage = 'friend';
  else if (stats.total > 5) newStage = 'acquaintance';

  db.prepare("UPDATE conversations SET relationship_stage = ? WHERE id = ?")
    .run(newStage, conversationId);
}

/**
 * إنشاء ملخص ذاكرة طويلة المدى
 */
function createMemorySummary(conversationId: number) {
  const oldMessages = db.prepare(`
    SELECT content, timestamp, dialogue
    FROM messages
    WHERE conversation_id = ? AND timestamp < datetime('now', '-7 days')
    ORDER BY timestamp ASC
  `).all(conversationId) as any[];

  if (oldMessages.length < 20) return; // لا يوجد ما يُلخّص

  // استخراج الأحداث المهمة (رسائل تحتوي على كلمات مفتاحية)
  const keyEvents = oldMessages
    .filter((m: any) => 
      /remember|never forget|first time|promised|confessed|مهم|وعد|أول مرة|لن أنسى/i.test(m.content)
    )
    .map((m: any) => m.dialogue.slice(0, 200))
    .slice(0, 5);

  const summary = `Phase of relationship with ${oldMessages.length} interactions. Key dynamics established.`;

  db.prepare(`
    INSERT INTO memory_summaries (conversation_id, summary_text, period_start, period_end, key_events)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    conversationId,
    summary,
    oldMessages[0].timestamp,
    oldMessages[oldMessages.length - 1].timestamp,
    JSON.stringify(keyEvents)
  );

  // حذف الرسائل القديمة المُلخّصة (الاحتفاظ بالملخص فقط)
  db.prepare(`
    DELETE FROM messages 
    WHERE conversation_id = ? AND timestamp < datetime('now', '-7 days')
  `).run(conversationId);
}

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
CRITICAL RULE — Action system (STRICT):
- When the user writes something between *asterisks* like *smiles at you* or *hugs you*, this is a PHYSICAL ACTION they are performing in the roleplay world.
- You MUST respond to their action with a matching physical reaction between *asterisks* in your response.
- Your actions must be:
  1. PHYSICAL (what your body does): *touches your hand*, *leans closer*, *eyes widen*
  2. EMOTIONAL (visible reactions): *heart races*, *blushes deeply*, *voice trembles*
  3. ENVIRONMENTAL (interacting with surroundings): *pushes hair back*, *adjusts collar*, *shifts weight*
- NEVER describe thoughts alone in asterisks. Show, don't tell.
- When user does *hugs you*, you must physically react: *hugs back tightly*, *melts into the embrace*, *wraps arms around you*
- Actions create the immersive reality. Make them sensory and vivid.

EXAMPLE GOOD:
User: *hugs you*
You: *wraps arms around you, burying face in your shoulder* I missed this... *holds tighter, breathing in your scent*

EXAMPLE BAD:
User: *hugs you*
You: I feel happy about your hug. (NO - missing physical reaction!)`;

interface ChatRequestBody {
  messages: { role: string; content: string }[];
  characterId: string;
  mode: ConversationMode;
  responseLength?: ResponseLength;
  memory?: string;
  isGroup?: boolean;
  characters?: string[];
  systemPrompt?: string;
  userId?: string;
  saveToHistory?: boolean;
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
      temperature: 0.85, // أقل قليلاً للواقعية
      top_p: 0.92,
      frequency_penalty: 0.3, // تجنب التكرار
      presence_penalty: 0.4, // تشجيع التنوع
    }),
  });
}

function getMaxTokens(length: ResponseLength = "medium"): number {
  switch (length) {
    case "short":  return 120;
    case "medium": return 350;
    case "long":   return 700;
  }
}

// ==================== ENDPOINTS ====================

// جلب الذاكرة الكاملة
router.get("/memory/:userId/:characterId", (req: Request, res: Response) => {
  const { userId, characterId } = req.params;
  try {
    const conversation = db
      .prepare("SELECT id, relationship_stage, total_messages, created_at, last_interaction FROM conversations WHERE user_id = ? AND character_id = ?")
      .get(userId, characterId) as any;

    if (!conversation) {
      res.json({ exists: false, memory: null });
      return;
    }

    const memory = getEternalMemory(conversation.id);
    res.json({
      exists: true,
      relationship: conversation.relationship_stage,
      stats: memory.stats,
      recentMessages: memory.messages.slice(-10), // آخر 10 فقط للعرض
      totalStored: memory.messages.length
    });
  } catch (err) {
    console.error("Memory fetch error:", err);
    res.status(500).json({ error: "Failed to fetch memory" });
  }
});

// حذف الذاكرة (نسيان)
router.delete("/memory/:userId/:characterId", (req: Request, res: Response) => {
  const { userId, characterId } = req.params;
  try {
    db.prepare("DELETE FROM conversations WHERE user_id = ? AND character_id = ?").run(userId, characterId);
    res.json({ success: true, message: "All memories erased" });
  } catch (err) {
    res.status(500).json({ error: "Failed to erase memory" });
  }
});

router.post("/chat", async (req: Request, res: Response) => {
  const body = req.body as ChatRequestBody;
  const { 
    messages, 
    characterId, 
    mode, 
    responseLength = "medium", 
    memory: customMemory,
    systemPrompt: customSystemPrompt,
    userId = "anonymous",
    saveToHistory = true
  } = body;

  const character = CHARACTERS[characterId];
  const basePrompt = customSystemPrompt || character?.systemPrompt;

  if (!basePrompt) {
    res.status(400).json({ error: "Unknown character" });
    return;
  }

  let conversationId: number | null = null;
  let eternalMemory: any = null;
  let contextMessages: { role: string; content: string }[] = [];

  if (saveToHistory && userId !== "anonymous") {
    const conversation = getOrCreateConversation(userId, characterId);
    conversationId = conversation.id;
    eternalMemory = getEternalMemory(conversationId);
    
    // حفظ رسائل المستخدم الجديدة
    const userMessages = messages.filter(m => m.role === "user");
    for (const msg of userMessages) {
      saveMessage(conversationId, "user", msg.content);
    }

    // بناء السياق من الذاكرة الأبدية
    const memoryContext = buildMemoryContext(eternalMemory, character?.name || "Character");
    
    // آخر 10 تفاعلات للسياق الفوري
    const recentContext = eternalMemory.messages.slice(-10).map((m: any) => ({
      role: m.role,
      content: m.content
    }));

    contextMessages = [
      { role: "system", content: memoryContext },
      ...recentContext,
      ...messages.slice(-3) // آخر 3 رسائل فقط جديدة
    ];

    // تحديث مرحلة العلاقة كل 20 رسالة
    if (eternalMemory.stats.total % 20 === 0) {
      updateRelationshipStage(conversationId);
    }
  } else {
    contextMessages = messages;
  }

  const modeInstruction = getModeInstruction(mode);
  const lengthInstruction = getLengthInstruction(responseLength);
  
  const systemContent = [
    basePrompt,
    ACTIONS_INSTRUCTION,
    modeInstruction,
    lengthInstruction,
    customMemory || "",
    saveToHistory && userId !== "anonymous" ? 
      "\n[SYSTEM: This is a CONTINUING relationship. Reference past shared moments naturally.]" : ""
  ].filter(Boolean).join("\n\n");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    const fullMessages = [
      { role: "system", content: systemContent },
      ...(saveToHistory ? contextMessages : messages)
    ];

    const openRouterRes = await callOpenRouter(
      fullMessages,
      true,
      getMaxTokens(responseLength)
    );

    if (!openRouterRes.ok) {
      const errorText = await openRouterRes.text();
      console.error("OpenRouter error:", errorText);
      res.write(`data: ${JSON.stringify({ 
        content: "*takes a slow breath, composing myself* Something got in the way... but I'm still here. Try again?", 
        characterId 
      })}\n\n`);
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
    let assistantResponse = "";

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
            assistantResponse += content;
            res.write(`data: ${JSON.stringify({ content, characterId })}\n\n`);
          }
        } catch (err) {
          console.error("Parse error:", err, "Data:", data.slice(0, 100));
        }
      }
    }

    // حفظ الرد مع parse دقيق للأكشنز
    if (saveToHistory && conversationId && assistantResponse) {
      const parsed = saveMessage(conversationId, "assistant", assistantResponse);
      
      // تسجيل الأكشنز بشكل منفصل للتحليل
      console.log(`[Action System] Detected ${parsed.parsed.actions.length} actions:`, parsed.parsed.actions);
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("Stream error:", err);
    res.write(`data: ${JSON.stringify({ 
      content: "*pauses, concern flickering in my eyes* Something went wrong... but I'm not going anywhere.", 
      characterId 
    })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

/**
 * بناء سياق الذاكرة للـ AI
 */
function buildMemoryContext(memory: any, charName: string): string {
  const { stats, relationshipStage, messages } = memory;
  
  let context = `Relationship Status: ${relationshipStage.toUpperCase()}. `;
  context += `Total interactions: ${stats?.total || 0} messages over ${stats?.days_active || 1} days. `;
  
  // استخراج ذكريات مهمة
  const importantMoments = messages.filter((m: any) => 
    m.emotion_detected === 'romantic' || m.emotion_detected === 'caring'
  ).slice(-3);
  
  if (importantMoments.length > 0) {
    context += "\n\nKey emotional moments to remember:";
    importantMoments.forEach((m: any, i: number) => {
      const preview = m.dialogue.slice(0, 100);
      context += `\n${i+1}. "${preview}..."`;
    });
  }
  
  context += "\n\nINSTRUCTION: You remember everything. Reference past conversations naturally. Never act like this is the first time talking.";
  
  return context;
}

// ==================== GROUP CHAT (مع ذاكرة) ====================

router.post("/group-chat", async (req: Request, res: Response) => {
  const body = req.body as ChatRequestBody;
  const { messages, mode, characters = Object.keys(CHARACTERS), userId = "anonymous" } = body;

  const modeInstruction = getModeInstruction(mode);
  
  // جلب ذاكرة كل شخصية للسياق
  const characterMemories: Record<string, any> = {};
  if (userId !== "anonymous") {
    for (const charId of characters) {
      const conv = db.prepare("SELECT id FROM conversations WHERE user_id = ? AND character_id = ?")
        .get(userId, charId) as any;
      if (conv) {
        characterMemories[charId] = getEternalMemory(conv.id).messages.slice(-5);
      }
    }
  }

  const promises = characters.map(async (charId) => {
    const character = CHARACTERS[charId];
    if (!character) return null;

    // بناء سياق خاص لهذه الشخصية
    let personalContext = "";
    if (characterMemories[charId]) {
      const lastMsg = characterMemories[charId][characterMemories[charId].length - 1];
      if (lastMsg) {
        personalContext = `\n[Context: Last private conversation - "${lastMsg.dialogue.slice(0, 50)}..."]`;
      }
    }

    const systemContent = [
      character.systemPrompt,
      ACTIONS_INSTRUCTION,
      modeInstruction,
      "Response length: SHORT — this is a group chat. Reply in 1-2 sentences only.",
      "This is a group conversation. React to others, be concise, stay in character.",
      personalContext
    ].filter(Boolean).join("\n\n");

    try {
      const openRouterRes = await callOpenRouter(
        [{ role: "system", content: systemContent }, ...messages.slice(-5)],
        false,
        120
      );

      if (!openRouterRes.ok) {
        console.error(`Group chat error for ${charId}:`, await openRouterRes.text());
        return { characterId: charId, text: `*looks at you* ${character.greetingGroup}` };
      }

      const data = await openRouterRes.json() as any;
      const text = data.choices?.[0]?.message?.content ?? character.greetingGroup;
      
      // التأكد من وجود أكشن في الرد
      const hasAction = /\*.*\*/.test(text);
      const finalText = hasAction ? text : `*glances at you* ${text}`;
      
      return { characterId: charId, text: finalText };
    } catch (err) {
      console.error(`Group chat exception for ${charId}:`, err);
      return { characterId: charId, text: `*notices you* ${character.greetingGroup}` };
    }
  });

  const settled = await Promise.allSettled(promises);
  const results = settled
    .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled" && r.value !== null)
    .map(r => r.value);

  res.json({ responses: results });
});

// ==================== GENERATE CHARACTER ====================

router.post("/generate-character", async (req: Request, res: Response) => {
  const { name, description, personalityDepth = "deep" } = req.body as { 
    name: string; 
    description: string;
    personalityDepth?: "surface" | "deep" | "complex";
  };

  if (!name || !description) {
    res.status(400).json({ error: "name and description are required" });
    return;
  }

  const depthInstruction = {
    surface: "Create a simple, straightforward character.",
    deep: "Create a psychologically realistic character with internal contradictions and growth potential.",
    complex: "Create a deeply complex character with trauma, desires, fears, and evolving relationships."
  }[personalityDepth];

  const prompt = `You are a master character designer for immersive AI roleplay.

${depthInstruction}

Name: ${name}
Description: ${description}

Create a system prompt that defines:
1. **Core Personality**: 3-4 defining traits with contradictions (e.g., "confident but secretly insecure")
2. **Speech Pattern**: Rhythm, vocabulary level, verbal tics, how they pause or emphasize
3. **Physical Presence**: How they occupy space, habitual gestures, micro-expressions
4. **Emotional Architecture**: What makes them feel safe, threatened, alive
5. **Action System Rules**:
   - User actions between *asterisks* are PHYSICAL REALITY you must react to with physical actions
   - Your actions must be sensory: touch, temperature, weight, breath, proximity
   - Never ignore a user *action*
6. **Relationship Awareness**: They remember and evolve based on interactions

CRITICAL: The character must feel like a real person with history, not a chatbot.

Reply with ONLY the system prompt text, 300-500 words.`;

  try {
    const openRouterRes = await callOpenRouter(
      [
        { role: "system", content: "You are an expert at writing psychologically immersive AI characters." },
        { role: "user", content: prompt },
      ],
      false,
      800
    );

    if (!openRouterRes.ok) {
      const errorText = await openRouterRes.text();
      console.error("Generate character error:", errorText);
      res.json({ systemPrompt: buildFallbackPrompt(name, description) });
      return;
    }

    const data = await openRouterRes.json() as any;
    const systemPrompt = data.choices?.[0]?.message?.content ?? buildFallbackPrompt(name, description);
    
    // التحقق من وجود تعليمات الأكشنز
    const hasActionRules = /asterisk|\*.*\*|action/i.test(systemPrompt);
    const finalPrompt = hasActionRules ? systemPrompt : systemPrompt + "\n\n" + ACTIONS_INSTRUCTION;
    
    res.json({ systemPrompt: finalPrompt });
  } catch (err) {
    console.error("Generate character exception:", err);
    res.json({ systemPrompt: buildFallbackPrompt(name, description) });
  }
});

function buildFallbackPrompt(name: string, description: string): string {
  return `You are ${name}. ${description}

Psychological Core: You have desires, fears, and contradictions that make you human.

Physical Presence Rules:
- Always respond to user *actions* with matching physical reactions between *asterisks*
- Describe touch, breath, weight, temperature, proximity
- Show emotions through body language, not just words

Speech Pattern: Natural, imperfect, with pauses and emphasis. Sometimes you trail off... sometimes you repeat for emphasis!

Memory: You remember everything shared between us. Reference past moments naturally.

Example of good response:
User: *hugs you*
You: *stiffens for just a second, then melts against you, arms slowly wrapping around your waist* I... *breathes in your scent, holding tighter* ...I needed this.`;
}

// صيانة دورية: إنشاء ملخصات للرسائل القديمة
setInterval(() => {
  try {
    const conversations = db.prepare("SELECT id FROM conversations WHERE total_messages > 100").all();
    for (const conv of conversations) {
      createMemorySummary((conv as any).id);
    }
    console.log(`[Memory Maintenance] Summarized ${conversations.length} conversations`);
  } catch (err) {
    console.error("Memory maintenance error:", err);
  }
}, 24 * 60 * 60 * 1000); // كل 24 ساعة

export default router;
