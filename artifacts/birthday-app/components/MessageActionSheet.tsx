import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import COLORS from "@/constants/colors";
import { Message } from "@/services/aiService";

interface MessageActionSheetProps {
  message: Message | null;
  visible: boolean;
  onClose: () => void;
  onDelete: (msg: Message) => void;
  onEdit: (msg: Message) => void;
  onRewind: (msg: Message) => void;
  accentColor?: string;
}

export function MessageActionSheet({
  message,
  visible,
  onClose,
  onDelete,
  onEdit,
  onRewind,
  accentColor = COLORS.accent,
}: MessageActionSheetProps) {
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 300,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!message) return null;

  const isUser = message.role === "user";
  const previewText = message.content.slice(0, 80) + (message.content.length > 80 ? "…" : "");

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
        pointerEvents="box-none"
      >
        <LinearGradient colors={[COLORS.bgCard, COLORS.bgDeep]} style={styles.sheetInner}>
          <View style={styles.handle} />

          <View style={styles.previewRow}>
            <View
              style={[
                styles.roleTag,
                { backgroundColor: isUser ? `${COLORS.accent}22` : `${accentColor}22` },
              ]}
            >
              <Text style={[styles.roleTagText, { color: isUser ? COLORS.accent : accentColor }]}>
                {isUser ? "Your message" : "AI message"}
              </Text>
            </View>
          </View>

          <Text style={styles.previewText} numberOfLines={2}>
            {previewText}
          </Text>

          <View style={styles.divider} />

          <View style={styles.actions}>
            {isUser && (
              <ActionBtn
                icon="pencil"
                label="Edit & Resend"
                color="#7EC8E3"
                onPress={() => {
                  onEdit(message);
                  onClose();
                }}
              />
            )}

            <ActionBtn
              icon="arrow-undo"
              label="Rewind to here"
              color={COLORS.accentGold}
              onPress={() => {
                onRewind(message);
                onClose();
              }}
            />

            <ActionBtn
              icon="trash"
              label="Delete message"
              color={COLORS.error}
              onPress={() => {
                onDelete(message);
                onClose();
              }}
            />

            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </LinearGradient>
      </Animated.View>
    </Modal>
  );
}

function ActionBtn({
  icon,
  label,
  color,
  onPress,
}: {
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionBtn,
        { backgroundColor: `${color}11`, borderColor: `${color}33`, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <View style={[styles.actionIcon, { backgroundColor: `${color}22` }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={14} color={`${color}66`} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheetInner: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 36,
    gap: 12,
    borderTopWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.borderSoft,
    alignSelf: "center",
    marginBottom: 4,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  roleTag: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  roleTagText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.5,
  },
  previewText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
    paddingHorizontal: 4,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
  actions: {
    gap: 8,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
  },
  cancelBtn: {
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: COLORS.bgCard,
    marginTop: 4,
  },
  cancelText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: COLORS.textSecondary,
  },
});
