import { Image } from "expo-image";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  useWindowDimensions,
  View,
} from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import {
  type ImagePresentation,
  POST_IMAGE_PRESENTATION,
} from "./image-presentation";

export type CarouselImage = {
  id: string;
  uri: string;
  accessibilityLabel: string;
};

export function SharedImageCarousel({
  images,
  activeIndex,
  onIndexChange,
  presentation = POST_IMAGE_PRESENTATION,
  className,
  showDots = true,
  showCounter = true,
  scrollToIndexRequest,
  renderActiveOverlay,
  onImagePress,
}: {
  images: CarouselImage[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  presentation?: ImagePresentation;
  className?: string;
  showDots?: boolean;
  showCounter?: boolean;
  scrollToIndexRequest?: {
    index: number;
    imageCount: number;
    requestId: number;
  } | null;
  renderActiveOverlay?: () => React.ReactNode;
  onImagePress?: (image: CarouselImage, index: number) => void;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(windowWidth);
  const scrollViewRef = useRef<ScrollViewInstance>(null);
  const targetIndexRef = useRef(activeIndex);
  const onIndexChangeRef = useRef(onIndexChange);
  const pageHeight = containerWidth / presentation.aspectRatio;

  targetIndexRef.current = activeIndex;
  onIndexChangeRef.current = onIndexChange;

  const scrollToPage = (index: number, animated: boolean) => {
    const boundedIndex = Math.max(0, Math.min(index, images.length - 1));
    targetIndexRef.current = boundedIndex;
    onIndexChange(boundedIndex);
    scrollViewRef.current?.scrollTo({
      x: boundedIndex * containerWidth,
      animated,
    });
  };

  useEffect(() => {
    if (
      !scrollToIndexRequest ||
      containerWidth <= 0 ||
      images.length < scrollToIndexRequest.imageCount
    ) {
      return;
    }
    const boundedIndex = Math.max(
      0,
      Math.min(scrollToIndexRequest.index, images.length - 1),
    );
    targetIndexRef.current = boundedIndex;
    onIndexChange(boundedIndex);
    scrollViewRef.current?.scrollTo({
      x: boundedIndex * containerWidth,
      animated: true,
    });
  }, [containerWidth, images.length, onIndexChange, scrollToIndexRequest]);

  useEffect(() => {
    if (containerWidth <= 0) return;
    const boundedIndex = Math.max(
      0,
      Math.min(targetIndexRef.current, images.length - 1),
    );
    targetIndexRef.current = boundedIndex;
    if (boundedIndex !== targetIndexRef.current)
      onIndexChangeRef.current(boundedIndex);
    scrollViewRef.current?.scrollTo({
      x: boundedIndex * containerWidth,
      animated: false,
    });
  }, [containerWidth, images.length]);

  if (!images.length) return null;

  return (
    <View
      className={cn("relative w-full overflow-hidden bg-muted", className)}
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
      style={{
        alignSelf: presentation.maxWidth ? "flex-start" : "stretch",
        height: pageHeight,
        maxWidth: presentation.maxWidth,
      }}
    >
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(event) => {
          if (containerWidth <= 0) return;
          const offset = Math.max(0, event.nativeEvent.contentOffset.x);
          const nextIndex = Math.round(offset / containerWidth);
          const boundedIndex = Math.max(
            0,
            Math.min(nextIndex, images.length - 1),
          );
          if (boundedIndex !== activeIndex) onIndexChange(boundedIndex);
        }}
        onMomentumScrollEnd={(event) => {
          const offset = Math.max(0, event.nativeEvent.contentOffset.x);
          if (containerWidth <= 0) return;
          const settledIndex = Math.max(
            0,
            Math.min(Math.round(offset / containerWidth), images.length - 1),
          );
          if (settledIndex !== activeIndex) onIndexChange(settledIndex);
        }}
      >
        {images.map((image, index) => {
          const imageContent = (
            <Image
              key={image.id}
              accessibilityLabel={image.accessibilityLabel}
              source={{ uri: image.uri }}
              contentFit={presentation.contentFit}
              style={{ width: "100%", height: "100%" }}
              transition={150}
            />
          );
          const pageStyle = { width: containerWidth, height: pageHeight };

          return onImagePress ? (
            <Pressable
              key={image.id}
              accessibilityRole="button"
              accessibilityLabel={image.accessibilityLabel}
              onPress={() => onImagePress(image, index)}
              style={pageStyle}
            >
              {imageContent}
            </Pressable>
          ) : (
            <View key={image.id} style={pageStyle}>
              {imageContent}
            </View>
          );
        })}
      </ScrollView>

      {Platform.OS === "web" && images.length > 1 ? (
        <>
          {activeIndex > 0 ? (
            <Button
              accessibilityLabel="Previous image"
              className="absolute left-3 z-10 size-9 rounded-full border-0 bg-black/65 p-0"
              size="icon"
              variant="ghost"
              style={{ top: pageHeight / 2 - 18 }}
              onPress={() => scrollToPage(targetIndexRef.current - 1, true)}
            >
              <Icon as={ChevronLeft} className="size-5 text-white" />
            </Button>
          ) : null}
          {activeIndex < images.length - 1 ? (
            <Button
              accessibilityLabel="Next image"
              className="absolute right-3 z-10 size-9 rounded-full border-0 bg-black/65 p-0"
              size="icon"
              variant="ghost"
              style={{ top: pageHeight / 2 - 18 }}
              onPress={() => scrollToPage(targetIndexRef.current + 1, true)}
            >
              <Icon as={ChevronRight} className="size-5 text-white" />
            </Button>
          ) : null}
        </>
      ) : null}

      {showCounter && images.length > 1 ? (
        <View className="absolute right-3 top-3 rounded-full bg-black/65 px-2.5 py-1">
          <Text className="text-xs font-medium text-white">
            {activeIndex + 1}/{images.length}
          </Text>
        </View>
      ) : null}

      {showDots && images.length > 1 ? (
        <View className="absolute bottom-3 left-0 right-0 flex-row items-center justify-center gap-1.5">
          {images.map((image, index) => (
            <View
              key={image.id}
              className={`size-1.5 rounded-full ${index === activeIndex ? "bg-white" : "bg-white/55"}`}
            />
          ))}
        </View>
      ) : null}

      {renderActiveOverlay?.()}
    </View>
  );
}

export function CarouselImageRemoveButton({
  disabled,
  onPress,
}: {
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      accessibilityLabel="Remove image"
      className="absolute left-3 top-3 size-9 rounded-full border-0 bg-black/65 p-0"
      disabled={disabled}
      size="icon"
      variant="ghost"
      onPress={onPress}
    >
      <Text className="text-lg leading-none text-white">×</Text>
    </Button>
  );
}

export function CarouselAddButton({
  disabled,
  isPicking,
  label,
  onPress,
}: {
  disabled?: boolean;
  isPicking: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Button
      className="absolute bottom-3 right-3 rounded-full border-0 bg-black/65 px-3 py-2"
      disabled={disabled}
      size="sm"
      variant="ghost"
      onPress={onPress}
    >
      {isPicking ? <ActivityIndicator className="size-4" /> : null}
      <Text className="text-xs font-semibold text-white">
        {isPicking ? "Opening…" : label}
      </Text>
    </Button>
  );
}
