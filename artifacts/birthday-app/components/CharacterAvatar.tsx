import { Image } from "expo-image";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Character } from "@/characters";

interface CharacterAvatarProps {
  character: Character;
  size?: number;
  showName?: boolean;
  selected?: boolean;
}

const AVATAR_IMAGES: Record<string, ReturnType<typeof require>> = {
  kaneki: require("@/assets/images/kaneki.jpg"),
  gojo: require("@/assets/images/gojo.jpg"),
  yoriichi: require("@/assets/images/yoriichi.jpg"),
  bakugo: require("@/assets/images/bakugo.jpg"),
  eren: require("@/assets/images/eren.jpg"),
};

export function CharacterAvatar({
  character,
  size = 48,
  showName = false,
  selected = false,
}: CharacterAvatarProps) {
  const imageSource = AVATAR_IMAGES[character.id];

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.avatarContainer,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: selected ? character.color : `${character.color}44`,
            borderWidth: selected ? 2.5 : 1.5,
            shadowColor: character.color,
            shadowOpacity: selected ? 0.7 : 0.25,
            shadowRadius: selected ? 14 : 6,
            shadowOffset: { width: 0, height: 0 },
            elevation: selected ? 10 : 3,
          },
        ]}
      >
        {imageSource ? (
          <Image
            source={imageSource}
            style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
            contentFit="cover"
          />
        ) : (
          <View
            style={[
              styles.fallback,
              { backgroundColor: `${character.color}22`, width: size, height: size, borderRadius: size / 2 },
            ]}
          >
            <Text style={[styles.initial, { fontSize: size * 0.38, color: character.color }]}>
              {character.name[0]}
            </Text>
          </View>
        )}
      </View>
      {showName && (
        <Text style={[styles.name, { color: character.color }]} numberOfLines={1}>
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
  avatarContainer: {
    overflow: "hidden",
  },
  image: {},
  fallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  initial: {
    fontFamily: "Inter_700Bold",
  },
  name: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
});
