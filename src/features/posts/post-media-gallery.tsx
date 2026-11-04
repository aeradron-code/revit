import type { PostWithDetails } from "@/api/posts";
import { ImageCarouselViewer } from "@/components/media/image-carousel-viewer";
import { POST_IMAGE_PRESENTATION } from "@/components/media/image-presentation";

export function PostMediaGallery({
  media,
}: {
  media: PostWithDetails["media"];
}) {
  return (
    <ImageCarouselViewer
      images={media.map((item, index) => ({
        id: item.id,
        uri: item.signedUrl,
        accessibilityLabel: item.alt_text || `Post image ${index + 1}`,
      }))}
      presentation={POST_IMAGE_PRESENTATION}
      showDots
      showCounter
    />
  );
}
