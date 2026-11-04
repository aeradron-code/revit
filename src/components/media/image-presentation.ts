export type ImagePresentation = {
  aspectRatio: number;
  contentFit: "contain" | "cover";
  maxWidth?: number;
  emptyFrame?: boolean;
};

export const POST_IMAGE_PRESENTATION: ImagePresentation = {
  aspectRatio: 1,
  contentFit: "cover",
};

export const FORUM_COVER_PRESENTATION: ImagePresentation = {
  aspectRatio: 1080 / 128,
  contentFit: "cover",
  emptyFrame: true,
};

export const FORUM_IMAGE_PRESENTATION: ImagePresentation = {
  aspectRatio: 1,
  contentFit: "cover",
  maxWidth: 220,
  emptyFrame: true,
};

export const ENTITY_IMAGE_PRESENTATION: ImagePresentation = {
  aspectRatio: 4 / 3,
  contentFit: "cover",
  emptyFrame: true,
};
