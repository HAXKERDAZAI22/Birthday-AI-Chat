import AsyncStorage from "@react-native-async-storage/async-storage";
import { Message } from "@/services/aiService";

const KEY_PREFIX = "@conv_";
const ALL_CONV_INDEX_KEY = "@conv_index";

function convKey(characterId: string): string {
  return `${KEY_PREFIX}${characterId}`;
}

export async function saveConversation(characterId: string, messages: Message[]): Promise<void> {
  try {
    await AsyncStorage.setItem(convKey(characterId), JSON.stringify(messages));

    const raw = await AsyncStorage.getItem(ALL_CONV_INDEX_KEY);
    const index: string[] = raw ? JSON.parse(raw) : [];
    if (!index.includes(characterId)) {
      index.push(characterId);
      await AsyncStorage.setItem(ALL_CONV_INDEX_KEY, JSON.stringify(index));
    }
  } catch {}
}

export async function loadConversation(characterId: string): Promise<Message[]> {
  try {
    const raw = await AsyncStorage.getItem(convKey(characterId));
    if (!raw) return [];
    return JSON.parse(raw) as Message[];
  } catch {
    return [];
  }
}

export async function clearConversation(characterId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(convKey(characterId));
  } catch {}
}

export async function clearAllConversations(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(ALL_CONV_INDEX_KEY);
    const index: string[] = raw ? JSON.parse(raw) : [];
    const keys = index.map(convKey);
    if (keys.length) await AsyncStorage.multiRemove(keys);
    await AsyncStorage.removeItem(ALL_CONV_INDEX_KEY);
  } catch {}
}
