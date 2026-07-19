export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

export interface FileValidationResult {
  ok: boolean;
  error?: string;
  /** Why validation failed — folder imports skip "type" failures silently. */
  reason?: "type" | "size";
  mediaType: "image" | "video";
}

export function validateUpload(file: File, allowVideo: boolean): FileValidationResult {
  const isImage = IMAGE_TYPES.includes(file.type);
  const isVideo = VIDEO_TYPES.includes(file.type);

  if (!isImage && !isVideo) {
    return {
      ok: false,
      mediaType: "image",
      reason: "type",
      error: `${file.name}: unsupported type. Use JPG, PNG, WEBP${allowVideo ? ", or MP4/WebM video" : ""}.`,
    };
  }
  if (isVideo && !allowVideo) {
    return {
      ok: false,
      mediaType: "video",
      reason: "type",
      error: `${file.name}: videos are only allowed for reels.`,
    };
  }
  const limit = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > limit) {
    return {
      ok: false,
      mediaType: isVideo ? "video" : "image",
      reason: "size",
      error: `${file.name}: larger than ${Math.round(limit / 1024 / 1024)} MB.`,
    };
  }
  return { ok: true, mediaType: isVideo ? "video" : "image" };
}

/* ------------------------------------------------------------------------- */
/* Folder imports                                                            */
/*                                                                           */
/* A folder is only an input method: its files are read recursively and fed  */
/* through the normal per-file validation/upload pipeline as original File   */
/* objects. No folder entity is ever persisted.                              */
/* ------------------------------------------------------------------------- */

export interface CollectedFile {
  file: File;
  /** Path relative to the drop/selection root, e.g. "shoot/nested/img.png". */
  relativePath: string;
}

const SYSTEM_FILE_NAMES = new Set(["thumbs.db", "desktop.ini"]);

/** Hidden/system files (and anything inside a hidden folder) are ignored. */
export function isHiddenOrSystemPath(path: string): boolean {
  return path.split("/").some((segment) => {
    const name = segment.trim().toLowerCase();
    return name.startsWith(".") || SYSTEM_FILE_NAMES.has(name);
  });
}

/** Deterministic import order: relative folder path + filename. */
export function sortCollectedFiles(files: CollectedFile[]): CollectedFile[] {
  return [...files].sort((a, b) =>
    (a.relativePath || a.file.name).localeCompare(b.relativePath || b.file.name, "en"),
  );
}

/** Identity used to skip exact duplicates within one upload surface. */
export function duplicateKey(file: File): string {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

/** Wrap a plain FileList/array selection in the collected shape. */
export function collectPlainFiles(files: FileList | File[]): CollectedFile[] {
  return Array.from(files).map((file) => ({ file, relativePath: file.name }));
}

/**
 * Files chosen through an `<input webkitdirectory>` picker. The browser
 * enumerates the folder recursively; we drop hidden/system entries and sort.
 */
export function collectDirectoryInputFiles(files: FileList | File[]): CollectedFile[] {
  const collected = Array.from(files).map((file) => ({
    file,
    relativePath:
      (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
  }));
  return sortCollectedFiles(collected.filter((c) => !isHiddenOrSystemPath(c.relativePath)));
}

function readAllDirectoryEntries(directory: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  // readEntries returns batches (max ~100 in Chromium) — loop until empty.
  const reader = directory.createReader();
  return new Promise((resolve, reject) => {
    const all: FileSystemEntry[] = [];
    const step = () =>
      reader.readEntries((batch) => {
        if (batch.length === 0) return resolve(all);
        all.push(...batch);
        step();
      }, reject);
    step();
  });
}

async function walkEntry(
  entry: FileSystemEntry,
  parentPath: string,
  out: CollectedFile[],
): Promise<void> {
  if (isHiddenOrSystemPath(entry.name)) return;
  const path = parentPath ? `${parentPath}/${entry.name}` : entry.name;
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) =>
      (entry as FileSystemFileEntry).file(resolve, reject),
    );
    out.push({ file, relativePath: path });
  } else if (entry.isDirectory) {
    const children = await readAllDirectoryEntries(entry as FileSystemDirectoryEntry);
    for (const child of children) await walkEntry(child, path, out);
  }
}

/**
 * Recursively resolve dropped items (files and/or folders) to original File
 * objects. The entries must be captured synchronously inside the drop event
 * (`item.webkitGetAsEntry()`) — this async walk then reads them safely.
 */
export async function collectDroppedEntries(
  entries: (FileSystemEntry | null)[],
): Promise<CollectedFile[]> {
  const out: CollectedFile[] = [];
  for (const entry of entries) {
    if (entry) await walkEntry(entry, "", out);
  }
  return sortCollectedFiles(out);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
