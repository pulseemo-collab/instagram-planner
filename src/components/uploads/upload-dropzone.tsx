"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";
import { CircleAlert, RotateCw, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { createId } from "@/lib/id";
import { getRepository } from "@/lib/repositories";
import { validateUpload } from "@/lib/uploads";

export interface UploadedItem {
  key: string;
  /** Persistent reference returned by the repository. */
  url: string;
  mediaType: "image" | "video";
  /** Local preview (object URL). */
  previewUrl: string;
  width: number | null;
  height: number | null;
  fileName: string;
}

interface PendingItem {
  key: string;
  file: File;
  mediaType: "image" | "video";
  previewUrl: string;
  progress: number;
  status: "uploading" | "error" | "done";
  error?: string;
}

export interface UploadDropzoneProps {
  bucket: "avatars" | "highlights" | "post-media";
  allowVideo?: boolean;
  multiple?: boolean;
  label?: string;
  onUploaded: (items: UploadedItem[]) => void;
  className?: string;
}

/**
 * Drag-and-drop / file-picker upload surface with per-file validation,
 * progress, retry, and removal. Calls `onUploaded` as files finish.
 */
export function UploadDropzone({
  bucket,
  allowVideo = false,
  multiple = true,
  label,
  onUploaded,
  className,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<PendingItem[]>([]);
  const [dragActive, setDragActive] = useState(false);

  const patchItem = useCallback((key: string, patch: Partial<PendingItem>) => {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }, []);

  const startUpload = useCallback(
    async (pending: PendingItem) => {
      try {
        const repo = await getRepository();
        const result = await repo.uploadFile(pending.file, bucket, (fraction) =>
          patchItem(pending.key, { progress: fraction }),
        );
        patchItem(pending.key, { status: "done", progress: 1 });
        onUploaded([
          {
            key: pending.key,
            url: result.url,
            mediaType: pending.mediaType,
            previewUrl: pending.previewUrl,
            width: result.width,
            height: result.height,
            fileName: pending.file.name,
          },
        ]);
      } catch (error) {
        patchItem(pending.key, {
          status: "error",
          error: error instanceof Error ? error.message : "Upload failed",
        });
      }
    },
    [bucket, onUploaded, patchItem],
  );

  const acceptFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      const selected = multiple ? list : list.slice(0, 1);
      for (const file of selected) {
        const validation = validateUpload(file, allowVideo);
        const key = createId();
        const previewUrl = URL.createObjectURL(file);
        const pending: PendingItem = {
          key,
          file,
          mediaType: validation.mediaType,
          previewUrl,
          progress: 0,
          status: validation.ok ? "uploading" : "error",
          error: validation.error,
        };
        setItems((current) => [...current, pending]);
        if (validation.ok) void startUpload(pending);
      }
    },
    [allowVideo, multiple, startUpload],
  );

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragActive(false);
    if (event.dataTransfer.files.length) acceptFiles(event.dataTransfer.files);
  }

  const accept = [
    "image/jpeg",
    "image/png",
    "image/webp",
    ...(allowVideo ? ["video/mp4", "video/webm", "video/quicktime"] : []),
  ].join(",");

  return (
    <div className={className}>
      {/* A <label> wrapper gives the file input its accessible name and
          activates it natively on click — no nested interactive roles
          (fixes audit BUG-003: axe `label` + `nested-interactive`). */}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-7 text-center transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent",
          dragActive
            ? "border-accent bg-accent-soft/60"
            : "border-line-strong bg-panel-raised hover:border-ink-faint",
        )}
      >
        <UploadCloud className="size-5 text-ink-faint" aria-hidden="true" />
        <p className="text-[13px] font-medium text-ink">
          {label ?? (multiple ? "Drop files or click to browse" : "Drop a file or click to browse")}
        </p>
        <p className="text-[11.5px] text-ink-faint">
          JPG, PNG, WEBP{allowVideo ? " · MP4/WebM for reels" : ""}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          aria-label={label ?? "Upload files"}
          className="sr-only"
          onChange={(e) => {
            if (e.target.files?.length) acceptFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {items.length > 0 && (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li
              key={item.key}
              className="flex items-center gap-3 rounded-lg border border-line bg-panel px-3 py-2"
            >
              {item.mediaType === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element -- transient local preview
                <img src={item.previewUrl} alt="" className="size-9 shrink-0 rounded object-cover" />
              ) : (
                <video src={item.previewUrl} className="size-9 shrink-0 rounded object-cover" muted />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium text-ink">{item.file.name}</p>
                {item.status === "error" ? (
                  <p className="flex items-center gap-1 text-[11.5px] text-red-700">
                    <CircleAlert className="size-3" aria-hidden="true" />
                    {item.error}
                  </p>
                ) : (
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-ink transition-[width]"
                      style={{ width: `${Math.round(item.progress * 100)}%` }}
                    />
                  </div>
                )}
              </div>
              {item.status === "error" && !item.error?.includes("unsupported") && (
                <button
                  type="button"
                  aria-label={`Retry uploading ${item.file.name}`}
                  onClick={() => {
                    patchItem(item.key, { status: "uploading", progress: 0, error: undefined });
                    void startUpload({ ...item, status: "uploading", progress: 0 });
                  }}
                  className="flex size-7 shrink-0 items-center justify-center rounded text-ink-soft hover:bg-canvas hover:text-ink"
                >
                  <RotateCw className="size-3.5" aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                aria-label={`Remove ${item.file.name}`}
                onClick={() => setItems((current) => current.filter((i) => i.key !== item.key))}
                className="flex size-7 shrink-0 items-center justify-center rounded text-ink-soft hover:bg-canvas hover:text-ink"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
