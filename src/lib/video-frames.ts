/**
 * Client-side video frame extraction for cover selection.
 *
 * ORIGINAL VIDEO RULE: the source video is only *decoded* here (a hidden
 * <video> element seeks and paints frames onto a canvas). The video file
 * itself is never modified, transcoded, resized, or re-uploaded — every
 * capture produces a separate JPEG image asset.
 */

export interface CapturedFrame {
  /** Seconds into the video where the frame was captured. */
  time: number;
  /** JPEG data URL for instant preview display. */
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
}

/** Well-distributed sampling positions, avoiding the very first/last frames. */
export const SUGGESTED_FRACTIONS = [0.1, 0.25, 0.4, 0.55, 0.7, 0.85];

/** Mean absolute pixel difference (0-255) below which frames count as near-identical. */
const SIMILARITY_THRESHOLD = 6;
/** Signature variance below which a frame counts as blank/undecoded. */
const BLANK_VARIANCE = 1.5;

const SIGNATURE_SIZE = 8;

function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${what} timed out`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Load the video far enough to know its dimensions and duration. */
export function loadVideoForCapture(src: string): Promise<HTMLVideoElement> {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous"; // required to keep the canvas untainted for remote files
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  const ready = new Promise<HTMLVideoElement>((resolve, reject) => {
    video.addEventListener(
      "loadeddata",
      () => (video.videoWidth > 0 ? resolve(video) : reject(new Error("Video has no visual track"))),
      { once: true },
    );
    video.addEventListener("error", () => reject(new Error("Could not load the video")), {
      once: true,
    });
  });
  video.src = src;
  video.load();
  return withTimeout(ready, 15_000, "Loading video");
}

export function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  const target = Math.max(0, Math.min(time, Math.max(0, (video.duration || 0) - 0.05)));
  if (Math.abs(video.currentTime - target) < 0.01 && video.readyState >= 2) {
    return Promise.resolve();
  }
  const done = new Promise<void>((resolve, reject) => {
    video.addEventListener("seeked", () => resolve(), { once: true });
    video.addEventListener("error", () => reject(new Error("Seek failed")), { once: true });
  });
  video.currentTime = target;
  return withTimeout(done, 10_000, "Seeking video");
}

/** Tiny grayscale signature used for blank detection and near-duplicate skipping. */
function frameSignature(source: CanvasImageSource, width: number, height: number): number[] | null {
  const canvas = document.createElement("canvas");
  canvas.width = SIGNATURE_SIZE;
  canvas.height = SIGNATURE_SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, width, height, 0, 0, SIGNATURE_SIZE, SIGNATURE_SIZE);
  try {
    const { data } = ctx.getImageData(0, 0, SIGNATURE_SIZE, SIGNATURE_SIZE);
    const out: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      out.push((data[i] + data[i + 1] + data[i + 2]) / 3);
    }
    return out;
  } catch {
    return null; // tainted canvas (no CORS) — captures are impossible for this source
  }
}

function signatureVariance(signature: number[]): number {
  const mean = signature.reduce((a, b) => a + b, 0) / signature.length;
  return signature.reduce((a, b) => a + Math.abs(b - mean), 0) / signature.length;
}

export function signaturesSimilar(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff += Math.abs(a[i] - b[i]);
  return diff / a.length < SIMILARITY_THRESHOLD;
}

export interface FrameWithSignature extends CapturedFrame {
  signature: number[];
}

function stripSignature(frame: FrameWithSignature): CapturedFrame {
  return {
    time: frame.time,
    dataUrl: frame.dataUrl,
    blob: frame.blob,
    width: frame.width,
    height: frame.height,
  };
}

/**
 * Draw the video's CURRENT frame to a fresh canvas and encode a JPEG.
 * Returns null for blank/undecodable frames so callers can fall back.
 */
export async function captureCurrentFrame(
  video: HTMLVideoElement,
): Promise<FrameWithSignature | null> {
  if (video.readyState < 2 || video.videoWidth === 0) return null;
  const width = video.videoWidth;
  const height = video.videoHeight;
  const signature = frameSignature(video, width, height);
  if (!signature || signatureVariance(signature) < BLANK_VARIANCE) return null;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.92),
  );
  if (!blob) return null;
  return {
    time: video.currentTime,
    dataUrl: canvas.toDataURL("image/jpeg", 0.92),
    blob,
    width,
    height,
    signature,
  };
}

/**
 * Extract suggested cover frames at the given fractions of the duration,
 * skipping blanks and near-identical neighbours.
 */
export async function extractSuggestedFrames(
  src: string,
  fractions: number[] = SUGGESTED_FRACTIONS,
): Promise<CapturedFrame[]> {
  const video = await loadVideoForCapture(src);
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const kept: FrameWithSignature[] = [];
  for (const fraction of fractions) {
    try {
      await seekVideo(video, duration * fraction);
      const frame = await captureCurrentFrame(video);
      if (!frame) continue;
      if (kept.some((k) => signaturesSimilar(k.signature, frame.signature))) continue;
      kept.push(frame);
    } catch {
      // A failed seek/capture skips this position, never the whole set.
    }
  }
  video.removeAttribute("src");
  video.load();
  return kept.map(stripSignature);
}

/**
 * Default cover: a frame around 10% in; if that is blank/undecodable, walk
 * later positions and accept the first successfully decoded non-empty frame.
 */
export async function extractDefaultCover(src: string): Promise<CapturedFrame | null> {
  const video = await loadVideoForCapture(src);
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const candidates = [0.1, 0.15, 0.25, 0.4, 0.6, 0.02, 0];
  let result: FrameWithSignature | null = null;
  for (const fraction of candidates) {
    try {
      await seekVideo(video, duration * fraction);
      result = await captureCurrentFrame(video);
      if (result) break;
    } catch {
      // try the next candidate position
    }
  }
  video.removeAttribute("src");
  video.load();
  return result ? stripSignature(result) : null;
}

/** Wrap a captured frame as an uploadable JPEG File (a separate image asset). */
export function frameToFile(frame: CapturedFrame): File {
  return new File([frame.blob], `cover-${frame.time.toFixed(2)}s.jpg`, { type: "image/jpeg" });
}

export function formatVideoTime(seconds: number): string {
  const whole = Math.max(0, seconds);
  const mins = Math.floor(whole / 60);
  const secs = whole - mins * 60;
  return `${mins}:${secs.toFixed(1).padStart(4, "0")}`;
}
