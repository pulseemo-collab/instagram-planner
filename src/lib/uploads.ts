export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

export interface FileValidationResult {
  ok: boolean;
  error?: string;
  mediaType: "image" | "video";
}

export function validateUpload(file: File, allowVideo: boolean): FileValidationResult {
  const isImage = IMAGE_TYPES.includes(file.type);
  const isVideo = VIDEO_TYPES.includes(file.type);

  if (!isImage && !isVideo) {
    return {
      ok: false,
      mediaType: "image",
      error: `${file.name}: unsupported type. Use JPG, PNG, WEBP${allowVideo ? ", or MP4/WebM video" : ""}.`,
    };
  }
  if (isVideo && !allowVideo) {
    return { ok: false, mediaType: "video", error: `${file.name}: videos are only allowed for reels.` };
  }
  const limit = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > limit) {
    return {
      ok: false,
      mediaType: isVideo ? "video" : "image",
      error: `${file.name}: larger than ${Math.round(limit / 1024 / 1024)} MB.`,
    };
  }
  return { ok: true, mediaType: isVideo ? "video" : "image" };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
