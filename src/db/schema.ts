import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  characterId: text('character_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  lastInteraction: timestamp('last_interaction').defaultNow(),
  totalMessages: integer('total_messages').default(0),
});

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  timestamp: timestamp('timestamp').defaultNow(),
});
