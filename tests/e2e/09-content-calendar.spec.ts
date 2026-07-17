import { expect, test } from "@playwright/test";
import { enterDemo, evidence } from "./helpers";

test.describe("Content page", () => {
  test("filters narrow results; combined filters and clear work", async ({ page }) => {
    await enterDemo(page, "/content");
    const cards = page.locator("ul li", { has: page.locator('a[href*="/posts/"]') });
    const total = await cards.count();
    expect(total).toBeGreaterThan(10);

    await page.getByLabel("Filter by client").selectOption({ label: "Kavo Coffee" });
    await expect
      .poll(async () => cards.count())
      .toBeLessThan(total);

    await page.getByLabel("Filter by type").selectOption("reel");
    await expect.poll(async () => cards.count()).toBe(1);

    await page.getByLabel("Filter by client").selectOption("all");
    await page.getByLabel("Filter by type").selectOption("all");
    await expect.poll(async () => cards.count()).toBe(total);

    await page.getByLabel("Search content").fill("travertine");
    await expect.poll(async () => cards.count()).toBe(2); // Norr carousel + material study
    await page.getByLabel("Search content").fill("zzz-no-match");
    await expect(page.getByText("No matches")).toBeVisible();
  });

  test("list view renders and per-row edit opens the composer", async ({ page }) => {
    await enterDemo(page, "/content");
    await page.getByRole("radio", { name: "List view" }).click();
    await expect(page.locator("table")).toBeVisible();
    await page.locator("table tbody tr").first().getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("dialog", { name: "Edit post" })).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  });

  test("bulk select + bulk approval change updates statuses @smoke", async ({ page }) => {
    await enterDemo(page, "/content");
    await page.getByLabel("Filter by client").selectOption({ label: "Kavo Coffee" });
    const checkboxes = page.locator('input[type="checkbox"]');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();
    await expect(page.getByText("2 selected")).toBeVisible();
    await page.getByRole("button", { name: "Mark approved" }).click();
    await expect(page.locator("body")).toContainText("2 posts updated");
    await expect(page.locator("li", { hasText: "Approved" }).first()).toBeVisible();
    await evidence(page, "content", "bulk-approved");
  });
});

test.describe("Calendar", () => {
  test("REAL mouse drag moves a post to another day and persists @smoke", async ({ page }) => {
    // Calendar chips are draggable <button> elements (BUG-005 fix), so the
    // same literal pointer drag that works for grid tiles applies here.
    await enterDemo(page, "/calendar");
    const chip = page
      .locator(".grid.grid-cols-7 button[draggable]", { hasText: "Studio" })
      .first();
    await expect(chip).toBeVisible();

    const emptyCell = page
      .locator(".grid.grid-cols-7 > div")
      .filter({ hasNot: page.locator("button") })
      .filter({ hasText: /^2[0-8]$/ })
      .first();
    const targetDay = (await emptyCell.textContent())?.trim();

    await chip.dragTo(emptyCell);

    await expect(async () => {
      const movedCell = page
        .locator(".grid.grid-cols-7 > div")
        .filter({ hasText: new RegExp(`^${targetDay}`) })
        .first();
      await expect(movedCell.locator("button", { hasText: "Studio" })).toBeVisible();
    }).toPass({ timeout: 6_000 });
    await expect(page.locator("body")).toContainText("Post rescheduled");
    await evidence(page, "calendar", "after-drag-reschedule");

    await page.reload();
    const movedCell = page
      .locator(".grid.grid-cols-7 > div")
      .filter({ hasText: new RegExp(`^${targetDay}`) })
      .first();
    await expect(movedCell.locator("button", { hasText: "Studio" })).toBeVisible();
  });

  test("month navigation and Today button", async ({ page }) => {
    await enterDemo(page, "/calendar");
    const heading = page.getByRole("heading", { level: 2 });
    const current = await heading.textContent();
    await page.getByRole("button", { name: "Next month" }).click();
    await expect(heading).not.toHaveText(current ?? "");
    await page.getByRole("button", { name: "Today" }).click();
    await expect(heading).toHaveText(current ?? "");
  });

  test("client filter hides other clients' chips; unscheduled tray lists drafts", async ({
    page,
  }) => {
    await enterDemo(page, "/calendar");
    await page.getByLabel("Filter by client").selectOption({ label: "Kavo Coffee" });
    await expect(page.locator(".grid.grid-cols-7 button[draggable]", { hasText: "Studio" })).toHaveCount(0);
    await expect(page.locator("body")).toContainText("Unscheduled drafts");
    await expect(page.locator("section button[draggable]", { hasText: "Kavo" }).first()).toBeVisible();
  });

  test("no UTC day-shift: scheduled time renders on the local calendar day", async ({ page }) => {
    await enterDemo(page, "/clients/client-aurelle/posts/post-a4");
    await page.getByRole("button", { name: "Edit post" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit post" });
    await dialog.getByRole("switch", { name: "Schedule" }).click();
    // Local midnight is where UTC conversion bugs shift a day.
    await dialog.getByLabel("Date").fill("2026-08-01");
    await dialog.getByLabel("Time").fill("00:15");
    await dialog.getByRole("button", { name: "Save post" }).click();
    await expect(page.locator("body")).toContainText("Post updated");

    await page.goto("/calendar");
    await page.getByRole("button", { name: "Next month" }).click(); // August 2026
    const day1 = page
      .locator(".grid.grid-cols-7 > div")
      .filter({ hasText: /^1(?!\d)/ })
      .first();
    await expect(day1.locator("button", { hasText: "Maison" })).toBeVisible();
  });
});
