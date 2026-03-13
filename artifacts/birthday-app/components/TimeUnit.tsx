import React from "react";
import { StyleSheet, Text, View } from "react-native";
import COLORS from "@/constants/colors";

interface TimeUnitProps {
  value: number;
  label: string;
}

export function TimeUnit({ value, label }: TimeUnitProps) {
  const display = String(value).padStart(2, "0");
  return (
    <View style={styles.container}>
      <View style={styles.box}>
        <Text style={styles.value}>{display}</Text>
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 8,
  },
  box: {
    width: 72,
    height: 72,
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  value: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: COLORS.accent,
    letterSpacing: 1,
  },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
});
