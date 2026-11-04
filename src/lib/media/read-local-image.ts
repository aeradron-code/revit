import { File } from "expo-file-system";

import type { AskCreationAttempt, AskImageUpload } from "@/api/posts";
import {
  API_ERROR_MESSAGES,
  normalizeApiError,
  validationError,
} from "@/api/errors";

const MIME_DETAILS = {
  "image/heic": { contentType: "image/heic", extension: "heic" },
  "image/heif": { contentType: "image/heif", extension: "heif" },
  "image/jpeg": { contentType: "image/jpeg", extension: "jpg" },
  "image/png": { contentType: "image/png", extension: "png" },
  "image/webp": { contentType: "image/webp", extension: "webp" },
} as const satisfies Record<
  string,
  Pick<AskImageUpload, "contentType" | "extension">
>;

export type LocalImage = {
  file?: { arrayBuffer: () => Promise<ArrayBuffer> };
  fileName?: string | null;
  fileSize?: number;
  mimeType?: string;
  uri: string;
};

export async function readLocalImage(
  image: LocalImage,
): Promise<AskImageUpload> {
  const mimeType = resolveMimeType(image);

  if (!mimeType) {
    throw validationError(API_ERROR_MESSAGES.INVALID_IMAGE_TYPE);
  }

  const details = MIME_DETAILS[mimeType];

  let data: ArrayBuffer;
  try {
    data = image.file
      ? await image.file.arrayBuffer()
      : await new File(image.uri).arrayBuffer();
  } catch (error) {
    throw normalizeApiError(error, API_ERROR_MESSAGES.READ_IMAGE);
  }

  return { ...details, data };
}

export async function readLocalImagesSequentially(images: LocalImage[]) {
  const uploads: AskImageUpload[] = [];
  for (const image of images) {
    uploads.push(await readLocalImage(image));
  }
  return uploads;
}

export async function prepareAskAttemptImages(
  attempt: AskCreationAttempt,
  images: LocalImage[],
) {
  if (attempt.preparedImages) return attempt.preparedImages;
  const prepared = await readLocalImagesSequentially(images);
  attempt.preparedImages = prepared;
  return prepared;
}

function resolveMimeType(image: LocalImage): keyof typeof MIME_DETAILS | "" {
  const normalizedMimeType = image.mimeType?.toLowerCase();

  if (normalizedMimeType && normalizedMimeType in MIME_DETAILS) {
    return normalizedMimeType as keyof typeof MIME_DETAILS;
  }

  const extension = (image.fileName ?? image.uri)
    .split(/[?#]/)[0]
    ?.split(".")
    .pop()
    ?.toLowerCase();

  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "heic":
      return "image/heic";
    case "heif":
      return "image/heif";
    default:
      return "";
  }
}
