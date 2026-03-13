import AsyncStorage from "@react-native-async-storage/async-storage";
import { MEMORY_KEY_PREFIX, CONVERSATION_KEY } from "@/config";
import { Message } from "./aiService";

export interface MemoryEntry {
  characterId: string;
  messages: Message[];
  importantFacts: string[];
  lastUpdated: number;
}

export interface Conversation {
  id: string;
  characterIds: string[];
  isGroup: boolean;
  messages: Message[];
  mode: string;
  lastMessage?: string;
  lastUpdated: number;
}

export async function getMemory(characterId: string): Promise<MemoryEntry> {
  try {
    const raw = await AsyncStorage.getItem(`${MEMORY_KEY_PREFIX}${characterId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    characterId,
    messages: [],
    importantFacts: [],
    lastUpdated: Date.now(),
  };
}

export async function saveMemory(characterId: string, messages: Message[]): Promise<void> {
  try {
    const existing = await getMemory(characterId);
    const updated: MemoryEntry = {
      ...existing,
      messages: messages.slice(-50),
      lastUpdated: Date.now(),
    };
    await AsyncStorage.setItem(`${MEMORY_KEY_PREFIX}${characterId}`, JSON.stringify(updated));
  } catch {}
}

export function buildMemoryContext(memory: MemoryEntry): string {
  if (memory.messages.length === 0) return "";
  const recentMessages = memory.messages.slice(-10);
  const context = recentMessages
    .map((m) => `${m.role === "user" ? "User" : "You"}: ${m.content}`)
    .join("\n");
  return `\n\nPrevious conversation context:\n${context}`;
}

export async function getAllConversations(): Promise<Conversation[]> {
  try {
    const raw = await AsyncStorage.getItem(CONVERSATION_KEY);
    if (raw) {
      const convs: Conversation[] = JSON.parse(raw);
      return convs.sort((a, b) => b.lastUpdated - a.lastUpdated);
    }
  } catch {}
  return [];
}

export async function saveConversation(conv: Conversation): Promise<void> {
  try {
    const all = await getAllConversations();
    const idx = all.findIndex((c) => c.id === conv.id);
    if (idx >= 0) {
      all[idx] = conv;
    } else {
      all.unshift(conv);
    }
    await AsyncStorage.setItem(CONVERSATION_KEY, JSON.stringify(all));
  } catch {}
}

export async function deleteConversation(convId: string): Promise<void> {
  try {
    const all = await getAllConversations();
    const filtered = all.filter((c) => c.id !== convId);
    await AsyncStorage.setItem(CONVERSATION_KEY, JSON.stringify(filtered));
  } catch {}
}

export function generateConvId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
