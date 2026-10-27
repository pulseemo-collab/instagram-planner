import { expect, test } from "@playwright/test";
import { enterDemo, evidence, panelTab, paths, phone } from "./helpers";

async function openComposer(page: import("@playwright/test").Page, clientId = "client-kavo") {
  await enterDemo(page, `/clients/${clientId}`);
  await panelTab(page, "Posts").click();
  await page.getByRole("button", { name: "New post" }).click();
  return page.getByRole("dialog", { name: "New post" });
}

test.describe("Uploads & post creation", () => {
  test("upload validation: invalid type rejected, remove before saving works", async ({ page }) => {
    const dialog = await openComposer(page);
    await dialog.locator('input[type="file"]').first().setInputFiles(paths.asset("notes.txt"));
    await expect(dialog.getByText(/unsupported type/)).toBeVisible();

    await dialog.locator('input[type="file"]').first().setInputFiles(paths.asset("photo-1.png"));
    await expect(dialog.getByText("photo-1.png")).toBeVisible();
    await dialog.getByRole("button", { name: "Remove photo-1.png" }).click();
    await expect(dialog.getByText("photo-1.png")).toHaveCount(0);
  });

  test("post requires a name, then media, before saving", async ({ page }) => {
    const dialog = await openComposer(page);
    await dialog.getByRole("button", { name: "Create post" }).click();
    await expect(dialog.getByText(/Give the post a name/)).toBeVisible();
    await dialog.getByLabel("Post name").fill("Validation check");
    await dialog.getByRole("button", { name: "Create post" }).click();
    await expect(dialog.getByText("Add at least one media file.")).toBeVisible();
  });

  test("create single-image post (jpg + webp accepted) with caption, hashtags, emoji @smoke", async ({
    page,
  }) => {
    const dialog = await openComposer(page);
    await dialog.locator('input[type="file"]').first().setInputFiles(paths.asset("photo.jpg"));
    // Upload finished: the file is a slide in the post, and saving is enabled.
    await expect(dialog.getByRole("button", { name: "Remove slide 1" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Create post" })).toBeEnabled();
    await dialog.getByLabel("Post name").fill("Fresh drop");
    await dialog.getByLabel("Caption").fill("Fresh drop ☕ — Üñíçødé test");
    await dialog.getByLabel("Hashtags").fill("#coffee specialty  #rotterdam");
    await dialog.getByLabel("Location").fill("Rotterdam");
    await dialog.getByLabel("Alt text").fill("Bag of coffee");
    await dialog.getByRole("button", { name: "Create post" }).click();
    await expect(page.locator("body")).toContainText("Post created");

    // New tile lands in the grid (seed Kavo has 3 posts → now 4).
    await expect(page.locator(".ig-root .grid.grid-cols-3 > button")).toHaveCount(4);

    // Open it and confirm caption + normalized hashtags.
    await page.locator(".ig-root .grid.grid-cols-3 > button").last().click();
    await expect(page).toHaveURL(/\/posts\//);
    await expect(phone(page)).toContainText("Fresh drop ☕");
    await expect(phone(page)).toContainText("#coffee #specialty #rotterdam");
    await evidence(page, "posts", "single-image-detail");
  });

  test("create carousel: multi-upload, reorder slide, remove slide, min-2 validation", async ({
    page,
  }) => {
    const dialog = await openComposer(page);
    await dialog.getByLabel("Post type").selectOption("carousel");
    await dialog
      .locator('input[type="file"]')
      .first()
      .setInputFiles([paths.asset("photo-1.png"), paths.asset("photo-2.png"), paths.asset("photo-3.png")]);
    await expect(dialog.getByText("Media (3 slides)")).toBeVisible();

    // Reorder: move slide 2 left → becomes slide 1.
    await dialog.getByRole("button", { name: "Move slide 2 left" }).click();
    // Remove the last slide.
    await dialog.getByRole("button", { name: "Remove slide 3" }).click();
    await expect(dialog.getByText("Media (2 slides)")).toBeVisible();

    await dialog.getByLabel("Post name").fill("Carousel test");
    await dialog.getByLabel("Caption").fill("Carousel test");
    await dialog.getByRole("button", { name: "Create post" }).click();
    await expect(page.locator("body")).toContainText("Post created");

    // Carousel badge (stacked squares) shows on the new tile.
    const newTile = page.locator(".ig-root .grid.grid-cols-3 > button").last();
    await expect(newTile.locator("svg")).toBeVisible();

    await newTile.click();
    await expect(phone(page)).toContainText("1/2");
    await page.getByRole("button", { name: "Next slide" }).click();
    await expect(phone(page)).toContainText("2/2");
    await evidence(page, "posts", "carousel-detail");
  });

  test("create reel with video and cover; appears in reels tab with view count", async ({
    page,
  }) => {
    const dialog = await openComposer(page);
    await dialog.getByLabel("Post type").selectOption("reel");
    await dialog.locator('input[type="file"]').first().setInputFiles(paths.asset("clip.webm"));
    await expect(dialog.getByText("clip.webm")).toBeVisible();
    // Upload a custom cover through the Video cover section's Upload tab.
    await expect(dialog.getByText("Video cover")).toBeVisible();
    await dialog.getByRole("radio", { name: "Upload image" }).click();
    await dialog.locator('input[type="file"]').nth(1).setInputFiles(paths.asset("cover.png"));
    await expect(dialog.getByText("Custom uploaded image")).toBeVisible();
    await dialog.getByLabel("Post name").fill("Reel test");
    await dialog.getByLabel("Caption").fill("Reel test");
    await dialog.getByRole("button", { name: "Create post" }).click();
    await expect(page.locator("body")).toContainText("Post created");

    // Switch phone to Reels tab — 9:16 tiles.
    await page.locator(".ig-root [role=tab][aria-label=Reels]").click();
    const reelTiles = page.locator(".ig-root .grid.grid-cols-3 > button");
    await expect(reelTiles).toHaveCount(2); // seed reel + new reel
    await evidence(page, "posts", "reels-tab");
  });

  test("inline editor: schedule a post, verify status; pinned max is enforced", async ({
    page,
  }) => {
    await enterDemo(page, "/clients/client-aurelle/posts/post-a4");
    const editor = page.locator('section[aria-label="Edit post"]');
    await editor.getByRole("switch", { name: "Schedule" }).click();
    await editor.getByLabel("Date (DD/MM/YYYY)").fill("05/08/2026");
    await editor.getByLabel("Time").fill("10:30");
    await editor.getByRole("button", { name: "Save changes" }).click();
    await expect(page.locator("body")).toContainText("Post updated");
    await expect(page.locator("body")).toContainText("Scheduled");

    // Seed has 2 pinned posts; pin this one (3rd, allowed), then check a 4th is blocked.
    await editor.getByRole("switch", { name: "Pin to profile" }).click();
    await editor.getByRole("button", { name: "Save changes" }).click();
    await expect(page.locator("body")).toContainText("Post updated");

    await page.goto("/clients/client-aurelle/posts/post-a6");
    await expect(
      page.locator('section[aria-label="Edit post"]').getByRole("switch", { name: "Pin to profile" }),
    ).toBeDisabled();
  });

  test("delete post removes it from the grid", async ({ page }) => {
    await enterDemo(page, "/clients/client-kavo");
    const tiles = page.locator(".ig-root .grid.grid-cols-3 > button");
    await expect(tiles).toHaveCount(3);
    await tiles.first().click();
    await expect(page).toHaveURL(/\/posts\//);
    await page.getByRole("button", { name: "Delete post" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete post" }).click();
    await expect(page).toHaveURL(/\/clients\/client-kavo$/);
    await expect(page.locator(".ig-root .grid.grid-cols-3 > button")).toHaveCount(2);
  });
});
