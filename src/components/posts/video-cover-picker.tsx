"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ImageOff, Pause, Play, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadDropzone } from "@/components/uploads/upload-dropzone";
import { cn } from "@/lib/cn";
import { getRepository } from "@/lib/repositories";
import {
  captureCurrentFrame,
  extractDefaultCover,
  extractSuggestedFrames,
  formatVideoTime,
  frameToFile,
  type CapturedFrame,
} from "@/lib/video-frames";
import type { CoverSource } from "@/types/domain";

export interface CoverSelection {
  /** Persistent repository reference for the cover image. */
  url: string;
  /** Immediately displayable preview (data/object URL). */
  previewUrl: string;
  source: CoverSource;
  /** Seconds into the video; null for uploaded images. */
  timestamp: number | null;
}

export interface VideoCoverPickerProps {
  /** Decodable/playable source of the primary video (data:/blob:/https:). */
  videoUrl: string;
  /** Displayable URL of the current cover, if any. */
  coverDisplayUrl: string | null;
  coverSource: CoverSource | null;
  coverTimestamp: number | null;
  onCoverSelected: (selection: CoverSelection) => void;
}

type CoverTab = "suggested" | "frame" | "upload";

const TABS: Array<{ id: CoverTab; label: string }> = [
  { id: "suggested", label: "Suggested" },
  { id: "frame", label: "Choose frame" },
  { id: "upload", label: "Upload image" },
];

/**
 * Scheduler-facing cover picker for video posts. Frames are decoded from the
 * original video into separate JPEG assets — the video file itself is never
 * touched (see src/lib/video-frames.ts).
 */
