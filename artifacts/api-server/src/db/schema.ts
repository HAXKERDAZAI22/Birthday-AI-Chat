import { pgTable, serial, text, timestamp, real, integer } from "drizzle-orm/pg-core";

export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  characterId: text('character_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  lastInteraction: timestamp('last_interaction').defaultNow(),
  totalMessages: integer('total_messages').default(0),
  relationshipStage: text('relationship_stage').default('stranger'),
  userPreferences: text('user_preferences').default('{}'),
  sharedMemories: text('shared_memories').default('[]'),
  emotionalHistory: text('emotional_history').default('[]'),
});

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  actions: text('actions'),
  dialogue: text('dialogue'),
  emotionDetected: text('emotion_detected'),
  emotionConfidence: real('emotion_confidence').default(0.5),
  timestamp: timestamp('timestamp').defaultNow(),
});

export const memorySummaries = pgTable('memory_summaries', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').notNull(),
  summaryText: text('summary_text').notNull(),
  emotionalArc: text('emotional_arc'),
  keyTopics: text('key_topics'),
  unresolvedThreads: text('unresolved_threads'),
  periodStart: timestamp('period_start'),
  periodEnd: timestamp('period_end'),
  messageCount: integer('message_count'),
  createdAt: timestamp('created_at').defaultNow(),
});
