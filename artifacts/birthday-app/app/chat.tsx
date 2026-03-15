import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CharacterAvatar } from "@/components/CharacterAvatar";
import { ChatInput } from "@/components/ChatInput";
import { CreateCharacterModal } from "@/components/CreateCharacterModal";
import { LengthSelector } from "@/components/LengthSelector";
import { MessageActionSheet } from "@/components/MessageActionSheet";
import { MessageBubble } from "@/components/MessageBubble";
import { ModeSelector } from "@/components/ModeSelector";
import { TypingIndicator } from "@/components/TypingIndicator";
import { CHARACTER_LIST, CHARACTERS, Character } from "@/characters";
import COLORS from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import {
  ConversationMode,
  ResponseLength,
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
import {
  CustomCharacter,
  deleteCustomCharacter,
  getCustomCharacters,
} from "@/services/customCharacterService";

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
  const [responseLength, setResponseLength] = useState<ResponseLength>("medium");
  const initializedRef = useRef(false);

  const [actionSheetMsg, setActionSheetMsg] = useState<Message | null>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);

  const [createCharVisible, setCreateCharVisible] = useState(false);
  const [customChars, setCustomChars] = useState<CustomCharacter[]>([]);

  const [editPrefill, setEditPrefill] = useState<string | undefined>(undefined);
  const [editMode, setEditMode] = useState(false);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const botInset = Platform.OS === "web" ? 34 : insets.bottom;

  const accentColor =
    chatMode === "group"
      ? COLORS.accent
      : selectedChar?.color ?? COLORS.accent;

  const customCharMap: Record<string, CustomCharacter> = {};
  for (const c of customChars) {
    customCharMap[c.id] = c;
  }

  useEffect(() => {
    loadCustomChars();
  }, []);

  const loadCustomChars = async () => {
    const chars = await getCustomCharacters();
    setCustomChars(chars);
  };

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
    setEditMode(false);
    setEditPrefill(undefined);
  };

  const handleLongPressMessage = (msg: Message) => {
    if (isStreaming) return;
    setActionSheetMsg(msg);
    setActionSheetVisible(true);
  };

  const handleDeleteMessage = (msg: Message) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === msg.id);
      if (idx < 0) return prev;
      if (msg.role === "user") {
        const next = prev[idx + 1];
        if (next && next.role === "assistant") {
          return [...prev.slice(0, idx), ...prev.slice(idx + 2)];
        }
      }
      return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
    });
  };

  const handleRewindMessage = (msg: Message) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === msg.id);
      if (idx < 0) return prev;
      return prev.slice(0, idx + 1);
    });
  };

  const handleEditMessage = (msg: Message) => {
    if (msg.role !== "user") return;
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === msg.id);
      if (idx < 0) return prev;
      return prev.slice(0, idx);
    });
    setEditPrefill(msg.content);
    setEditMode(true);
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditPrefill(undefined);
  };

  const handleDeleteCustomChar = (char: CustomCharacter) => {
    Alert.alert(
      "حذف الشخصية",
      `هل تريدين حذف "${char.name}"؟`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف",
          style: "destructive",
          onPress: async () => {
            await deleteCustomCharacter(char.id);
            await loadCustomChars();
          },
        },
      ]
    );
  };

  const handleSend = useCallback(
    async (text: string) => {
      if (isStreaming) return;

      setEditMode(false);
      setEditPrefill(undefined);

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
            responseLength,
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
          responseLength,
          memory: memoryContext,
          systemPrompt: (selectedChar as any).isCustom ? selectedChar.systemPrompt : undefined,
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
    [isStreaming, messages, chatMode, selectedChar, mode, responseLength]
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
            <Text style={styles.selectTitle}>الشخصيات</Text>
            <Text style={styles.selectSub}>اختاري مع من تتحدثين</Text>
          </View>
          <Pressable
            onPress={() => setCreateCharVisible(true)}
            hitSlop={10}
            style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <LinearGradient
              colors={[`${COLORS.accent}22`, `${COLORS.accent}11`]}
              style={styles.addBtnGradient}
            >
              <Ionicons name="person-add" size={16} color={COLORS.accent} />
              <Text style={styles.addBtnText}>إنشاء</Text>
            </LinearGradient>
          </Pressable>
          <Pressable
            onPress={() =>
              Alert.alert("إعادة المقدمة", "هل تريدين مشاهدة المقدمة مرة أخرى؟", [
                { text: "إلغاء", style: "cancel" },
                {
                  text: "نعم",
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
            <Ionicons name="refresh-circle-outline" size={26} color={`${COLORS.accent}66`} />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.characterGrid}
        >
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

          {customChars.length > 0 && (
            <>
              <View style={styles.sectionDivider}>
                <View style={styles.sectionLine} />
                <Text style={styles.sectionLabel}>شخصياتك</Text>
                <View style={styles.sectionLine} />
              </View>
              {customChars.map((char) => (
                <Pressable
                  key={char.id}
                  onPress={() => handleSelectChar(char)}
                  onLongPress={() => handleDeleteCustomChar(char)}
                  delayLongPress={600}
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
                    <View style={styles.cardNameRow}>
                      <Text style={[styles.cardName, { color: char.color }]}>
                        {char.name}
                      </Text>
                      <View style={[styles.customBadge, { backgroundColor: `${char.color}22`, borderColor: `${char.color}44` }]}>
                        <Text style={[styles.customBadgeText, { color: char.color }]}>مخصص</Text>
                      </View>
                    </View>
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
            </>
          )}

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
                <Text style={styles.groupCardName}>دردشة جماعية</Text>
                <Text style={styles.groupCardSub}>جميع الشخصيات معاً</Text>
              </View>
              <Ionicons name="people" size={20} color={COLORS.accent} />
            </LinearGradient>
          </Pressable>

          <Pressable
            onPress={() => setCreateCharVisible(true)}
            style={({ pressed }) => [
              styles.createCharCard,
              {
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
          >
            <LinearGradient
              colors={[`${COLORS.accent}18`, `${COLORS.accent}08`]}
              style={styles.createCharGradient}
            >
              <View style={styles.createCharIcon}>
                <Ionicons name="add" size={24} color={COLORS.accent} />
              </View>
              <View style={styles.createCharInfo}>
                <Text style={styles.createCharTitle}>إنشاء شخصية</Text>
                <Text style={styles.createCharSub}>أضيفي شخصيتك المفضلة</Text>
              </View>
              <Ionicons name="sparkles" size={18} color={`${COLORS.accent}88`} />
            </LinearGradient>
          </Pressable>
        </ScrollView>

        <CreateCharacterModal
          visible={createCharVisible}
          onClose={() => setCreateCharVisible(false)}
          onCreated={async (char) => {
            setCreateCharVisible(false);
            await loadCustomChars();
          }}
        />
      </LinearGradient>
    );
  }

  const headerTitle =
    chatMode === "group"
      ? "دردشة جماعية"
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

        <View style={styles.headerRight}>
          {messages.length > 0 && !isStreaming && (
            <Pressable
              onPress={() =>
                Alert.alert("مسح المحادثة", "هل تريدين مسح كل الرسائل؟", [
                  { text: "إلغاء", style: "cancel" },
                  {
                    text: "مسح",
                    style: "destructive",
                    onPress: () => setMessages([]),
                  },
                ])
              }
              hitSlop={10}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Ionicons name="trash-outline" size={20} color={`${COLORS.textMuted}`} />
            </Pressable>
          )}
        </View>
      </LinearGradient>

      <ModeSelector selected={mode} onSelect={setMode} />
      <LengthSelector
        selected={responseLength}
        onSelect={setResponseLength}
        accentColor={accentColor}
      />

      <FlatList
        data={reversedMessages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            showCharacterName={chatMode === "group"}
            isSelected={actionSheetMsg?.id === item.id && actionSheetVisible}
            onLongPress={handleLongPressMessage}
            customCharacters={customCharMap}
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
                  ? "ابدئي المحادثة الجماعية"
                  : `ابدئي التحدث مع ${selectedChar?.name}`}
              </Text>
              <Text style={styles.emptyHint}>
                اضغطي مطولاً على أي رسالة لتعديلها أو حذفها
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
          prefillText={editPrefill}
          editMode={editMode}
          onCancelEdit={handleCancelEdit}
        />
      </View>

      <MessageActionSheet
        message={actionSheetMsg}
        visible={actionSheetVisible}
        onClose={() => {
          setActionSheetVisible(false);
          setActionSheetMsg(null);
        }}
        onDelete={handleDeleteMessage}
        onEdit={handleEditMessage}
        onRewind={handleRewindMessage}
        accentColor={accentColor}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  selectHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  selectTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  selectSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  addBtn: {
    borderRadius: 12,
    overflow: "hidden",
  },
  addBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${COLORS.accent}33`,
  },
  addBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: COLORS.accent,
  },
  characterGrid: {
    padding: 16,
    gap: 10,
    paddingBottom: 32,
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
  cardNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  customBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
  },
  customBadgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    letterSpacing: 0.3,
  },
  cardPersonality: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 17,
  },
  sectionDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 4,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  sectionLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: COLORS.textMuted,
    letterSpacing: 0.5,
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
  createCharCard: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: `${COLORS.accent}33`,
    borderStyle: "dashed",
    marginTop: 4,
  },
  createCharGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  createCharIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: `${COLORS.accent}18`,
    borderWidth: 1,
    borderColor: `${COLORS.accent}33`,
    alignItems: "center",
    justifyContent: "center",
  },
  createCharInfo: {
    flex: 1,
  },
  createCharTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: COLORS.accent,
  },
  createCharSub: {
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
    alignItems: "center",
    justifyContent: "center",
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
    gap: 14,
  },
  emptyText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  emptyHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: "center",
    paddingHorizontal: 40,
  },
});
