import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import COLORS from "@/constants/colors";

function Dot({ delay, color }: { delay: number; color: string }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 400 }), -1, true)
    );
  }, [delay, opacity]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[styles.dot, { backgroundColor: color }, animStyle]}
    />
  );
}

interface TypingIndicatorProps {
  color?: string;
}

export function TypingIndicator({ color = COLORS.accent }: TypingIndicatorProps) {
  return (
    <View style={styles.container}>
      <View style={[styles.bubble, { borderColor: `${color}33` }]}>
        <Dot delay={0} color={color} />
        <Dot delay={150} color={color} />
        <Dot delay={300} color={color} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    alignItems: "flex-start",
  },
  bubble: {
    flexDirection: "row",
    gap: 5,
    backgroundColor: COLORS.bgCard,
    borderRadius: 18,
    borderTopLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});
