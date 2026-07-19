"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";
import { CircleAlert, FolderOpen, RotateCw, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { createId } from "@/lib/id";
import { getRepository } from "@/lib/repositories";
import {
  collectDirectoryInputFiles,
  collectDroppedEntries,
  collectPlainFiles,
  duplicateKey,
  validateUpload,
  type CollectedFile,
} from "@/lib/uploads";

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
  /** Duplicate-prevention identity (folders mode). */
  dupKey?: string;
}

interface ImportNotice {
  text: string;
  isError: boolean;
}

export interface UploadDropzoneProps {
  bucket: "avatars" | "highlights" | "post-media";
  allowVideo?: boolean;
  multiple?: boolean;
  /**
   * Accept dropped folders (recursive import) and show a "Choose folder"
   * picker. Also enables exact-duplicate skipping and sequential uploads so
   * import order stays deterministic (relative path + filename).
   */
  allowFolders?: boolean;
  label?: string;
  onUploaded: (items: UploadedItem[]) => void;
  className?: string;
}

function plural(count: number, singular: string, pluralWord = `${singular}s`): string {
  return count === 1 ? singular : pluralWord;
}

/**
 * Drag-and-drop / file-picker upload surface with per-file validation,
 * progress, retry, and removal. Calls `onUploaded` as files finish.
 */
