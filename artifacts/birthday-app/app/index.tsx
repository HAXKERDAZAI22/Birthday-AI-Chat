import { router } from "expo-router";
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { useApp } from "@/context/AppContext";
import COLORS from "@/constants/colors";

export default function RootIndex() {
  const { isUnlocked, introSeen } = useApp();

  useEffect(() => {
    if (!isUnlocked) {
      router.replace("/countdown");
    } else if (!introSeen) {
      router.replace("/intro");
    } else {
      router.replace("/chat");
    }
  }, [isUnlocked, introSeen]);

  return <View style={styles.container} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
});
