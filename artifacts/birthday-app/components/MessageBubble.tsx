import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CharacterAvatar } from "@/components/CharacterAvatar";
import { CHARACTERS } from "@/characters";
import COLORS from "@/constants/colors";
import { Message } from "@/services/aiService";

interface MessageBubbleProps {
  message: Message;
  showCharacterName?: boolean;
  isSelected?: boolean;
  onLongPress?: (msg: Message) => void;
  customCharacters?: Record<string, import("@/services/customCharacterService").CustomCharacter>;
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

export function MessageBubble({
  message,
  showCharacterName = false,
  isSelected = false,
  onLongPress,
  customCharacters = {},
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const character = message.characterId
    ? (CHARACTERS[message.characterId] ?? customCharacters[message.characterId] ?? null)
    : null;
  const charColor = character?.color ?? COLORS.accent;

  const parts = isUser ? null : parseContent(message.content);

  const handleLongPress = () => {
    if (onLongPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onLongPress(message);
    }
  };

  return (
    <Pressable
      onLongPress={handleLongPress}
      delayLongPress={400}
      style={[
        styles.row,
        isUser ? styles.rowUser : styles.rowAssistant,
        isSelected && styles.rowSelected,
      ]}
    >
      {!isUser && character && (
        <View style={styles.avatarWrap}>
          <CharacterAvatar character={character} size={28} />
        </View>
      )}
      {!isUser && !character && (
        <View style={[styles.characterDot, { backgroundColor: `${charColor}33`, borderColor: `${charColor}66` }]} />
      )}

      <View style={[styles.bubbleWrapper, isUser ? styles.bubbleWrapperUser : styles.bubbleWrapperAssistant]}>
        {!isUser && showCharacterName && character && (
          <Text style={[styles.charName, { color: charColor }]}>{character.name}</Text>
        )}

        {isUser ? (
          <View
            style={[
              styles.userBubble,
              isSelected && { borderWidth: 1.5, borderColor: `${COLORS.accent}88` },
            ]}
          >
            <Text style={styles.userText}>{message.content}</Text>
            {isSelected && (
              <View style={styles.selectedIndicator}>
                <Ionicons name="checkmark-circle" size={14} color={`${COLORS.accent}AA`} />
              </View>
            )}
          </View>
        ) : (
          <View
            style={[
              styles.assistantBubble,
              { borderColor: `${charColor}22` },
              isSelected && { borderColor: `${charColor}66`, borderWidth: 1.5 },
            ]}
          >
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
            {isSelected && (
              <View style={styles.selectedIndicator}>
                <Ionicons name="checkmark-circle" size={14} color={`${charColor}AA`} />
              </View>
            )}
          </View>
        )}
      </View>
    </Pressable>
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
  rowSelected: {
    backgroundColor: `${COLORS.accent}08`,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  avatarWrap: {
    marginBottom: 4,
    flexShrink: 0,
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
    maxWidth: "80%",
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
  selectedIndicator: {
    alignSelf: "flex-end",
    marginTop: 4,
  },
});
