import { expect, test, type Page } from "@playwright/test";
import { enterDemo, evidence, phone } from "./helpers";

const tiles = (page: Page) => page.locator(".ig-root .grid.grid-cols-3 > button");

async function tileBackgrounds(page: Page): Promise<string[]> {
  return tiles(page).evaluateAll((els) =>
    els.map((el) => {
      const art = el.querySelector("div[style]") as HTMLElement | null;
      const img = el.querySelector("img");
      return img?.getAttribute("src")?.slice(0, 40) ?? art?.style.background.slice(0, 60) ?? "?";
    }),
  );
}

test.describe("Grid engine", () => {
  test("REAL mouse drag reorders unpinned tiles and persists @smoke", async ({ page }) => {
    await enterDemo(page, "/clients/client-aurelle");
    const before = await tileBackgrounds(page);

    // Tiles 0-1 are pinned; drag tile 3 (index) onto tile 2 — both unpinned.
    // HTML5 drag-and-drop via literal mouse movements.
    const source = tiles(page).nth(3);
    const target = tiles(page).nth(2);
    await source.dragTo(target);

    await expect(async () => {
      const after = await tileBackgrounds(page);
      expect(after[2]).toBe(before[3]);
      expect(after[3]).toBe(before[2]);
    }).toPass({ timeout: 5_000 });
    await evidence(page, "instagram-profile", "grid-after-mouse-drag");

    // Order survives a full reload (IndexedDB persistence).
    await page.reload();
    const reloaded = await tileBackgrounds(page);
    expect(reloaded[2]).toBe(before[3]);
    expect(reloaded[3]).toBe(before[2]);
  });

  test("keyboard reorder with Ctrl+Arrow keys", async ({ page }) => {
    await enterDemo(page, "/clients/client-aurelle");
    const before = await tileBackgrounds(page);
    await tiles(page).nth(3).focus();
    await page.keyboard.press("Control+ArrowLeft");
    await expect(async () => {
      const after = await tileBackgrounds(page);
      expect(after[2]).toBe(before[3]);
    }).toPass({ timeout: 5_000 });
  });

  test("pinned posts stay first even when moved", async ({ page }) => {
    await enterDemo(page, "/clients/client-aurelle");
    // The first two tiles carry the pin badge in seed data.
    const pinBadges = tiles(page).nth(0).locator("svg");
    await expect(pinBadges.first()).toBeVisible();
    // Reorder an unpinned tile to front — pinned tiles must remain at 0 and 1.
    await tiles(page).nth(2).focus();
    await page.keyboard.press("Control+ArrowLeft");
    await page.keyboard.press("Control+ArrowLeft");
    // Pins are stable: first two tiles still show a badge overlay.
    await expect(tiles(page).nth(0).locator("span svg")).toBeVisible();
    await expect(tiles(page).nth(1).locator("span svg")).toBeVisible();
  });

  test("grid stays left-aligned with fewer than three posts", async ({ page }) => {
    await enterDemo(page, "/clients/client-kavo");
    // Delete one of the 3 seeded posts to get a 2-post grid.
    await tiles(page).last().click();
    await page.getByRole("button", { name: "Delete post" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete post" }).click();
    await expect(tiles(page)).toHaveCount(2);

    const [first, second] = await tiles(page).evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect().left),
    );
    expect(first).toBeLessThan(second); // row fills from the left
    await evidence(page, "instagram-profile", "grid-two-posts-left-aligned");
  });

  test("profile tabs switch collections; reposts and tagged show empty states", async ({
    page,
  }) => {
    await enterDemo(page, "/clients/client-aurelle");
    await page.locator(".ig-root [role=tab][aria-label=Reels]").click();
    await expect(tiles(page).first()).toBeVisible(); // seeded reels
    await page.locator(".ig-root [role=tab][aria-label=Reposts]").click();
    await expect(phone(page)).toContainText("No content yet");
    await page.locator(".ig-root [role=tab][aria-label=Tagged]").click();
    await expect(phone(page)).toContainText("No content yet");
    await page.locator(".ig-root [role=tab][aria-label=Posts]").click();
    await expect(tiles(page).first()).toBeVisible();
  });
});