export function UploadDropzone({
  bucket,
  allowVideo = false,
  multiple = true,
  allowFolders = false,
  label,
  onUploaded,
  className,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const seenKeysRef = useRef<Set<string>>(new Set());
  const [items, setItems] = useState<PendingItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [notice, setNotice] = useState<ImportNotice | null>(null);

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

  /**
   * Folders-mode pipeline: validate each discovered file individually, skip
   * exact duplicates, silently skip unsupported files inside folder imports
   * (they never fail the whole folder), then upload sequentially so the
   * package keeps the deterministic path+filename order.
   */
  const ingestCollected = useCallback(
    async (collected: CollectedFile[], fromFolder: boolean) => {
      const accepted: PendingItem[] = [];
      const rows: PendingItem[] = [];
      let added = 0;
      let unsupportedSkipped = 0;
      let duplicates = 0;

      for (const { file } of collected) {
        const dupKey = duplicateKey(file);
        if (seenKeysRef.current.has(dupKey)) {
          duplicates += 1;
          continue;
        }
        const validation = validateUpload(file, allowVideo);
        if (!validation.ok && validation.reason === "type" && fromFolder) {
          unsupportedSkipped += 1;
          continue;
        }
        const pending: PendingItem = {
          key: createId(),
          file,
          dupKey,
          mediaType: validation.mediaType,
          previewUrl: URL.createObjectURL(file),
          progress: 0,
          status: validation.ok ? "uploading" : "error",
          error: validation.error,
        };
        rows.push(pending);
        if (validation.ok) {
          seenKeysRef.current.add(dupKey);
          accepted.push(pending);
          added += 1;
        }
      }

      if (rows.length > 0) setItems((current) => [...current, ...rows]);

      if (fromFolder && added === 0 && duplicates === 0) {
        setNotice({ text: "No supported files found in that folder.", isError: true });
      } else {
        const parts = [`${added} ${plural(added, "file")} added`];
        if (unsupportedSkipped > 0) {
          parts.push(`${unsupportedSkipped} unsupported ${plural(unsupportedSkipped, "file")} skipped`);
        }
        if (duplicates > 0) parts.push(`${duplicates} ${plural(duplicates, "duplicate")} skipped`);
        setNotice({ text: `${parts.join(", ")}.`, isError: added === 0 });
      }

      for (const pending of accepted) await startUpload(pending);
    },
    [allowVideo, startUpload],
  );

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragActive(false);
    if (allowFolders) {
      // Entries must be captured synchronously — the DataTransfer is only
      // valid during the event. The recursive read happens afterwards.
      const dtItems = Array.from(event.dataTransfer.items ?? []);
      const entries = dtItems.map((item) =>
        typeof item.webkitGetAsEntry === "function" ? item.webkitGetAsEntry() : null,
      );
      if (entries.some(Boolean)) {
        const hasDirectory = entries.some((entry) => entry?.isDirectory);
        void collectDroppedEntries(entries).then((collected) =>
          ingestCollected(collected, hasDirectory),
        );
        return;
      }
      // Progressive enhancement: no entry API → plain file drop.
      if (event.dataTransfer.files.length) {
        void ingestCollected(collectPlainFiles(event.dataTransfer.files), false);
      }
      return;
    }
    if (event.dataTransfer.files.length) acceptFiles(event.dataTransfer.files);
  }

  const accept = [
    "image/jpeg",
    "image/png",
    "image/webp",
    ...(allowVideo ? ["video/mp4", "video/webm", "video/quicktime"] : []),
  ].join(",");

  const dropzoneClass = cn(
    "flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-7 text-center transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent",
    dragActive
      ? "border-accent bg-accent-soft/60"
      : "border-line-strong bg-panel-raised hover:border-ink-faint",
  );

  const formatsLine = (
    <p className="text-[11.5px] text-ink-faint">
      JPG, PNG, WEBP{allowVideo ? " · MP4/WebM for reels" : ""}
    </p>
  );

  return (
    <div className={className}>
      {allowFolders ? (
        // Folders mode: the surface accepts file AND folder drops; two
        // label-wrapped pickers keep the inputs accessibly named without
        // nested interactive roles.
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          className={dropzoneClass}
        >
          <UploadCloud className="size-5 text-ink-faint" aria-hidden="true" />
          <p className="text-[13px] font-medium text-ink">{label ?? "Drop files or folders here"}</p>
          {formatsLine}
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line-strong bg-panel px-3 py-1.5 text-[12.5px] font-medium text-ink transition-colors hover:border-ink-faint focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent">
              <UploadCloud className="size-3.5 text-ink-faint" aria-hidden="true" />
              Choose files
              <input
                ref={inputRef}
                type="file"
                accept={accept}
                multiple
                aria-label="Choose files"
                className="sr-only"
                onChange={(e) => {
                  if (e.target.files?.length) void ingestCollected(collectPlainFiles(e.target.files), false);
                  e.target.value = "";
                }}
              />
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line-strong bg-panel px-3 py-1.5 text-[12.5px] font-medium text-ink transition-colors hover:border-ink-faint focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent">
              <FolderOpen className="size-3.5 text-ink-faint" aria-hidden="true" />
              Choose folder
              <input
                type="file"
                aria-label="Choose folder"
                className="sr-only"
                {...({ webkitdirectory: "" } as Record<string, string>)}
                onChange={(e) => {
                  if (e.target.files?.length) {
                    void ingestCollected(collectDirectoryInputFiles(e.target.files), true);
                  }
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
      ) : (
        /* A <label> wrapper gives the file input its accessible name and
           activates it natively on click — no nested interactive roles
           (fixes audit BUG-003: axe `label` + `nested-interactive`). */
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          className={cn(dropzoneClass, "cursor-pointer")}
        >
          <UploadCloud className="size-5 text-ink-faint" aria-hidden="true" />
          <p className="text-[13px] font-medium text-ink">
            {label ?? (multiple ? "Drop files or click to browse" : "Drop a file or click to browse")}
          </p>
          {formatsLine}
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
      )}

      {allowFolders && (
        <p
          role="status"
          aria-live="polite"
          className={cn(
            "mt-2 min-h-4 text-[12px]",
            notice ? (notice.isError ? "text-red-700" : "text-ink-soft") : "text-ink-soft",
          )}
        >
          {notice?.text}
        </p>
      )}

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
                onClick={() => {
                  if (item.dupKey) seenKeysRef.current.delete(item.dupKey);
                  setItems((current) => current.filter((i) => i.key !== item.key));
                }}
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
