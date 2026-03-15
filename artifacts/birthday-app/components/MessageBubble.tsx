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

type Part = { type: "action" | "dialogue"; text: string };

function parseContent(content: string): Part[] {
  const parts: Part[] = [];
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

  const time = new Date(message.timestamp).toLocaleTimeString("ar", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <Pressable
      onLongPress={handleLongPress}
      delayLongPress={350}
      style={[
        styles.row,
        isUser ? styles.rowUser : styles.rowAssistant,
        isSelected && styles.rowSelected,
      ]}
    >
      {!isUser && character && (
        <View style={styles.avatarWrap}>
          <CharacterAvatar character={character} size={30} />
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
          <View style={[styles.userBubble, isSelected && styles.userBubbleSelected]}>
            <Text style={styles.userText}>{message.content}</Text>
            <Text style={styles.timeStampUser}>{time}</Text>
          </View>
        ) : (
          <View
            style={[
              styles.assistantBubble,
              { borderColor: `${charColor}20`, borderLeftColor: `${charColor}55` },
              isSelected && { borderColor: `${charColor}55`, borderLeftColor: charColor },
            ]}
          >
            {parts?.map((part, i) =>
              part.type === "action" ? (
                <ActionLine key={i} text={part.text} color={charColor} />
              ) : (
                <Text key={i} style={styles.dialogueText}>
                  {part.text}
                </Text>
              )
            )}
            <Text style={[styles.timeStampAssistant, { color: `${charColor}55` }]}>{time}</Text>
          </View>
        )}

        {isSelected && (
          <View style={styles.selectedBadge}>
            <Ionicons name="checkmark-circle" size={14} color={isUser ? COLORS.accent : charColor} />
            <Text style={[styles.selectedBadgeText, { color: isUser ? COLORS.accent : charColor }]}>
              اضغطي لرؤية الخيارات
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function ActionLine({ text, color }: { text: string; color: string }) {
  return (
    <View style={[styles.actionRow, { borderColor: `${color}25`, backgroundColor: `${color}0D` }]}>
      <View style={[styles.actionAccent, { backgroundColor: `${color}66` }]} />
      <Ionicons name="sparkles" size={11} color={`${color}88`} style={styles.actionIcon} />
      <Text style={[styles.actionText, { color: `${color}CC` }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 3,
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
    borderRadius: 16,
    marginHorizontal: 4,
  },
  avatarWrap: {
    marginBottom: 2,
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
    maxWidth: "82%",
    gap: 3,
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
    marginLeft: 6,
    marginBottom: 2,
    textTransform: "uppercase",
  },
  userBubble: {
    backgroundColor: COLORS.accent,
    borderRadius: 22,
    borderBottomRightRadius: 5,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: 8,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  userBubbleSelected: {
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
  },
  userText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: COLORS.bg,
    lineHeight: 22,
  },
  assistantBubble: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 22,
    borderTopLeftRadius: 5,
    paddingHorizontal: 14,
    paddingVertical: 11,
    paddingBottom: 8,
    borderWidth: 1,
    borderLeftWidth: 3,
    gap: 7,
  },
  dialogueText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: COLORS.textPrimary,
    lineHeight: 23,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
    marginVertical: 1,
  },
  actionAccent: {
    width: 2.5,
    height: "100%",
    borderRadius: 2,
    minHeight: 16,
    flexShrink: 0,
  },
  actionIcon: {
    flexShrink: 0,
  },
  actionText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    fontStyle: "italic",
    lineHeight: 19,
    flex: 1,
  },
  timeStampUser: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: `${COLORS.bg}80`,
    textAlign: "right",
    marginTop: 3,
  },
  timeStampAssistant: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    textAlign: "right",
    marginTop: 2,
  },
  selectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 4,
    marginTop: 2,
  },
  selectedBadgeText: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
  },
});
