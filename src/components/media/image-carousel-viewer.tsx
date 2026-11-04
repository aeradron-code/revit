import { useState } from "react";
import {
  type ImagePresentation,
  POST_IMAGE_PRESENTATION,
} from "./image-presentation";
import {
  type CarouselImage,
  SharedImageCarousel,
} from "./shared-image-carousel";

export type DisplayImage = {
  id: string;
  uri: string;
  accessibilityLabel?: string | null;
};

export function ImageCarouselViewer({
  images,
  presentation = POST_IMAGE_PRESENTATION,
  className,
  showDots = true,
  showCounter = true,
  onImagePress,
}: {
  images: DisplayImage[];
  presentation?: ImagePresentation;
  className?: string;
  showDots?: boolean;
  showCounter?: boolean;
  onImagePress?: (image: DisplayImage, index: number) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const carouselImages: CarouselImage[] = images.map((image, index) => ({
    ...image,
    accessibilityLabel:
      image.accessibilityLabel ?? `Image ${index + 1} of ${images.length}`,
  }));

  if (!images.length) return null;

  return (
    <SharedImageCarousel
      images={carouselImages}
      activeIndex={Math.min(activeIndex, images.length - 1)}
      onIndexChange={setActiveIndex}
      presentation={presentation}
      className={className}
      showDots={showDots}
      showCounter={showCounter}
      onImagePress={(_image, index) => {
        const selected = images[index];
        if (selected) onImagePress?.(selected, index);
      }}
    />
  );
}
