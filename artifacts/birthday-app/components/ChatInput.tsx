import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import COLORS from "@/constants/colors";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  accentColor?: string;
  prefillText?: string;
  editMode?: boolean;
  onCancelEdit?: () => void;
}

export function ChatInput({
  onSend,
  disabled = false,
  accentColor = COLORS.accent,
  prefillText,
  editMode = false,
  onCancelEdit,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (prefillText !== undefined) {
      setText(prefillText);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [prefillText]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSend(trimmed);
    setText("");
    inputRef.current?.focus();
  };

  const canSend = text.trim().length > 0 && !disabled;

  return (
    <View style={styles.container}>
      {editMode && (
        <View style={styles.editBanner}>
          <Ionicons name="pencil" size={13} color={accentColor} />
          <Text style={[styles.editBannerText, { color: accentColor }]}>
            تعديل الرسالة
          </Text>
          <Pressable onPress={onCancelEdit} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color={`${accentColor}99`} />
          </Pressable>
        </View>
      )}
      <View style={[
        styles.inputRow,
        { borderColor: editMode ? `${accentColor}55` : COLORS.borderSoft },
      ]}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="اكتبي شيئاً..."
          placeholderTextColor={COLORS.textMuted}
          multiline
          maxLength={500}
          blurOnSubmit={false}
          returnKeyType="default"
          onSubmitEditing={handleSend}
        />
        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          style={({ pressed }) => [
            styles.sendBtn,
            {
              backgroundColor: canSend ? accentColor : COLORS.borderSoft,
              opacity: pressed ? 0.8 : 1,
              transform: [{ scale: pressed ? 0.92 : 1 }],
            },
          ]}
        >
          <Ionicons
            name={editMode ? "checkmark" : "arrow-up"}
            size={18}
            color={canSend ? COLORS.bg : COLORS.textMuted}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  editBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 6,
    paddingBottom: 6,
  },
  editBannerText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    flex: 1,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: COLORS.bgCard,
    borderRadius: 24,
    borderWidth: 1,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 8,
  },
  input: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: COLORS.textPrimary,
    maxHeight: 100,
    paddingVertical: 6,
    lineHeight: 21,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
});
