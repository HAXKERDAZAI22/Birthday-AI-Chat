import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TimeUnit } from "@/components/TimeUnit";
import { MOTIVATIONAL_MESSAGES } from "@/config";
import COLORS from "@/constants/colors";
import { useApp } from "@/context/AppContext";

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  star: "star",
  time: "time",
  gift: "gift",
  heart: "heart",
  sparkles: "sparkles",
  ribbon: "ribbon",
};

export default function CountdownScreen() {
  const { timeLeft } = useApp();
  const insets = useSafeAreaInsets();
  const [msgIndex, setMsgIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const botInset = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        setMsgIndex((prev) => (prev + 1) % MOTIVATIONAL_MESSAGES.length);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [fadeAnim]);

  const currentMsg = MOTIVATIONAL_MESSAGES[msgIndex];

  return (
    <LinearGradient
      colors={[COLORS.bgDeep, COLORS.bg, "#16103A"]}
      style={[styles.container, { paddingTop: topInset, paddingBottom: botInset }]}
    >
      <View style={styles.inner}>
        <View style={styles.headerSection}>
          <View style={styles.iconRing}>
            <Ionicons name="gift" size={32} color={COLORS.accent} />
          </View>
          <Text style={styles.title}>Something Special</Text>
          <Text style={styles.subtitle}>is coming for you</Text>
        </View>

        <View style={styles.countdownSection}>
          <Text style={styles.countdownLabel}>UNLOCKS IN</Text>
          <View style={styles.timerRow}>
            <TimeUnit value={timeLeft.days} label="Days" />
            <Text style={styles.separator}>:</Text>
            <TimeUnit value={timeLeft.hours} label="Hours" />
            <Text style={styles.separator}>:</Text>
            <TimeUnit value={timeLeft.minutes} label="Min" />
            <Text style={styles.separator}>:</Text>
            <TimeUnit value={timeLeft.seconds} label="Sec" />
          </View>
          <Text style={styles.unlockDate}>May 23, 2026</Text>
        </View>

        <Animated.View style={[styles.messageCard, { opacity: fadeAnim }]}>
          <Ionicons
            name={ICON_MAP[currentMsg.icon] ?? "star"}
            size={20}
            color={COLORS.accentGold}
          />
          <Text style={styles.messageText}>{currentMsg.text}</Text>
        </Animated.View>

        <View style={styles.footer}>
          <View style={styles.dotRow}>
            {MOTIVATIONAL_MESSAGES.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      i === msgIndex ? COLORS.accent : COLORS.borderSoft,
                    width: i === msgIndex ? 16 : 6,
                  },
                ]}
              />
            ))}
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 24,
  },
  headerSection: {
    alignItems: "center",
    gap: 10,
  },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${COLORS.accent}18`,
    borderWidth: 1.5,
    borderColor: `${COLORS.accent}44`,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 32,
    color: COLORS.textPrimary,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  countdownSection: {
    alignItems: "center",
    gap: 16,
  },
  countdownLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 3,
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  separator: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: COLORS.textMuted,
    marginBottom: 20,
  },
  unlockDate: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: COLORS.accentGold,
    letterSpacing: 1,
  },
  messageCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    paddingHorizontal: 20,
    paddingVertical: 16,
    maxWidth: 340,
  },
  messageText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  footer: {
    alignItems: "center",
  },
  dotRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
});
