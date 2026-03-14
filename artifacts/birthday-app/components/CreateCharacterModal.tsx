import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import COLORS from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";
import {
  CustomCharacter,
  generateCustomCharacterBase,
  saveCustomCharacter,
} from "@/services/customCharacterService";

interface CreateCharacterModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated: (char: CustomCharacter) => void;
}

export function CreateCharacterModal({
  visible,
  onClose,
  onCreated,
}: CreateCharacterModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const resetForm = () => {
    setName("");
    setDescription("");
    setAvatarUri(null);
    setError("");
    setLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      setError("Photo library permission is required to pick an avatar.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Please enter a character name.");
      return;
    }
    if (!description.trim()) {
      setError("Please enter a description for the character.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const base = generateCustomCharacterBase(name);

      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}api/ai/generate-character`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });

      let systemPrompt = "";
      if (res.ok) {
        const data = await res.json();
        systemPrompt = data.systemPrompt || buildFallbackPrompt(name, description);
      } else {
        systemPrompt = buildFallbackPrompt(name, description);
      }

      const newChar: CustomCharacter = {
        ...base,
        systemPrompt,
        personality: description.trim().slice(0, 80),
        description: description.trim(),
        avatarUri: avatarUri ?? undefined,
      };

      await saveCustomCharacter(newChar);
      resetForm();
      onCreated(newChar);
    } catch (err) {
      const base = generateCustomCharacterBase(name);
      const systemPrompt = buildFallbackPrompt(name, description);
      const newChar: CustomCharacter = {
        ...base,
        systemPrompt,
        personality: description.trim().slice(0, 80),
        description: description.trim(),
        avatarUri: avatarUri ?? undefined,
      };
      await saveCustomCharacter(newChar);
      resetForm();
      onCreated(newChar);
    }
  };

  const canCreate = name.trim().length > 0 && description.trim().length > 0 && !loading;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <LinearGradient colors={[COLORS.bgDeep, COLORS.bg, "#1A0D2E"]} style={styles.container}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.header}>
            <Pressable onPress={handleClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </Pressable>
            <Text style={styles.title}>Create Character</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.avatarSection}>
              <Pressable
                onPress={pickImage}
                style={({ pressed }) => [styles.avatarPicker, { opacity: pressed ? 0.8 : 1 }]}
              >
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={styles.avatarPreview}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="camera" size={28} color={COLORS.accent} />
                    <Text style={styles.avatarHint}>Add Photo</Text>
                  </View>
                )}
                <View style={styles.avatarEditBadge}>
                  <Ionicons name="pencil" size={12} color={COLORS.bg} />
                </View>
              </Pressable>
              <Text style={styles.avatarCaption}>Tap to choose character photo</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Character Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Levi, Zoro, Itachi…"
                placeholderTextColor={COLORS.textMuted}
                value={name}
                onChangeText={setName}
                maxLength={40}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Character Description</Text>
              <Text style={styles.sublabel}>
                Describe their personality, how they speak, and what they're from. The AI will generate their full behavior.
              </Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="e.g. Levi from Attack on Titan. He is cold, blunt, and extremely capable. He rarely shows emotion but deeply cares about his soldiers. He speaks in short, direct sentences and often sounds irritated..."
                placeholderTextColor={COLORS.textMuted}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={6}
                maxLength={600}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{description.length}/600</Text>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="warning" size={16} color={COLORS.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.aiHint}>
              <Ionicons name="sparkles" size={14} color={COLORS.accentGold} />
              <Text style={styles.aiHintText}>
                AI will analyze your description and define how this character thinks, speaks, and behaves in conversations.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              onPress={handleCreate}
              disabled={!canCreate}
              style={({ pressed }) => [
                styles.createBtn,
                !canCreate && { opacity: 0.5 },
                pressed && canCreate && { transform: [{ scale: 0.97 }] },
              ]}
            >
              <LinearGradient
                colors={[COLORS.accent, COLORS.accentSoft]}
                style={styles.createBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {loading ? (
                  <>
                    <ActivityIndicator color={COLORS.bg} size="small" />
                    <Text style={styles.createBtnText}>Generating character…</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="person-add" size={18} color={COLORS.bg} />
                    <Text style={styles.createBtnText}>Create Character</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </Modal>
  );
}

function buildFallbackPrompt(name: string, description: string): string {
  return `You are ${name}. ${description}

Rules:
- Stay in character as ${name} at all times
- Place all physical actions between *asterisks*
- Dialogue goes outside asterisks
- Be immersive and emotionally engaging
- Stay true to the personality described
- Use memory from previous conversations naturally`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.bgCard,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  body: {
    padding: 24,
    gap: 24,
    paddingBottom: 16,
  },
  avatarSection: {
    alignItems: "center",
    gap: 10,
  },
  avatarPicker: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: "visible",
    position: "relative",
  },
  avatarPreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${COLORS.accent}18`,
    borderWidth: 2,
    borderColor: `${COLORS.accent}44`,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  avatarHint: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: COLORS.accent,
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: COLORS.bgDeep,
  },
  avatarCaption: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: COLORS.textMuted,
  },
  field: {
    gap: 8,
  },
  label: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  sublabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 17,
  },
  input: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  textarea: {
    minHeight: 130,
    paddingTop: 13,
  },
  charCount: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: "right",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: `${COLORS.error}18`,
    borderWidth: 1,
    borderColor: `${COLORS.error}33`,
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: COLORS.error,
    flex: 1,
  },
  aiHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: `${COLORS.accentGold}11`,
    borderWidth: 1,
    borderColor: `${COLORS.accentGold}22`,
    borderRadius: 12,
    padding: 12,
  },
  aiHintText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: `${COLORS.accentGold}CC`,
    lineHeight: 18,
    flex: 1,
  },
  footer: {
    padding: 20,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  createBtn: {
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  createBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 17,
  },
  createBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: COLORS.bg,
  },
});
