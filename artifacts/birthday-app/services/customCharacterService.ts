import AsyncStorage from "@react-native-async-storage/async-storage";
import { Character } from "@/characters";

const CUSTOM_CHARS_KEY = "@custom_characters_v1";

export interface CustomCharacter extends Character {
  isCustom: true;
  avatarUri?: string;
  description: string;
}

export async function getCustomCharacters(): Promise<CustomCharacter[]> {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_CHARS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export async function saveCustomCharacter(char: CustomCharacter): Promise<void> {
  try {
    const all = await getCustomCharacters();
    const idx = all.findIndex((c) => c.id === char.id);
    if (idx >= 0) {
      all[idx] = char;
    } else {
      all.push(char);
    }
    await AsyncStorage.setItem(CUSTOM_CHARS_KEY, JSON.stringify(all));
  } catch {}
}

export async function deleteCustomCharacter(id: string): Promise<void> {
  try {
    const all = await getCustomCharacters();
    const filtered = all.filter((c) => c.id !== id);
    await AsyncStorage.setItem(CUSTOM_CHARS_KEY, JSON.stringify(filtered));
  } catch {}
}

const CUSTOM_COLORS = [
  "#C77DFF", "#FF85A1", "#56CFE1", "#80FFDB",
  "#FFBE0B", "#FF6B6B", "#A8DADC", "#B7E4C7",
];

export function generateCustomCharacterBase(name: string): Omit<CustomCharacter, "description" | "systemPrompt"> {
  const colorIdx = Math.floor(Math.random() * CUSTOM_COLORS.length);
  const color = CUSTOM_COLORS[colorIdx];
  return {
    id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    name: name.trim(),
    title: name.trim(),
    color,
    bgGradient: [`${color}33`, "#0A0A12"],
    personality: "custom character",
    greetingGroup: `*looks toward you* "Hello."`,
    isCustom: true,
    avatarUri: undefined,
  };
}
