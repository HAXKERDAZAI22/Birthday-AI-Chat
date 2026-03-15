import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BIRTHDAY_LETTER } from "@/config";
import COLORS from "@/constants/colors";
import { useApp } from "@/context/AppContext";

type IntroStep = "image" | "video" | "letter";

export default function IntroScreen() {
  const { markIntroSeen } = useApp();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<IntroStep>("image");
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const botInset = Platform.OS === "web" ? 34 : insets.bottom;

  const transition = (next: IntroStep | "chat") => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 600,
      useNativeDriver: true,
    }).start(async () => {
      if (next === "chat") {
        await markIntroSeen();
        router.replace("/chat");
        return;
      }
      setStep(next as IntroStep);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    });
  };

  return (
    <LinearGradient
      colors={[COLORS.bgDeep, COLORS.bg, "#1A0D2E"]}
      style={[styles.container, { paddingTop: topInset, paddingBottom: botInset }]}
    >
      <Animated.View style={[styles.inner, { opacity: fadeAnim }]}>
        {step === "image" && <ImageStep onNext={() => transition("video")} />}
        {step === "video" && <VideoStep onNext={() => transition("letter")} />}
        {step === "letter" && <LetterStep onNext={() => transition("chat")} />}
      </Animated.View>
    </LinearGradient>
  );
}

function ImageStep({ onNext }: { onNext: () => void }) {
  return (
    <View style={styles.stepContainer}>
      <View style={styles.imageSection}>
        <View style={styles.imageShadow}>
          <Image
            source={require("@/assets/images/intro.jpg")}
            style={styles.introImage}
            contentFit="cover"
          />
          <LinearGradient
            colors={["transparent", `${COLORS.bgDeep}BB`, COLORS.bgDeep]}
            style={styles.imageOverlay}
          />
        </View>
        <View style={styles.welcomeText}>
          <Text style={styles.welcomeTitle}>A Gift Just For You</Text>
          <Text style={styles.welcomeSub}>
            Something beautiful has been waiting for this moment
          </Text>
        </View>
      </View>

      <NextButton label="Next" onPress={onNext} />
    </View>
  );
}

function VideoStep({ onNext }: { onNext: () => void }) {
  const player = useVideoPlayer(require("@/assets/videos/intro.mp4"), (p) => {
    p.loop = true;
    p.muted = false;
    p.play();
  });

  return (
    <View style={styles.stepContainer}>
      <View style={styles.videoSection}>
        <View style={styles.videoWrapper}>
          <VideoView
            player={player}
            style={styles.video}
            contentFit="cover"
            nativeControls={false}
            allowsFullscreen={false}
            allowsPictureInPicture={false}
          />
          <LinearGradient
            colors={["transparent", `${COLORS.bgDeep}77`, COLORS.bgDeep]}
            style={styles.videoOverlay}
          />
        </View>
      </View>

      <NextButton label="التالي" onPress={onNext} />
    </View>
  );
}

function LetterStep({ onNext }: { onNext: () => void }) {
  return (
    <View style={styles.stepContainer}>
      <View style={styles.letterHeader}>
        <View style={styles.envelopeIcon}>
          <Ionicons name="mail-open" size={28} color={COLORS.accentGold} />
        </View>
        <Text style={styles.letterTitle}>رسالة إليكِ</Text>
      </View>

      <ScrollView
        style={styles.letterScroll}
        contentContainerStyle={styles.letterContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.letterCard}>
          <View style={styles.letterTopDecor} />
          <Text style={styles.letterText}>{BIRTHDAY_LETTER}</Text>
          <View style={styles.letterBottomDecor}>
            <Ionicons name="heart" size={20} color={`${COLORS.accent}66`} />
          </View>
        </View>
      </ScrollView>

      <NextButton label="ابدأي المغامرة" onPress={onNext} />
    </View>
  );
}

function NextButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.nextBtn,
        { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
      ]}
    >
      <LinearGradient
        colors={[COLORS.accent, COLORS.accentSoft]}
        style={styles.btnGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Text style={styles.btnText}>{label}</Text>
        <Ionicons name="arrow-forward" size={18} color={COLORS.bg} />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1 },
  stepContainer: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 24,
    justifyContent: "space-between",
    paddingVertical: 20,
  },
  imageSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
  },
  imageShadow: {
    width: 280,
    height: 280,
    borderRadius: 28,
    overflow: "hidden",
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
  },
  introImage: {
    width: "100%",
    height: "100%",
  },
  imageOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  welcomeText: {
    alignItems: "center",
    gap: 10,
  },
  welcomeTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: COLORS.textPrimary,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  welcomeSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  videoSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  videoWrapper: {
    width: "100%",
    aspectRatio: 9 / 16,
    maxHeight: 480,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 16,
  },
  video: {
    flex: 1,
  },
  videoOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  letterHeader: {
    alignItems: "center",
    gap: 12,
    paddingTop: 8,
  },
  envelopeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${COLORS.accentGold}18`,
    borderWidth: 1,
    borderColor: `${COLORS.accentGold}44`,
    alignItems: "center",
    justifyContent: "center",
  },
  letterTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: COLORS.textPrimary,
  },
  letterScroll: { flex: 1 },
  letterContent: { paddingBottom: 12 },
  letterCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    padding: 24,
    gap: 16,
  },
  letterTopDecor: {
    height: 2,
    backgroundColor: `${COLORS.accentGold}33`,
    borderRadius: 1,
    marginBottom: 4,
  },
  letterText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 28,
    textAlign: "right",
    writingDirection: "rtl",
  },
  letterBottomDecor: {
    alignItems: "center",
    paddingTop: 8,
  },
  nextBtn: {
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  btnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 17,
    paddingHorizontal: 32,
  },
  btnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: COLORS.bg,
    letterSpacing: 0.3,
  },
});
