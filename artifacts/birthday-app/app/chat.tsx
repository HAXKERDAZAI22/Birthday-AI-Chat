import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CharacterAvatar } from "@/components/CharacterAvatar";
import { ChatInput } from "@/components/ChatInput";
import { MessageBubble } from "@/components/MessageBubble";
import { ModeSelector } from "@/components/ModeSelector";
import { TypingIndicator } from "@/components/TypingIndicator";
import { CHARACTER_LIST, CHARACTERS, Character } from "@/characters";
import COLORS from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import {
  ConversationMode,
  Message,
  generateMsgId,
  streamChatResponse,
  streamGroupChatResponse,
} from "@/services/aiService";
import {
  buildMemoryContext,
  getMemory,
  saveMemory,
} from "@/services/memoryService";

type ChatMode = "select" | "individual" | "group";

export default function ChatScreen() {
  const { resetIntro } = useApp();
  const insets = useSafeAreaInsets();
  const [chatMode, setChatMode] = useState<ChatMode>("select");
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);
  const [groupActive, setGroupActive] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [mode, setMode] = useState<ConversationMode>("mixed");
  const initializedRef = useRef(false);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const botInset = Platform.OS === "web" ? 34 : insets.bottom;

  const accentColor =
    chatMode === "group"
      ? COLORS.accent
      : selectedChar?.color ?? COLORS.accent;

  const handleSelectChar = (char: Character) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedChar(char);
    setMessages([]);
    initializedRef.current = false;
    setChatMode("individual");
  };

  const handleGroupChat = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGroupActive(true);
    setSelectedChar(null);
    setMessages([]);
    initializedRef.current = false;
    setChatMode("group");
  };

  const handleBack = () => {
    setMessages([]);
    setIsStreaming(false);
    setShowTyping(false);
    setChatMode("select");
    setSelectedChar(null);
    setGroupActive(false);
    initializedRef.current = false;
  };

  const handleSend = useCallback(
    async (text: string) => {
      if (isStreaming) return;

      const currentMessages = [...messages];
      const userMsg: Message = {
        id: generateMsgId(),
        role: "user",
        content: text,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);
      setShowTyping(true);

      if (chatMode === "group") {
        await streamGroupChatResponse(
          {
            messages: [
              ...currentMessages.map((m) => ({ role: m.role, content: m.content })),
              { role: "user", content: text },
            ],
            characterId: "group",
            mode,
            isGroup: true,
            characters: Object.keys(CHARACTERS),
          },
          (characterId, fullText) => {
            setMessages((prev) => [
              ...prev,
              {
                id: generateMsgId(),
                role: "assistant",
                content: fullText,
                characterId,
                timestamp: Date.now(),
              },
            ]);
          },
          () => {
            setIsStreaming(false);
            setShowTyping(false);
          },
          (err) => {
            console.error(err);
            setIsStreaming(false);
            setShowTyping(false);
            setMessages((prev) => [
              ...prev,
              {
                id: generateMsgId(),
                role: "assistant",
                content: "Something went wrong. Please try again.",
                characterId: "kaneki",
                timestamp: Date.now(),
              },
            ]);
          }
        );
        return;
      }

      if (!selectedChar) return;

      const memory = await getMemory(selectedChar.id);
      const memoryContext = buildMemoryContext(memory);

      let fullContent = "";
      let assistantAdded = false;
      const assistantId = generateMsgId();

      await streamChatResponse(
        {
          messages: [
            ...currentMessages.map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: text },
          ],
          characterId: selectedChar.id,
          mode,
          memory: memoryContext,
        },
        (chunk, _characterId) => {
          fullContent += chunk;
          if (!assistantAdded) {
            setShowTyping(false);
            setMessages((prev) => [
              ...prev,
              {
                id: assistantId,
                role: "assistant",
                content: fullContent,
                characterId: selectedChar.id,
                timestamp: Date.now(),
              },
            ]);
            assistantAdded = true;
          } else {
            setMessages((prev) => {
              const updated = [...prev];
              const idx = updated.findIndex((m) => m.id === assistantId);
              if (idx >= 0) {
                updated[idx] = { ...updated[idx], content: fullContent };
              }
              return updated;
            });
          }
        },
        async () => {
          setIsStreaming(false);
          setShowTyping(false);
          const allMsgs = [
            ...currentMessages,
            userMsg,
            ...(fullContent
              ? [
                  {
                    id: assistantId,
                    role: "assistant" as const,
                    content: fullContent,
                    characterId: selectedChar.id,
                    timestamp: Date.now(),
                  },
                ]
              : []),
          ];
          await saveMemory(selectedChar.id, allMsgs);
        },
        (err) => {
          console.error(err);
          setIsStreaming(false);
          setShowTyping(false);
          setShowTyping(false);
          if (!assistantAdded) {
            setMessages((prev) => [
              ...prev,
              {
                id: generateMsgId(),
                role: "assistant",
                content: "*sighs quietly* I seem to be having trouble right now. Try again?",
                characterId: selectedChar.id,
                timestamp: Date.now(),
              },
            ]);
          }
        }
      );
    },
    [isStreaming, messages, chatMode, selectedChar, mode]
  );

  const reversedMessages = [...messages].reverse();

  if (chatMode === "select") {
    return (
      <LinearGradient
        colors={[COLORS.bgDeep, COLORS.bg]}
        style={[styles.container, { paddingTop: topInset }]}
      >
        <View style={styles.selectHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.selectTitle}>Characters</Text>
            <Text style={styles.selectSub}>Choose who to talk with</Text>
          </View>
          <Pressable
            onPress={() =>
              Alert.alert("Replay Intro", "Replay the intro sequence?", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Replay",
                  onPress: async () => {
                    await resetIntro();
                    router.replace("/intro");
                  },
                },
              ])
            }
            hitSlop={10}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Ionicons name="refresh-circle-outline" size={26} color={`${COLORS.accent}88`} />
          </Pressable>
        </View>

        <View style={styles.characterGrid}>
          {CHARACTER_LIST.map((char) => (
            <Pressable
              key={char.id}
              onPress={() => handleSelectChar(char)}
              style={({ pressed }) => [
                styles.characterCard,
                {
                  borderColor: `${char.color}44`,
                  backgroundColor: `${char.color}0D`,
                  opacity: pressed ? 0.85 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
            >
              <CharacterAvatar character={char} size={52} />
              <View style={styles.cardInfo}>
                <Text style={[styles.cardName, { color: char.color }]}>
                  {char.name}
                </Text>
                <Text style={styles.cardPersonality} numberOfLines={2}>
                  {char.personality}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={`${char.color}66`}
              />
            </Pressable>
          ))}

          <Pressable
            onPress={handleGroupChat}
            style={({ pressed }) => [
              styles.groupCard,
              {
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
          >
            <LinearGradient
              colors={["#1A0D2E", "#0D1A2E", "#0D2010"]}
              style={styles.groupCardGradient}
            >
              <View style={styles.groupAvatarRow}>
                {CHARACTER_LIST.slice(0, 3).map((char) => (
                  <View
                    key={char.id}
                    style={[
                      styles.groupAvatarSmall,
                      { borderColor: `${char.color}66`, backgroundColor: `${char.color}22` },
                    ]}
                  >
                    <Text style={[styles.groupInitial, { color: char.color }]}>
                      {char.name[0]}
                    </Text>
                  </View>
                ))}
                <View style={[styles.groupAvatarSmall, styles.groupMore]}>
                  <Text style={styles.groupMoreText}>+2</Text>
                </View>
              </View>
              <View style={styles.groupCardInfo}>
                <Text style={styles.groupCardName}>Group Chat</Text>
                <Text style={styles.groupCardSub}>All 5 characters together</Text>
              </View>
              <Ionicons name="people" size={20} color={COLORS.accent} />
            </LinearGradient>
          </Pressable>
        </View>
      </LinearGradient>
    );
  }

  const headerTitle =
    chatMode === "group"
      ? "Group Chat"
      : selectedChar?.name ?? "Chat";
  const headerColor = accentColor;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: COLORS.bg }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <LinearGradient
        colors={[COLORS.bgDeep, COLORS.bg]}
        style={[styles.chatHeader, { paddingTop: topInset + 4 }]}
      >
        <Pressable onPress={handleBack} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textSecondary} />
        </Pressable>

        <View style={styles.headerCenter}>
          {chatMode === "group" ? (
            <View style={styles.groupHeaderAvatars}>
              {CHARACTER_LIST.slice(0, 3).map((char) => (
                <View
                  key={char.id}
                  style={[
                    styles.miniAvatar,
                    { borderColor: `${char.color}66`, backgroundColor: `${char.color}22` },
                  ]}
                >
                  <Text style={[styles.miniInitial, { color: char.color }]}>
                    {char.name[0]}
                  </Text>
                </View>
              ))}
            </View>
          ) : selectedChar ? (
            <CharacterAvatar character={selectedChar} size={34} />
          ) : null}
          <Text style={[styles.headerTitle, { color: headerColor }]}>
            {headerTitle}
          </Text>
        </View>

        <View style={styles.headerRight} />
      </LinearGradient>

      <ModeSelector selected={mode} onSelect={setMode} />

      <FlatList
        data={reversedMessages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            showCharacterName={chatMode === "group"}
          />
        )}
        inverted={messages.length > 0}
        ListHeaderComponent={
          showTyping ? (
            <TypingIndicator color={accentColor} />
          ) : null
        }
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.messageList}
        ListFooterComponent={
          messages.length === 0 ? (
            <View style={styles.emptyState}>
              {selectedChar ? (
                <CharacterAvatar character={selectedChar} size={56} />
              ) : (
                <Ionicons name="people" size={40} color={COLORS.textMuted} />
              )}
              <Text style={[styles.emptyText, { color: accentColor }]}>
                {chatMode === "group"
                  ? "Start a group conversation"
                  : `Start chatting with ${selectedChar?.name}`}
              </Text>
            </View>
          ) : null
        }
      />

      <View style={{ paddingBottom: botInset }}>
        <ChatInput
          onSend={handleSend}
          disabled={isStreaming}
          accentColor={accentColor}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  selectHeader: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  selectTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 30,
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  selectSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  characterGrid: {
    padding: 16,
    gap: 10,
  },
  characterCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  cardInfo: {
    flex: 1,
    gap: 3,
  },
  cardName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  cardPersonality: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 17,
  },
  groupCard: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    marginTop: 4,
  },
  groupCardGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  groupAvatarRow: {
    flexDirection: "row",
  },
  groupAvatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -6,
  },
  groupInitial: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
  },
  groupMore: {
    backgroundColor: COLORS.borderSoft,
    borderColor: COLORS.border,
  },
  groupMoreText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    color: COLORS.textSecondary,
  },
  groupCardInfo: {
    flex: 1,
  },
  groupCardName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  groupCardSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.bgCard,
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    letterSpacing: 0.3,
  },
  headerRight: {
    width: 36,
  },
  groupHeaderAvatars: {
    flexDirection: "row",
  },
  miniAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -4,
  },
  miniInitial: {
    fontFamily: "Inter_700Bold",
    fontSize: 8,
  },
  messageList: {
    paddingVertical: 8,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 16,
  },
  emptyText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    textAlign: "center",
    paddingHorizontal: 32,
  },
});
