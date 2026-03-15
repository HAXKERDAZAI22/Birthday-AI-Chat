import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
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
          <Text style={styles.welcomeTitle}>هدية خاصة لكِ</Text>
          <Text style={styles.welcomeSub}>
            شيء جميل كان ينتظر هذه اللحظة
          </Text>
        </View>
      </View>
      <NextButton label="التالي" onPress={onNext} />
    </View>
  );
}

function VideoStep({ onNext }: { onNext: () => void }) {
  const player = useVideoPlayer(require("@/assets/videos/intro.mp4"), (p) => {
    p.loop = true;
    p.muted = false;
    p.play();
  });
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    const sub = player.addListener("statusChange" as any, (status: any) => {
      if (status?.error) setVideoError(true);
    });
    return () => sub?.remove?.();
  }, [player]);

  return (
    <View style={styles.stepContainer}>
      <View style={styles.videoSection}>
        <View style={styles.videoWrapper}>
          {!videoError ? (
            Platform.OS === "web" ? (
              <WebVideo onError={() => setVideoError(true)} />
            ) : (
              <VideoView
                player={player}
                style={styles.video}
                contentFit="cover"
                nativeControls={false}
                allowsFullscreen={false}
                allowsPictureInPicture={false}
              />
            )
          ) : (
            <AnimatedHeartPlaceholder />
          )}
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

function WebVideo({ onError }: { onError: () => void }) {
  const videoRef = useRef<any>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (el) {
      el.play().catch(() => onError());
    }
  }, []);

  if (Platform.OS !== "web") return null;

  return (
    // @ts-ignore
    <video
      ref={videoRef}
      src={"/assets/videos/intro.mp4"}
      autoPlay
      loop
      playsInline
      muted={false}
      onError={onError}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
      }}
    />
  );
}

function AnimatedHeartPlaceholder() {
  const scale1 = useRef(new Animated.Value(1)).current;
  const scale2 = useRef(new Animated.Value(0.7)).current;
  const scale3 = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const pulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1.3,
            duration: 1000,
            delay,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(anim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
        ])
      );
    pulse(scale1, 0).start();
    pulse(scale2, 300).start();
    pulse(scale3, 600).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.placeholderContainer}>
      <Animated.View style={[styles.heartRing3, { transform: [{ scale: scale3 }] }]} />
      <Animated.View style={[styles.heartRing2, { transform: [{ scale: scale2 }] }]} />
      <Animated.View style={[styles.heartRing1, { transform: [{ scale: scale1 }] }]}>
        <Animated.View style={{ opacity }}>
          <Ionicons name="heart" size={64} color={COLORS.accent} />
        </Animated.View>
      </Animated.View>
      <Text style={styles.placeholderText}>لكِ بكل المحبة 🌸</Text>
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

      <NextButton label="ابدئي المغامرة" onPress={onNext} />
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
    backgroundColor: COLORS.bgCard,
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
  placeholderContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heartRing1: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: `${COLORS.accent}12`,
    borderWidth: 1.5,
    borderColor: `${COLORS.accent}55`,
    alignItems: "center",
    justifyContent: "center",
  },
  heartRing2: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 1,
    borderColor: `${COLORS.accent}30`,
  },
  heartRing3: {
    position: "absolute",
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 1,
    borderColor: `${COLORS.accent}18`,
  },
  placeholderText: {
    fontFamily: "Inter_500Medium",
    fontSize: 18,
    color: COLORS.textSecondary,
    marginTop: 110,
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
