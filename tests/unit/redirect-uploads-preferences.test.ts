import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { DEFAULT_PREFERENCES, approvalFlowFlags, parsePreferences } from "@/lib/preferences";
import {
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  collectDirectoryInputFiles,
  duplicateKey,
  formatBytes,
  isHiddenOrSystemPath,
  sortCollectedFiles,
  validateUpload,
} from "@/lib/uploads";

describe("safeRedirectPath", () => {
  it("keeps same-site paths, including query and hash", () => {
    expect(safeRedirectPath("/clients")).toBe("/clients");
    expect(safeRedirectPath("/clients/abc?tab=posts#top")).toBe("/clients/abc?tab=posts#top");
  });

  it.each([
    "https://evil.example/",
    "//evil.example/",
    "/\\evil.example/",
    "javascript:alert(1)",
    "evil.example",
    "",
    null,
    undefined,
  ])("falls back for %s", (value) => {
    expect(safeRedirectPath(value)).toBe("/");
    expect(safeRedirectPath(value, "/calendar")).toBe("/calendar");
  });
});

function file(name: string, type: string, size = 10): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe("validateUpload", () => {
  it("accepts supported images, and videos only when allowed", () => {
    expect(validateUpload(file("a.jpg", "image/jpeg"), false)).toEqual({ ok: true, mediaType: "image" });
    expect(validateUpload(file("a.mov", "video/quicktime"), true)).toEqual({ ok: true, mediaType: "video" });
    expect(validateUpload(file("a.mp4", "video/mp4"), false)).toMatchObject({ ok: false, reason: "type" });
  });

  it("rejects other types, mentioning every accepted video format", () => {
    const result = validateUpload(file("notes.txt", "text/plain"), true);
    expect(result).toMatchObject({ ok: false, reason: "type" });
    expect(result.error).toContain("MP4/WebM/MOV");
  });

  it("enforces the size limits", () => {
    expect(validateUpload(file("big.png", "image/png", MAX_IMAGE_BYTES + 1), false)).toMatchObject({
      ok: false,
      reason: "size",
    });
    expect(validateUpload(file("ok.png", "image/png", MAX_IMAGE_BYTES), false).ok).toBe(true);
    expect(validateUpload(file("big.webm", "video/webm", MAX_VIDEO_BYTES + 1), true)).toMatchObject({
      ok: false,
      reason: "size",
    });
  });
});

describe("folder import helpers", () => {
  it("skips hidden and system entries anywhere in the path", () => {
    expect(isHiddenOrSystemPath("shoot/.DS_Store")).toBe(true);
    expect(isHiddenOrSystemPath(".git/config")).toBe(true);
    expect(isHiddenOrSystemPath("shoot/Thumbs.db")).toBe(true);
    expect(isHiddenOrSystemPath("shoot/desktop.ini")).toBe(true);
    expect(isHiddenOrSystemPath("shoot/nested/03-extra.png")).toBe(false);
  });

  it("orders by relative path and drops hidden files from directory pickers", () => {
    const withPath = (name: string, relativePath: string) => {
      const f = file(name, "image/png");
      Object.defineProperty(f, "webkitRelativePath", { value: relativePath });
      return f;
    };
    const collected = collectDirectoryInputFiles([
      withPath("02.png", "shoot/02.png"),
      withPath("Thumbs.db", "shoot/Thumbs.db"),
      withPath("03.png", "shoot/nested/03.png"),
      withPath("01.png", "shoot/01.png"),
    ]);
    expect(collected.map((c) => c.relativePath)).toEqual([
      "shoot/01.png",
      "shoot/02.png",
      "shoot/nested/03.png",
    ]);
    expect(sortCollectedFiles([...collected].reverse()).map((c) => c.relativePath)).toEqual(
      collected.map((c) => c.relativePath),
    );
  });

  it("identifies duplicates by name, size and modification time", () => {
    const a = new File(["x"], "a.png", { type: "image/png", lastModified: 1 });
    const b = new File(["x"], "a.png", { type: "image/png", lastModified: 1 });
    const c = new File(["x"], "a.png", { type: "image/png", lastModified: 2 });
    expect(duplicateKey(a)).toBe(duplicateKey(b));
    expect(duplicateKey(a)).not.toBe(duplicateKey(c));
  });

  it("formats sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("preferences", () => {
  it("falls back to defaults for missing, corrupted or unknown values", () => {
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences("{not json")).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences(JSON.stringify({ defaultTheme: "neon", defaultApprovals: "all" }))).toEqual(
      DEFAULT_PREFERENCES,
    );
    expect(parsePreferences(JSON.stringify({ defaultTheme: "dark", defaultApprovals: "view_only" }))).toEqual({
      defaultTheme: "dark",
      defaultApprovals: "view_only",
    });
  });

  it("maps approval flows to share-link permissions", () => {
    expect(approvalFlowFlags("comments_and_approvals")).toEqual({ allowComments: true, allowApproval: true });
    expect(approvalFlowFlags("comments_only")).toEqual({ allowComments: true, allowApproval: false });
    expect(approvalFlowFlags("view_only")).toEqual({ allowComments: false, allowApproval: false });
  });
});
