import { Image } from "expo-image";
import { View } from "react-native";

import { Text } from "@/components/ui/text";

export function ForumAvatar({
  name,
  imageUrl,
  size = 48,
}: {
  name: string;
  imageUrl?: string | null;
  size?: number;
}) {
  const frameStyle = {
    width: size,
    height: size,
    borderRadius: Math.max(8, Math.round(size * 0.2)),
  };

  return (
    <View
      accessibilityLabel={`${name} forum image`}
      className="shrink-0 items-center justify-center overflow-hidden bg-selected"
      style={frameStyle}
    >
      {imageUrl ? (
        <Image
          accessibilityLabel={`${name} forum image`}
          contentFit="cover"
          source={{ uri: imageUrl }}
          style={frameStyle}
        />
      ) : (
        <Text className="font-semibold text-primary">
          {name.trim().slice(0, 1).toUpperCase() || "F"}
        </Text>
      )}
    </View>
  );
}
