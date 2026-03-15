import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import COLORS from "@/constants/colors";
import { ConversationMode } from "@/services/aiService";

const MODES: { id: ConversationMode; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { id: "romantic", label: "رومانسي",  icon: "heart",     color: "#E8A4C8" },
  { id: "caring",   label: "حنون",     icon: "hand-left", color: "#7EC8E3" },
  { id: "funny",    label: "مرح",      icon: "happy",     color: "#E8B86D" },
  { id: "mixed",    label: "طبيعي",    icon: "sparkles",  color: "#8B9DC3" },
];

interface ModeSelectorProps {
  selected: ConversationMode;
  onSelect: (mode: ConversationMode) => void;
}

export function ModeSelector({ selected, onSelect }: ModeSelectorProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {MODES.map((m) => {
        const isActive = selected === m.id;
        return (
          <Pressable
            key={m.id}
            onPress={() => {
              Haptics.selectionAsync();
              onSelect(m.id);
            }}
            style={({ pressed }) => [
              styles.chip,
              {
                borderColor: isActive ? m.color : COLORS.border,
                backgroundColor: isActive ? `${m.color}18` : COLORS.bgCard,
                opacity: pressed ? 0.8 : 1,
                transform: [{ scale: pressed ? 0.96 : 1 }],
              },
            ]}
          >
            <Ionicons name={m.icon} size={13} color={isActive ? m.color : COLORS.textMuted} />
            <Text style={[styles.label, { color: isActive ? m.color : COLORS.textMuted }]}>
              {m.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    flexDirection: "row",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    letterSpacing: 0.3,
  },
});
