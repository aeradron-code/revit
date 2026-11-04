import { View } from "react-native";

import { ImageCarouselViewer } from "@/components/media/image-carousel-viewer";
import { FORUM_COVER_PRESENTATION } from "@/components/media/image-presentation";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

export function ForumCoverDisplay({
  forumId,
  forumName,
  imageUrl,
  className,
}: {
  forumId: string;
  forumName: string;
  imageUrl?: string | null;
  className?: string;
}) {
  if (imageUrl) {
    return (
      <ImageCarouselViewer
        images={[
          {
            id: forumId,
            uri: imageUrl,
            accessibilityLabel: `${forumName} cover image`,
          },
        ]}
        presentation={FORUM_COVER_PRESENTATION}
        className={className}
        showDots={false}
        showCounter={false}
      />
    );
  }

  return (
    <View
      accessibilityLabel={`${forumName} has no cover image`}
      className={cn("relative w-full overflow-hidden bg-selected", className)}
      style={{ aspectRatio: FORUM_COVER_PRESENTATION.aspectRatio }}
    >
      <View className="absolute -left-10 -top-14 size-32 rounded-full bg-primary/15" />
      <View className="absolute left-1/4 top-5 h-24 w-24 rotate-45 rounded-lg bg-primary/10" />
      <View className="absolute bottom-4 right-1/4 size-14 rounded-full bg-primary/15" />
      <View className="absolute -right-8 -top-8 size-28 rotate-12 rounded-lg bg-primary/15" />
      <View className="absolute inset-0 items-center justify-center">
        <Text className="font-medium text-muted-foreground">
          No cover image
        </Text>
      </View>
    </View>
  );
}
