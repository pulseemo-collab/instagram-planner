import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import { enterDemo, enterDemoCalendar, evidence, paths, phone, watchConsole } from "./helpers";

/** React render-phase violations that must never appear (Issue 1 regression). */
const RENDER_ERROR = /Cannot update a component|while rendering a different component|setState in render/i;

function expectNoRenderErrors(errors: string[]): void {
  expect(errors.filter((e) => RENDER_ERROR.test(e)), "React render-phase errors").toEqual([]);
}

/**
 * Video cover workflow (targeted spec).
 *
 * clip-frames.webm is a real 4s VP8 video whose frames differ strongly over
 * time (hue sweep + moving block), so suggested-frame extraction, dedup, and
 * frame capture operate on genuine decoded frames.
 */

const contentCards = (page: Page) => page.locator('[role=group][aria-label^="Content package"]');

async function addVideoContent(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: "Add content" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add content" });
  await dialog.getByLabel("Content name").fill(name);
  await dialog.locator('input[type="file"]').first().setInputFiles(paths.asset("clip-frames.webm"));
  await expect(dialog.getByText("clip-frames.webm")).toBeVisible();
  await dialog.getByRole("button", { name: "Add content" }).click();
  await expect(page.locator("body")).toContainText("Content added");
}

/** Designer adds a video package; scheduler places it and opens Create post. */
async function openVideoCreatePost(page: Page, name: string): Promise<void> {
  await enterDemoCalendar(page, "client-kavo");
  await addVideoContent(page, name);
  await contentCards(page)
    .filter({ hasText: name })
    .getByRole("button", { name: "Schedule", exact: true })
    .click();
  const scheduleDialog = page.getByRole("dialog", { name: /Schedule/ });
  await scheduleDialog.getByRole("button", { name: "Schedule" }).click();
  await expect(page.locator("body")).toContainText("Content placed");
  await contentCards(page).filter({ hasText: name }).getByRole("button", { name: /Open/ }).click();
  await expect(page.getByRole("heading", { name: "Create post" })).toBeVisible();
}

const coverSection = (page: Page) => page.locator("#main-content");

