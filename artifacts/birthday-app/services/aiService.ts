import { fetch } from "expo/fetch";
import { getApiUrl } from "@/lib/query-client";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  characterId?: string;
  timestamp: number;
}

export interface ChatRequest {
  messages: { role: string; content: string }[];
  characterId: string;
  mode: ConversationMode;
  responseLength?: ResponseLength;
  memory?: string;
  isGroup?: boolean;
  characters?: string[];
  systemPrompt?: string;
}

export type ConversationMode = "romantic" | "caring" | "funny" | "mixed";
export type ResponseLength = "short" | "medium" | "long";

let msgCounter = 0;
export function generateMsgId(): string {
  msgCounter++;
  return `msg-${Date.now()}-${msgCounter}-${Math.random().toString(36).substr(2, 9)}`;
}

export async function streamChatResponse(
  request: ChatRequest,
  onChunk: (text: string, characterId: string) => void,
  onDone: () => void,
  onError: (err: Error) => void
) {
  const baseUrl = getApiUrl();
  try {
    const response = await fetch(`${baseUrl}api/ai/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

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
        const data = line.slice(6);
        if (data === "[DONE]") {
          onDone();
          continue;
        }
        try {
          const parsed = JSON.parse(data);
          if (parsed.content && parsed.characterId) {
            onChunk(parsed.content, parsed.characterId);
          }
        } catch {}
      }
    }
    onDone();
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

export async function streamGroupChatResponse(
  request: ChatRequest,
  onCharacterResponse: (characterId: string, fullText: string) => void,
  onDone: () => void,
  onError: (err: Error) => void
) {
  const baseUrl = getApiUrl();
  try {
    const response = await fetch(`${baseUrl}api/ai/group-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) throw new Error(`Server error: ${response.status}`);

    const data = await response.json() as { responses: { characterId: string; text: string }[] };
    for (const r of data.responses) {
      onCharacterResponse(r.characterId, r.text);
    }
    onDone();
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}
