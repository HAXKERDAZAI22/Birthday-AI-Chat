import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Character } from "@/characters";

interface CharacterAvatarProps {
  character: Character;
  size?: number;
  showName?: boolean;
  selected?: boolean;
}

const INITIALS: Record<string, string> = {
  kaneki: "K",
  gojo: "G",
  yoriichi: "Y",
  bakugo: "B",
  eren: "E",
};

export function CharacterAvatar({
  character,
  size = 48,
  showName = false,
  selected = false,
}: CharacterAvatarProps) {
  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: `${character.color}22`,
            borderColor: selected ? character.color : `${character.color}44`,
            borderWidth: selected ? 2.5 : 1.5,
            shadowColor: character.color,
            shadowOpacity: selected ? 0.6 : 0.2,
            shadowRadius: selected ? 12 : 6,
            shadowOffset: { width: 0, height: 0 },
            elevation: selected ? 8 : 3,
          },
        ]}
      >
        <Text
          style={[
            styles.initial,
            {
              fontSize: size * 0.38,
              color: character.color,
              fontFamily: "Inter_700Bold",
            },
          ]}
        >
          {INITIALS[character.id]}
        </Text>
      </View>
      {showName && (
        <Text
          style={[styles.name, { color: character.color }]}
          numberOfLines={1}
        >
          {character.name}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    gap: 6,
  },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
  },
  initial: {
    fontWeight: "700",
  },
  name: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
});
