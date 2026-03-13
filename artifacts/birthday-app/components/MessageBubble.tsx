import React from "react";
import { StyleSheet, Text, View } from "react-native";
import COLORS from "@/constants/colors";
import { Message } from "@/services/aiService";
import { CHARACTERS } from "@/characters";

interface MessageBubbleProps {
  message: Message;
  showCharacterName?: boolean;
}

function parseContent(content: string) {
  const parts: { type: "action" | "dialogue"; text: string }[] = [];
  const regex = /\*([^*]+)\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const dialogueText = content.slice(lastIndex, match.index).trim();
      if (dialogueText) parts.push({ type: "dialogue", text: dialogueText });
    }
    parts.push({ type: "action", text: match[1].trim() });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex).trim();
    if (remaining) parts.push({ type: "dialogue", text: remaining });
  }

  if (parts.length === 0) parts.push({ type: "dialogue", text: content });
  return parts;
}

export function MessageBubble({ message, showCharacterName = false }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const character = message.characterId ? CHARACTERS[message.characterId] : null;
  const charColor = character?.color ?? COLORS.accent;

  const parts = isUser ? null : parseContent(message.content);

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      {!isUser && (
        <View
          style={[
            styles.characterDot,
            { backgroundColor: `${charColor}33`, borderColor: `${charColor}66` },
          ]}
        />
      )}

      <View style={[styles.bubbleWrapper, isUser ? styles.bubbleWrapperUser : styles.bubbleWrapperAssistant]}>
        {!isUser && showCharacterName && character && (
          <Text style={[styles.charName, { color: charColor }]}>{character.name}</Text>
        )}

        {isUser ? (
          <View style={styles.userBubble}>
            <Text style={styles.userText}>{message.content}</Text>
          </View>
        ) : (
          <View style={[styles.assistantBubble, { borderColor: `${charColor}22` }]}>
            {parts?.map((part, i) =>
              part.type === "action" ? (
                <Text key={i} style={[styles.actionText, { color: `${charColor}BB` }]}>
                  *{part.text}*
                </Text>
              ) : (
                <Text key={i} style={styles.dialogueText}>
                  {part.text}
                </Text>
              )
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignItems: "flex-end",
    gap: 8,
  },
  rowUser: {
    justifyContent: "flex-end",
  },
  rowAssistant: {
    justifyContent: "flex-start",
  },
  characterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    marginBottom: 10,
    flexShrink: 0,
  },
  bubbleWrapper: {
    maxWidth: "82%",
    gap: 4,
  },
  bubbleWrapperUser: {
    alignItems: "flex-end",
  },
  bubbleWrapperAssistant: {
    alignItems: "flex-start",
  },
  charName: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    marginLeft: 4,
    marginBottom: 2,
  },
  userBubble: {
    backgroundColor: COLORS.accent,
    borderRadius: 20,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  userText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: COLORS.bg,
    lineHeight: 21,
  },
  assistantBubble: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 20,
    borderTopLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    gap: 6,
  },
  dialogueText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: COLORS.textPrimary,
    lineHeight: 22,
  },
  actionText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    fontStyle: "italic",
    lineHeight: 19,
  },
});
