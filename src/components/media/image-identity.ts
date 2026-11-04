import type * as ImagePicker from "expo-image-picker";

type ImageAssetWithIdentity = ImagePicker.ImagePickerAsset & {
  selectionIdentity?: string;
};

export async function getImageIdentity(
  image: ImagePicker.ImagePickerAsset,
): Promise<string> {
  const existingIdentity = (image as ImageAssetWithIdentity).selectionIdentity;
  if (existingIdentity) return existingIdentity;
  if (image.assetId) return `asset:${image.assetId}`;

  if (image.file) {
    try {
      const content = await image.file.arrayBuffer();
      const digest = await globalThis.crypto.subtle.digest("SHA-256", content);
      const hash = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      return `sha256:${hash}`;
    } catch {
      // Fall back to stable file metadata when Web Crypto or File reads fail.
    }
    return getFallbackImageIdentity(image);
  }

  return `uri:${image.uri}`;
}

export function getFallbackImageIdentity(
  image: ImagePicker.ImagePickerAsset,
) {
  const existingIdentity = (image as ImageAssetWithIdentity).selectionIdentity;
  if (existingIdentity) return existingIdentity;
  if (image.assetId) return `asset:${image.assetId}`;
  if (image.file) {
    return [
      "file",
      image.file.name,
      image.file.size,
      image.file.lastModified,
      image.file.type,
    ].join(":");
  }
  return `uri:${image.uri}`;
}
