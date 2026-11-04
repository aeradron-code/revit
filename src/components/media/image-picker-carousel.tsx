import * as ImagePicker from "expo-image-picker";
import { ImagePlus } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import {
  type ImagePresentation,
  POST_IMAGE_PRESENTATION,
} from "./image-presentation";

import {
  CarouselAddButton,
  CarouselImageRemoveButton,
  SharedImageCarousel,
} from "./shared-image-carousel";
import {
  getFallbackImageIdentity,
  getImageIdentity,
} from "./image-identity";

export function ImagePickerCarousel({
  images,
  onImagesChange,
  maxImages = 3,
  maxImageBytes = 10 * 1024 * 1024,
  presentation = POST_IMAGE_PRESENTATION,
  addLabel,
  disabled = false,
  selectionLimit = maxImages,
  replaceExisting = false,
}: {
  images: ImagePicker.ImagePickerAsset[];
  onImagesChange: (images: ImagePicker.ImagePickerAsset[]) => void;
  maxImages?: number;
  maxImageBytes?: number;
  presentation?: ImagePresentation;
  addLabel?: string;
  disabled?: boolean;
  selectionLimit?: number;
  replaceExisting?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [scrollToIndexRequest, setScrollToIndexRequest] = useState<{
    index: number;
    imageCount: number;
    requestId: number;
  } | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remaining = Math.max(
    0,
    Math.min(maxImages, selectionLimit) - images.length,
  );
  const canPick = remaining > 0 || (replaceExisting && images.length > 0);
  const pickerLimit = replaceExisting
    ? Math.min(1, maxImages, selectionLimit)
    : remaining;
  const carouselImages = images.map((image, index) => ({
    id: getFallbackImageIdentity(image),
    uri: image.uri,
    accessibilityLabel: image.fileName ?? `Selected image ${index + 1}`,
  }));

  const pickImages = async () => {
    if (disabled || isPicking || !canPick) return;
    setError(null);
    setIsPicking(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: !replaceExisting && pickerLimit > 1,
        mediaTypes: ["images"],
        orderedSelection: true,
        quality: 0.85,
        selectionLimit: pickerLimit,
      });
      if (result.canceled) return;

      if (
        result.assets.some(
          (asset) => asset.fileSize && asset.fileSize > maxImageBytes,
        )
      ) {
        setError(
          `Each image must be smaller than ${Math.round(maxImageBytes / (1024 * 1024))} MB.`,
        );
        return;
      }

      const identifiedAssets = await Promise.all(
        result.assets.map(async (asset) => {
          const identity = await getImageIdentity(asset);
          return {
            asset: { ...asset, selectionIdentity: identity },
            identity,
          };
        }),
      );
      const seenIdentities = new Set(
        images.map(getFallbackImageIdentity),
      );
      const uniqueAssets = identifiedAssets
        .filter(({ identity }) => {
          if (seenIdentities.has(identity)) return false;
          seenIdentities.add(identity);
          return true;
        })
        .map(({ asset }) => asset);
      const additions = replaceExisting
        ? uniqueAssets.slice(0, pickerLimit)
        : uniqueAssets
            .slice(0, Math.max(0, maxImages - images.length));
      const nextImages = replaceExisting
        ? additions
        : [...images, ...additions];
      onImagesChange(nextImages);
      if (additions.length > 0) {
        const nextIndex = replaceExisting ? 0 : images.length;
        setActiveIndex(nextIndex);
        setScrollToIndexRequest((previousRequest) => ({
          index: nextIndex,
          imageCount: nextImages.length,
          requestId: (previousRequest?.requestId ?? 0) + 1,
        }));
      }
    } catch {
      setError("We couldn’t open your photo library. Please try again.");
    } finally {
      setIsPicking(false);
    }
  };

  const removeActive = () => {
    const nextImages = images.filter((_, index) => index !== activeIndex);
    onImagesChange(nextImages);
    setActiveIndex(Math.max(0, Math.min(activeIndex, nextImages.length - 1)));
  };

  return (
    <View className="gap-2">
      {images.length > 0 ? (
        <SharedImageCarousel
          images={carouselImages}
          activeIndex={Math.min(activeIndex, images.length - 1)}
          onIndexChange={setActiveIndex}
          scrollToIndexRequest={scrollToIndexRequest}
          presentation={presentation}
          renderActiveOverlay={() => (
            <>
              <CarouselImageRemoveButton
                disabled={disabled}
                onPress={removeActive}
              />
              {canPick ? (
                <CarouselAddButton
                  disabled={disabled}
                  isPicking={isPicking}
                  label={addLabel ?? "Add more"}
                  onPress={() => void pickImages()}
                />
              ) : null}
            </>
          )}
        />
      ) : (
        <Button
          className={`w-full flex-col gap-2 border-dashed ${presentation.emptyFrame ? "" : "h-32"}`}
          disabled={disabled || isPicking || !canPick}
          style={
            presentation.emptyFrame
              ? {
                  alignSelf: presentation.maxWidth ? "flex-start" : "stretch",
                  aspectRatio: presentation.aspectRatio,
                  maxWidth: presentation.maxWidth,
                }
              : undefined
          }
          variant="outline"
          onPress={() => void pickImages()}
        >
          <Icon as={ImagePlus} className="size-6 text-muted-foreground" />
          <Text>{isPicking ? "Opening…" : (addLabel ?? "Add images")}</Text>
        </Button>
      )}
      {images.length > 0 ? (
        <Text variant="muted" className="text-right text-xs">
          {activeIndex + 1} of {images.length} · {images.length}/{maxImages}
        </Text>
      ) : null}
      {error ? (
        <Text className="text-destructive" variant="small">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