export function VideoCoverPicker({
  videoUrl,
  coverDisplayUrl,
  coverSource,
  coverTimestamp,
  onCoverSelected,
}: VideoCoverPickerProps) {
  const [tab, setTab] = useState<CoverTab>("suggested");
  // Suggestions are keyed by source URL: a stale entry (different src) simply
  // renders as "loading", so switching videos regenerates without state resets.
  const [suggestState, setSuggestState] = useState<{
    src: string;
    frames: CapturedFrame[];
    error: string | null;
  } | null>(null);
  const suggestions = suggestState?.src === videoUrl ? suggestState.frames : null;
  const suggestionsError = suggestState?.src === videoUrl ? suggestState.error : null;
  const [busy, setBusy] = useState(false);
  const [frameError, setFrameError] = useState<string | null>(null);

  // Current-cover <img> load tracking, keyed by URL. A cover only counts as
  // usable once its image actually loads — a non-empty thumbnailUrl that
  // fails to load is treated as invalid and recovered from (Issue 2).
  const [imgState, setImgState] = useState<{ url: string; status: "ok" | "error" } | null>(null);
  const coverImgStatus: "none" | "loading" | "ok" | "error" = !coverDisplayUrl
    ? "none"
    : imgState?.url === coverDisplayUrl
      ? imgState.status
      : "loading";
  const [recoveryFailed, setRecoveryFailed] = useState(false);
  /** URLs we already tried to recover from — prevents regeneration loops. */
  const recoveryAttemptedRef = useRef<Set<string>>(new Set());

  // Player state (Choose frame tab).
  const playerRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // Latest values without retriggering the videoUrl effect. Synced in a
  // passive effect (declared before the extraction effect so it runs first).
  const selectRef = useRef(onCoverSelected);
  const hasCoverRef = useRef(false);
  useEffect(() => {
    selectRef.current = onCoverSelected;
    hasCoverRef.current = Boolean(coverDisplayUrl) || coverSource != null;
  });

  const persistFrame = useCallback(async (frame: CapturedFrame, source: CoverSource) => {
    setBusy(true);
    try {
      const repo = await getRepository();
      const result = await repo.uploadFile(frameToFile(frame), "post-media");
      selectRef.current({
        url: result.url,
        previewUrl: frame.dataUrl,
        source,
        timestamp: frame.time,
      });
      return true;
    } catch {
      setFrameError("Could not save the cover image — try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const loadSuggestions = useCallback((src: string) => {
    void extractSuggestedFrames(src)
      .then((frames) => {
        setSuggestState({
          src,
          frames,
          error: frames.length === 0 ? "No frames could be extracted from this video." : null,
        });
      })
      .catch(() => {
        setSuggestState({ src, frames: [], error: "Could not read the video to extract frames." });
      });
  }, []);

  // Suggested frames + automatic default cover, regenerated per video source.
  useEffect(() => {
    let cancelled = false;
    loadSuggestions(videoUrl);

    // DEFAULT COVER: never leave a video post without a usable cover. Prefer
    // ~10% in; extractDefaultCover falls back to the first decodable frame.
    if (!hasCoverRef.current) {
      void extractDefaultCover(videoUrl).then(async (frame) => {
        if (cancelled || !frame || hasCoverRef.current) return;
        setBusy(true);
        try {
          const repo = await getRepository();
          const result = await repo.uploadFile(frameToFile(frame), "post-media");
          if (!cancelled && !hasCoverRef.current) {
            selectRef.current({
              url: result.url,
              previewUrl: frame.dataUrl,
              source: "generated",
              timestamp: frame.time,
            });
          }
        } catch {
          // A default cover is best-effort; the user can still pick one.
        } finally {
          if (!cancelled) setBusy(false);
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [videoUrl, loadSuggestions]);

  /** Replace an unloadable cover with a freshly generated default frame. */
  const recoverCover = useCallback(async () => {
    try {
      const frame = await extractDefaultCover(videoUrl);
      if (!frame) {
        setRecoveryFailed(true);
        return;
      }
      const ok = await persistFrame(frame, "generated");
      if (!ok) setRecoveryFailed(true);
    } catch {
      setRecoveryFailed(true);
    }
  }, [videoUrl, persistFrame]);

  // The stored cover failed to load → recover once per failing URL. The
  // replacement is only written to the post when the user saves; nothing in
  // the database is overwritten because an image failed to load.
  useEffect(() => {
    if (coverImgStatus !== "error" || !coverDisplayUrl) return;
    if (recoveryAttemptedRef.current.has(coverDisplayUrl)) return;
    recoveryAttemptedRef.current.add(coverDisplayUrl);
    void recoverCover();
  }, [coverImgStatus, coverDisplayUrl, recoverCover]);

  const isSelectedFrame = (frame: CapturedFrame) =>
    coverSource !== "uploaded" &&
    coverTimestamp != null &&
    Math.abs(coverTimestamp - frame.time) < 0.15;

  async function captureFromPlayer() {
    setFrameError(null);
    const video = playerRef.current;
    if (!video) return;
    video.pause();
    setPlaying(false);
    // A scrub immediately before the click may still be seeking — wait so we
    // capture the frame the user actually stopped on, never a stale/blank one.
    if (video.seeking) {
      await new Promise<void>((resolve) => {
        video.addEventListener("seeked", () => resolve(), { once: true });
        setTimeout(resolve, 4000);
      });
    }
    const frame = await captureCurrentFrame(video);
    if (!frame) {
      setFrameError("The video isn't ready yet — let it load, then try again.");
      return;
    }
    await persistFrame(frame, "frame");
  }

  const recovering = coverImgStatus === "error" && !recoveryFailed;
  const statusText = recovering
    ? "Cover image unavailable — generating a replacement…"
    : recoveryFailed
      ? "Cover image unavailable."
      : coverSource === "uploaded" && coverDisplayUrl
        ? "Custom uploaded image"
        : coverSource === "frame" && coverTimestamp != null
          ? `Frame at ${formatVideoTime(coverTimestamp)}`
          : coverSource === "generated" && coverTimestamp != null
            ? `Suggested frame at ${formatVideoTime(coverTimestamp)}`
            : busy
              ? "Preparing default cover…"
              : "No cover selected yet";

  return (
    <div className="space-y-3 rounded-lg border border-line bg-panel-raised p-3">
      <span className="block text-[12.5px] font-semibold text-ink">Video cover</span>

      {/* Current cover — large, inspectable preview (Instagram grid 3:4). */}
      <div className="space-y-1.5">
        <span className="block text-[12px] font-medium text-ink-soft">Current cover</span>
        <div className="relative aspect-[3/4] w-full max-w-56 overflow-hidden rounded-lg border border-line bg-panel">
          {coverDisplayUrl && coverImgStatus !== "error" && (
            // eslint-disable-next-line @next/next/no-img-element -- resolved preview URL
            <img
              src={coverDisplayUrl}
              alt="Current video cover"
              onLoad={() => setImgState({ url: coverDisplayUrl, status: "ok" })}
              onError={() => setImgState({ url: coverDisplayUrl, status: "error" })}
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-opacity",
                coverImgStatus === "ok" ? "opacity-100" : "opacity-0",
              )}
            />
          )}
          {coverImgStatus === "loading" && (
            <div aria-hidden="true" className="absolute inset-0 animate-pulse bg-line/60" />
          )}
          {(coverImgStatus === "none" || coverImgStatus === "error") &&
            (busy || recovering ? (
              <div aria-hidden="true" className="absolute inset-0 animate-pulse bg-line/60" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3 text-center">
                <ImageOff className="size-6 text-ink-faint" aria-hidden="true" />
                <span className="text-[12px] text-ink-faint">
                  {recoveryFailed ? "Cover unavailable" : "No cover yet"}
                </span>
                {recoveryFailed && (
                  <button
                    type="button"
                    onClick={() => {
                      if (coverDisplayUrl) recoveryAttemptedRef.current.delete(coverDisplayUrl);
                      setRecoveryFailed(false);
                      void recoverCover();
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-line bg-panel px-2 py-1 text-[12px] font-medium text-ink hover:border-ink-faint"
                  >
                    <RotateCw className="size-3" aria-hidden="true" />
                    Retry
                  </button>
                )}
              </div>
            ))}
        </div>
        <p role="status" aria-live="polite" className="text-[12px] text-ink-soft">
          {statusText}
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label="Video cover source"
        className="flex w-fit max-w-full flex-wrap rounded-lg border border-line bg-panel p-0.5"
      >
        {TABS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={tab === option.id}
            onClick={() => setTab(option.id)}
            className={cn(
              "rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors",
              tab === option.id ? "bg-ink text-panel" : "text-ink-soft hover:text-ink",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {tab === "suggested" && (
        <div className="space-y-2">
          {suggestions === null && (
            <p className="text-[12px] text-ink-faint">Extracting frames from the video…</p>
          )}
          {suggestionsError && (
            <p className="flex items-center gap-2 text-[12px] text-ink-soft">
              {suggestionsError}
              <button
                type="button"
                onClick={() => {
                  setSuggestState(null);
                  loadSuggestions(videoUrl);
                }}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[12px] font-medium text-ink underline-offset-2 hover:underline"
              >
                <RotateCw className="size-3" aria-hidden="true" />
                Retry
              </button>
            </p>
          )}
          {suggestions && suggestions.length > 0 && (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Suggested frames">
              {suggestions.map((frame) => {
                const selected = isSelectedFrame(frame);
                return (
                  <li key={frame.time}>
                    <button
                      type="button"
                      disabled={busy}
                      aria-pressed={selected}
                      aria-label={`Use frame at ${formatVideoTime(frame.time)} as cover`}
                      onClick={() => void persistFrame(frame, "generated")}
                      className={cn(
                        "relative block w-full overflow-hidden rounded-md border-2 transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                        selected
                          ? "border-accent ring-2 ring-accent ring-offset-2 ring-offset-panel-raised"
                          : "border-line hover:border-ink-faint",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- transient data URL */}
                      <img src={frame.dataUrl} alt="" className="aspect-video w-full object-cover" />
                      <span className="absolute bottom-0.5 right-0.5 rounded bg-black/60 px-1 text-[10px] font-medium text-white">
                        {formatVideoTime(frame.time)}
                      </span>
                      {selected && (
                        <span className="absolute left-1 top-1 flex size-5 items-center justify-center rounded-full bg-accent text-white shadow">
                          <Check className="size-3.5" aria-hidden="true" />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {tab === "frame" && (
        <div className="space-y-2">
          <video
            ref={playerRef}
            src={videoUrl}
            crossOrigin="anonymous"
            playsInline
            muted
            preload="auto"
            className="w-full max-w-sm rounded-md border border-line bg-black"
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onEnded={() => setPlaying(false)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-label={playing ? "Pause video" : "Play video"}
              onClick={() => {
                const video = playerRef.current;
                if (!video) return;
                if (playing) {
                  video.pause();
                  setPlaying(false);
                } else {
                  void video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
                }
              }}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-panel text-ink hover:border-ink-faint"
            >
              {playing ? (
                <Pause className="size-4" aria-hidden="true" />
              ) : (
                <Play className="size-4" aria-hidden="true" />
              )}
            </button>
            <input
              type="range"
              aria-label="Video position"
              min={0}
              max={Math.max(duration, 0.1)}
              step={0.1}
              value={Math.min(currentTime, duration || currentTime)}
              onChange={(e) => {
                const video = playerRef.current;
                if (!video) return;
                video.currentTime = Number(e.target.value);
                setCurrentTime(Number(e.target.value));
              }}
              className="min-w-32 flex-1 accent-(--color-accent)"
            />
            <span className="text-[11.5px] tabular-nums text-ink-soft">
              {formatVideoTime(currentTime)} / {formatVideoTime(duration)}
            </span>
            <Button onClick={() => void captureFromPlayer()} disabled={busy}>
              {busy ? "Saving…" : "Use this frame"}
            </Button>
          </div>
          {coverSource === "frame" && coverTimestamp != null && (
            <p className="flex items-center gap-1 text-[12px] text-ink-soft">
              <Check className="size-3.5 text-accent" aria-hidden="true" />
              Frame at {formatVideoTime(coverTimestamp)} selected as cover.
            </p>
          )}
          {frameError && (
            <p role="alert" className="text-[12px] text-red-700">
              {frameError}
            </p>
          )}
        </div>
      )}

      {tab === "upload" && (
        <div className="space-y-2">
          {coverSource === "uploaded" && (
            <Button
              onClick={() => {
                // Replacing the custom image with a regenerated default.
                void extractDefaultCover(videoUrl).then((frame) => {
                  if (frame) void persistFrame(frame, "generated");
                });
              }}
              disabled={busy}
            >
              Remove custom image
            </Button>
          )}
          <UploadDropzone
            bucket="post-media"
            multiple={false}
            label="Upload cover image"
            onUploaded={(items) => {
              const item = items[0];
              if (item) {
                onCoverSelected({
                  url: item.url,
                  previewUrl: item.previewUrl,
                  source: "uploaded",
                  timestamp: null,
                });
              }
            }}
          />
          <p className="text-[11.5px] text-ink-faint">
            JPG, PNG, or WEBP — stored exactly as uploaded. A custom image replaces the
            generated frame until you remove it.
          </p>
        </div>
      )}
    </div>
  );
}
