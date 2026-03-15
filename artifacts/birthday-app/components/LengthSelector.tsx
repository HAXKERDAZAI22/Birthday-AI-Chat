import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import COLORS from "@/constants/colors";
import { ResponseLength } from "@/services/aiService";

const LENGTHS: { id: ResponseLength; label: string; icon: keyof typeof Ionicons.glyphMap; desc: string }[] = [
  { id: "short",  label: "قصير",   icon: "remove",          desc: "جملة أو جملتان" },
  { id: "medium", label: "متوسط",  icon: "reorder-two",     desc: "فقرة" },
  { id: "long",   label: "طويل",   icon: "reorder-four",    desc: "تفصيلي وعميق" },
];

interface LengthSelectorProps {
  selected: ResponseLength;
  onSelect: (l: ResponseLength) => void;
  accentColor?: string;
}

export function LengthSelector({ selected, onSelect, accentColor = COLORS.accent }: LengthSelectorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>طول الرد:</Text>
      <View style={styles.chips}>
        {LENGTHS.map((l) => {
          const isActive = selected === l.id;
          return (
            <Pressable
              key={l.id}
              onPress={() => {
                Haptics.selectionAsync();
                onSelect(l.id);
              }}
              style={({ pressed }) => [
                styles.chip,
                {
                  borderColor: isActive ? accentColor : COLORS.border,
                  backgroundColor: isActive ? `${accentColor}18` : COLORS.bgCard,
                  opacity: pressed ? 0.8 : 1,
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                },
              ]}
            >
              <Ionicons
                name={l.icon}
                size={12}
                color={isActive ? accentColor : COLORS.textMuted}
              />
              <Text style={[styles.chipText, { color: isActive ? accentColor : COLORS.textMuted }]}>
                {l.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 5,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  label: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: COLORS.textMuted,
    flexShrink: 0,
  },
  chips: {
    flexDirection: "row",
    gap: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 0.2,
  },
});