test.describe("Video cover", () => {
  test("image posts and placeholder seed reels show no Video cover section", async ({ page }) => {
    // Image post: no video, no section.
    await enterDemo(page, "/clients/client-aurelle/posts/post-a4");
    await expect(page.locator('section[aria-label="Edit post"]')).toBeVisible();
    await expect(page.getByText("Video cover")).toHaveCount(0);

    // Seed reel uses a gradient: placeholder (nothing to decode) — legacy
    // editor stays as before, without the picker.
    await enterDemo(page, "/clients/client-kavo");
    await page.locator(".ig-root [role=tab][aria-label=Reels]").click();
    await page.locator(".ig-root .grid.grid-cols-3 > button").first().click();
    await expect(page).toHaveURL(/\/posts\//);
    await expect(page.getByText("Video cover")).toHaveCount(0);
  });

  test("FULL WORKFLOW: default cover, suggested frames, frame capture, persistence, grid @smoke", async ({
    page,
  }) => {
    const { errors } = watchConsole(page);
    await openVideoCreatePost(page, "Video pack");

    // 1) DEFAULT COVER: generated automatically (~10% in), no user action —
    // and the large Current cover preview shows it.
    await expect(coverSection(page).getByRole("status")).toContainText(
      /Suggested frame at/,
      { timeout: 20_000 },
    );
    await expect(page.getByRole("img", { name: "Current video cover" })).toBeVisible();
    // The Instagram preview immediately uses it as the video poster.
    const igVideo = phone(page).locator("video");
    await expect(igVideo).toHaveAttribute("poster", /^data:image\/jpeg/);
    const defaultPoster = await igVideo.getAttribute("poster");

    // 2) SUGGESTED FRAMES: distributed positions, deduped, selectable.
    const suggested = page.getByRole("button", { name: /Use frame at .* as cover/ });
    await expect.poll(() => suggested.count(), { timeout: 20_000 }).toBeGreaterThanOrEqual(3);
    // The auto-selected default is marked as the current choice.
    await expect(page.locator('button[aria-pressed="true"]', { hasText: /0:00/ })).toBeVisible();

    // Selecting a different suggestion updates BOTH previews immediately:
    // the phone poster and the large Current cover image.
    const largeCover = page.getByRole("img", { name: "Current video cover" });
    const largeCoverBefore = await largeCover.getAttribute("src");
    await suggested.last().click();
    await expect
      .poll(async () => igVideo.getAttribute("poster"), { timeout: 15_000 })
      .not.toBe(defaultPoster);
    await expect
      .poll(async () => largeCover.getAttribute("src"), { timeout: 15_000 })
      .not.toBe(largeCoverBefore);
    await evidence(page, "video-cover", "suggested-frames");

    // 3) CHOOSE FRAME: seek the player and capture the current position.
    await page.getByRole("radio", { name: "Choose frame" }).click();
    await expect(page.getByText(/\/ 0:0[34]/)).toBeVisible({ timeout: 15_000 }); // metadata loaded
    await page.getByLabel("Video position").fill("2");
    await page.getByRole("button", { name: "Use this frame" }).click();
    await expect(coverSection(page).getByRole("status")).toContainText("Frame at 0:02", {
      timeout: 15_000,
    });
    await expect(page.getByText(/Frame at 0:02.* selected as cover/)).toBeVisible();

    // 4) CREATE POST with the chosen cover (date pre-filled, time required).
    const editor = page.locator('section[aria-label="Create post"]');
    await editor.getByLabel("Caption").fill("Video with chosen cover");
    await editor.getByLabel("Time").fill("10:00");
    await editor.getByRole("button", { name: "Create post" }).click();
    await expect(page.locator("body")).toContainText("Post created");
    await expect(page.getByRole("heading", { name: "Edit post" })).toBeVisible();

    // 5) EDIT POST after reload: the chosen cover is restored from storage.
    await page.reload();
    await expect(page.getByRole("heading", { name: "Edit post" })).toBeVisible();
    await expect(coverSection(page).getByRole("status")).toContainText("Frame at 0:02", {
      timeout: 20_000,
    });
    await expect(phone(page).locator("video")).toHaveAttribute("poster", /^data:image\/jpeg/);

    // 6) The cover appears on the profile grid and the Reels tab.
    await page.goto("/clients/client-kavo");
    const newTile = page.locator(".ig-root .grid.grid-cols-3 > button").last();
    await expect(newTile.locator('img[src^="data:image/jpeg"]')).toBeVisible();
    await page.locator(".ig-root [role=tab][aria-label=Reels]").click();
    await expect(
      page.locator('.ig-root .grid.grid-cols-3 > button img[src^="data:image/jpeg"]'),
    ).toHaveCount(1);
    await evidence(page, "video-cover", "grid-with-cover");

    // 7) ORIGINAL VIDEO RULE: playback still uses the untouched original.
    await page.locator(".ig-root .grid.grid-cols-3 > button").last().click();
    await expect(page).toHaveURL(/\/posts\//);
    const video = phone(page).locator("video");
    await expect(video).toHaveAttribute("poster", /^data:image\/jpeg/);
    const src = await video.getAttribute("src");
    expect(src).toMatch(/^data:video\/webm/);
    expect(src!.split(",")[1]).toBe(
      fs.readFileSync(paths.asset("clip-frames.webm")).toString("base64"),
    );
    // ...and it actually plays.
    const played = await video.evaluate(async (el) => {
      const v = el as HTMLVideoElement;
      try {
        await v.play();
      } catch {
        return false;
      }
      await new Promise((r) => setTimeout(r, 400));
      const ok = v.currentTime > 0;
      v.pause();
      return ok;
    });
    expect(played).toBe(true);

    // ISSUE 1 REGRESSION: the whole flow ran without React render-phase errors.
    expectNoRenderErrors(errors);
  });

  test("BROKEN COVER: invalid thumbnail falls back to a generated frame, no loops", async ({
    page,
  }) => {
    const { errors } = watchConsole(page);
    const BROKEN_URL = "https://invalid.gridline.test/broken-cover.jpg";
    await page.route("**/broken-cover.jpg", (route) => route.abort());

    // Create a video post with a normal generated cover first.
    await openVideoCreatePost(page, "Broken cover pack");
    await expect(coverSection(page).getByRole("status")).toContainText(
      /Suggested frame at/,
      { timeout: 20_000 },
    );
    const editor = page.locator('section[aria-label="Create post"]');
    await editor.getByLabel("Caption").fill("Broken cover victim");
    await editor.getByLabel("Time").fill("11:00");
    await editor.getByRole("button", { name: "Create post" }).click();
    await expect(page.locator("body")).toContainText("Post created");

    // Corrupt the stored cover: unloadable URL + stale "uploaded" source.
    await page.evaluate(
      (brokenUrl) =>
        new Promise<void>((resolve, reject) => {
          const open = indexedDB.open("gridline-studio", 1);
          open.onsuccess = () => {
            const db = open.result;
            const tx = db.transaction("state", "readwrite");
            const store = tx.objectStore("state");
            const get = store.get("workspace-v1");
            get.onsuccess = () => {
              const state = get.result as {
                media: Array<{
                  mediaType: string;
                  thumbnailUrl: string | null;
                  coverSource?: string | null;
                  coverTimestamp?: number | null;
                }>;
              };
              const target = state.media.find(
                (m) => m.mediaType === "video" && m.thumbnailUrl?.startsWith("local:"),
              );
              if (!target) return reject(new Error("no video cover media found"));
              target.thumbnailUrl = brokenUrl;
              target.coverSource = "uploaded";
              target.coverTimestamp = null;
              store.put(state, "workspace-v1");
            };
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
            tx.onerror = () => reject(tx.error);
          };
          open.onerror = () => reject(open.error);
        }),
      BROKEN_URL,
    );

    await page.reload();
    await expect(page.getByRole("heading", { name: "Edit post" })).toBeVisible();

    // The stale "Custom uploaded image" label must not stick: the failed
    // image triggers a generated fallback whose label matches reality.
    await expect(coverSection(page).getByRole("status")).toContainText(
      /Suggested frame at/,
      { timeout: 25_000 },
    );
    await expect(coverSection(page).getByRole("status")).not.toContainText(
      "Custom uploaded image",
    );

    // The large preview shows a real, fully loaded image — never the native
    // broken-image icon (an errored img is unmounted entirely).
    const cover = page.getByRole("img", { name: "Current video cover" });
    await expect(cover).toBeVisible();
    expect(await cover.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    expect(await cover.getAttribute("src")).not.toBe(BROKEN_URL);

    // No regeneration loop: the media store stops growing once recovered.
    const countMedia = () =>
      page.evaluate(
        () =>
          new Promise<number>((resolve, reject) => {
            const open = indexedDB.open("gridline-studio", 1);
            open.onsuccess = () => {
              const db = open.result;
              const rq = db.transaction("media", "readonly").objectStore("media").count();
              rq.onsuccess = () => {
                resolve(rq.result);
                db.close();
              };
              rq.onerror = () => reject(rq.error);
            };
            open.onerror = () => reject(open.error);
          }),
      );
    const settled = await countMedia();
    await page.waitForTimeout(1500);
    expect(await countMedia()).toBe(settled);

    expectNoRenderErrors(errors);
  });

  test("custom cover upload: JPG/PNG/WEBP accepted, others rejected, removable", async ({
    page,
  }) => {
    await openVideoCreatePost(page, "Cover upload pack");
    await expect(coverSection(page).getByRole("status")).toContainText(
      /Suggested frame at/,
      { timeout: 20_000 },
    );

    await page.getByRole("radio", { name: "Upload image" }).click();
    const pickerInput = page
      .locator('section[aria-label="Create post"] input[type="file"]')
      .last();

    // Unsupported file → clear validation error, cover unchanged.
    await pickerInput.setInputFiles(paths.asset("notes.txt"));
    await expect(page.getByText(/unsupported type/)).toBeVisible();
    await expect(coverSection(page).getByRole("status")).toContainText(/Suggested frame at/);

    // JPG accepted — custom image takes precedence over generated frames,
    // and the large Current cover preview shows it.
    await pickerInput.setInputFiles(paths.asset("photo.jpg"));
    await expect(coverSection(page).getByRole("status")).toContainText(
      "Custom uploaded image",
      { timeout: 15_000 },
    );
    await expect(page.getByRole("img", { name: "Current video cover" })).toBeVisible();

    // WEBP accepted as a replacement.
    await pickerInput.setInputFiles(paths.asset("photo.webp"));
    await expect(coverSection(page).getByRole("status")).toContainText("Custom uploaded image");

    // Removing the custom image falls back to a regenerated default frame.
    await page.getByRole("button", { name: "Remove custom image" }).click();
    await expect(coverSection(page).getByRole("status")).toContainText(
      /Suggested frame at/,
      { timeout: 20_000 },
    );
  });

  test("focused axe scan: Create post page with the Video cover section", async ({ page }) => {
    await openVideoCreatePost(page, "A11y pack");
    await expect(coverSection(page).getByRole("status")).toContainText(
      /Suggested frame at/,
      { timeout: 20_000 },
    );
    await page.getByRole("radio", { name: "Choose frame" }).click();
    await expect(page.getByLabel("Video position")).toBeVisible();
    const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(
      scan.violations.map((v) => `${v.id} (${v.impact}, ${v.nodes.length} nodes)`),
      "axe violations on Create post with Video cover",
    ).toEqual([]);
  });
});
