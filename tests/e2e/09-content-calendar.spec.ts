import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import { enterDemo, enterDemoCalendar, evidence, gotoCalendarMonth, paths, phone } from "./helpers";

test.describe("Content page", () => {
  test("filters narrow results; combined filters and clear work", async ({ page }) => {
    await enterDemo(page, "/content");
    const cards = page.locator("ul li", { has: page.locator('a[href*="/posts/"]') });
    const total = await cards.count();
    expect(total).toBeGreaterThan(10);

    await page.getByLabel("Filter by client").selectOption({ label: "Kavo Coffee" });
    await expect.poll(async () => cards.count()).toBeLessThan(total);

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

/* ------------------------------------------------------------------------- */
/* Calendar — designer content packages become scheduler-created posts       */
/* ------------------------------------------------------------------------- */

const dayCell = (page: Page) => page.locator(".grid.grid-cols-7 > div");
const chips = (page: Page) => page.locator(".grid.grid-cols-7 button[draggable]");
const contentCards = (page: Page) =>
  page.locator('[role=group][aria-label^="Content package"]');

async function addContent(page: Page, name: string, files: string[]): Promise<void> {
  await page.getByRole("button", { name: "Add content" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add content" });
  await dialog.getByLabel("Content name").fill(name);
  await dialog.locator('input[type="file"]').first().setInputFiles(files.map(paths.asset));
  await dialog.getByRole("button", { name: "Add content" }).click();
  await expect(page.locator("body")).toContainText("Content added");
}

test.describe("Calendar workspace", () => {
  test("requires one selected client; no All-clients option @smoke", async ({ page }) => {
    await enterDemo(page, "/calendar");
    await expect(page.getByRole("heading", { name: "Choose a client" })).toBeVisible();
    await expect(page.locator(".grid.grid-cols-7")).toHaveCount(0);
    await expect(page.getByText("All clients")).toHaveCount(0);
    await evidence(page, "calendar", "client-selection-state");

    await page.getByRole("button", { name: /Maison Aurelle/ }).click();
    await expect(page.getByRole("heading", { name: "Content", exact: true })).toBeVisible();
    await expect(page.getByLabel("Switch client")).toHaveValue("client-aurelle");
    await expect(page.getByText("All clients")).toHaveCount(0);
    // Seeded designer packages for Aurelle.
    await expect(contentCards(page)).toHaveCount(2);

    await page.reload();
    await expect(page.getByRole("heading", { name: "Content", exact: true })).toBeVisible();
    await expect(page.getByLabel("Switch client")).toHaveValue("client-aurelle");
  });

  test("Add content dialog is minimal: name + media only @smoke", async ({ page }) => {
    await enterDemoCalendar(page, "client-kavo");
    await page.getByRole("button", { name: "Add content" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Add content" });

    // Exactly the designer fields — nothing else. Two pickers: files + folder.
    await expect(dialog.getByLabel("Content name")).toBeVisible();
    await expect(dialog.locator('input[type="file"]')).toHaveCount(2);
    await expect(dialog.getByLabel("Choose files")).toHaveCount(1);
    await expect(dialog.getByLabel("Choose folder")).toHaveCount(1);
    for (const absent of [
      "Caption",
      "Hashtags",
      "Location",
      "Alt text",
      "Post type",
      "Approval status",
    ]) {
      await expect(dialog.getByLabel(absent)).toHaveCount(0);
    }
    await expect(dialog.getByRole("switch")).toHaveCount(0);

    // Name is required.
    await dialog.locator('input[type="file"]').first().setInputFiles(paths.asset("photo-1.png"));
    await dialog.getByRole("button", { name: "Add content" }).click();
    await expect(dialog.getByText(/Give the content a name/)).toBeVisible();

    await dialog.getByLabel("Content name").fill("Post 1");
    await dialog.getByRole("button", { name: "Add content" }).click();
    await expect(page.locator("body")).toContainText("Content added");

    const card = contentCards(page).filter({ hasText: "Post 1" });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText("1 file");
    await expect(card).toContainText("Unscheduled");
  });

  test("multiple original files stay one content package @smoke", async ({ page }) => {
    await enterDemoCalendar(page, "client-kavo");
    await addContent(page, "Summer campaign 01", ["photo-1.png", "photo-2.png", "photo-3.png"]);

    const card = contentCards(page).filter({ hasText: "Summer campaign 01" });
    await expect(card).toHaveCount(1); // ONE package, not three
    await expect(card).toContainText("3 files");
    await evidence(page, "calendar", "package-card-multifile");
  });

  test("content packages never appear on the Instagram grid or content page", async ({
    page,
  }) => {
    await enterDemoCalendar(page, "client-aurelle");
    await expect(contentCards(page)).toHaveCount(2); // Post 1, Post 2 seeds
    // Workspace grid shows only completed posts (8 for Aurelle).
    await page.goto("/clients/client-aurelle");
    await expect(page.locator(".ig-root .grid.grid-cols-3 > button")).toHaveCount(8);
    // Content page lists posts only.
    await page.goto("/content");
    await page.getByLabel("Search content").fill("Post 1");
    await expect(page.getByText("No matches")).toBeVisible();
  });

  test("ORIGINAL MEDIA RULE: stored bytes are identical to the uploaded file", async ({
    page,
  }) => {
    await enterDemoCalendar(page, "client-kavo");
    await addContent(page, "Integrity check", ["photo-1.png"]);
    await contentCards(page)
      .filter({ hasText: "Integrity check" })
      .getByRole("button", { name: /Open/ })
      .click();
    await expect(page).toHaveURL(/\/posts\//);

    const src = await page.locator(".ig-root img").first().getAttribute("src");
    expect(src).toMatch(/^data:image\/png;base64,/);
    const storedBase64 = src!.split(",")[1];
    const originalBase64 = fs.readFileSync(paths.asset("photo-1.png")).toString("base64");
    expect(storedBase64).toBe(originalBase64);
  });

  test("FULL WORKFLOW: drag content to a day, create the post, reopen as edit @smoke", async ({
    page,
  }) => {
    await enterDemoCalendar(page, "client-kavo");
    await addContent(page, "Post 1", ["photo-1.png", "photo-2.png"]);
    const card = contentCards(page).filter({ hasText: "Post 1" });

    // Scheduler drags the package onto a day — date attaches, still not a post.
    const emptyCell = dayCell(page)
      .filter({ hasNot: page.locator("button") })
      .filter({ hasText: /^1[0-4]$/ })
      .first();
    const targetDay = (await emptyCell.textContent())?.trim();
    await card.dragTo(emptyCell);
    await expect(page.locator("body")).toContainText("Content placed");
    await expect(card).toContainText(/Scheduled · \d{2}\/\d{2}\/\d{4}/); // DD/MM/YYYY

    const placedChip = dayCell(page)
      .filter({ hasText: new RegExp(`^${targetDay}`) })
      .first()
      .locator("button", { hasText: "Post 1" });
    await expect(placedChip).toBeVisible();

    // Opening it for the FIRST time shows "Create post" — not "Edit post".
    await placedChip.click();
    await expect(page).toHaveURL(/from=calendar/);
    await expect(page.getByRole("heading", { name: "Create post" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Edit post" })).toHaveCount(0);
    // Back button points to the calendar, not the client.
    await expect(page.locator("#main-content").getByRole("link", { name: "Calendar" })).toBeVisible();

    const editor = page.locator('section[aria-label="Create post"]');
    // Date came from the drop (DD/MM/YYYY) — the time is deliberately empty.
    const dateValue = await editor.getByLabel("Date (DD/MM/YYYY)").inputValue();
    expect(dateValue).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    await expect(editor.getByLabel("Time")).toHaveValue("");

    // Time is required to create the post.
    await editor.getByRole("button", { name: "Create post" }).click();
    await expect(editor.getByText("Choose a publishing time.")).toBeVisible();

    await editor.getByLabel("Caption").fill("Created from content: fresh drop");
    await editor.getByLabel("Time").fill("09:30");
    await editor.getByRole("button", { name: "Create post" }).click();
    await expect(page.locator("body")).toContainText("Post created");

    // The same screen now behaves as a normal editable post.
    await expect(page.getByRole("heading", { name: "Edit post" })).toBeVisible();
    await expect(
      page
        .locator('section[aria-label="Edit post"]')
        .getByRole("button", { name: "Save changes" }),
    ).toBeVisible();
    await evidence(page, "calendar", "create-post-from-content");

    // Back to the calendar with client preserved; chip shows the chosen time.
    await page.locator("#main-content").getByRole("link", { name: "Calendar" }).click();
    await expect(page).toHaveURL(/\/calendar$/);
    await expect(page.getByLabel("Switch client")).toHaveValue("client-kavo");
    await expect(
      dayCell(page)
        .filter({ hasText: new RegExp(`^${targetDay}`) })
        .first()
        .locator("button", { hasText: "Post 1" }),
    ).toBeVisible();

    // Reopen — still "Edit post"; caption persists after a full reload.
    await page.reload();
    await dayCell(page)
      .filter({ hasText: new RegExp(`^${targetDay}`) })
      .first()
      .locator("button", { hasText: "Post 1" })
      .click();
    await expect(page.getByRole("heading", { name: "Edit post" })).toBeVisible();
    await expect(page.locator(".ig-root").last()).toContainText("Created from content");
  });

  test("back navigation stays contextual: from calendar vs from client workspace", async ({
    page,
  }) => {
    // From the calendar → "Calendar".
    await enterDemoCalendar(page, "client-aurelle");
    await chips(page).filter({ hasText: "Héritage signet" }).first().click();
    await expect(page.locator("#main-content").getByRole("link", { name: "Calendar" })).toBeVisible();
    await expect(page.locator("#main-content").getByRole("link", { name: "Maison Aurelle" })).toHaveCount(0);

    // From the client workspace grid → client name (existing navigation).
    await enterDemo(page, "/clients/client-aurelle");
    await page.locator(".ig-root .grid.grid-cols-3 > button").first().click();
    await expect(page.locator("#main-content").getByRole("link", { name: "Maison Aurelle" })).toBeVisible();
    await expect(page.locator("#main-content").getByRole("link", { name: "Calendar" })).toHaveCount(0);
  });

  test("month is preserved when returning from a post", async ({ page }) => {
    await enterDemoCalendar(page, "client-aurelle");
    await page.getByRole("button", { name: "Next month" }).click();
    const monthLabel = await page.getByRole("heading", { level: 2 }).textContent();
    await contentCards(page).first().getByRole("button", { name: /Open/ }).click();
    await page.locator("#main-content").getByRole("link", { name: "Calendar" }).click();
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(monthLabel ?? "");
  });

  test("content chips move between days and unschedule by dropping on Content", async ({
    page,
  }) => {
    await enterDemoCalendar(page, "client-kavo");
    await addContent(page, "Mover", ["photo-1.png"]);
    const card = contentCards(page).filter({ hasText: "Mover" });

    const firstCell = dayCell(page)
      .filter({ hasNot: page.locator("button") })
      .filter({ hasText: /^1[0-4]$/ })
      .first();
    await card.dragTo(firstCell);
    await expect(page.locator("body")).toContainText("Content placed");

    const secondCell = dayCell(page)
      .filter({ hasNot: page.locator("button") })
      .filter({ hasText: /^2[0-6]$/ })
      .first();
    const secondDay = (await secondCell.textContent())?.trim();
    await chips(page).filter({ hasText: "Mover" }).first().dragTo(secondCell);
    await expect(
      dayCell(page)
        .filter({ hasText: new RegExp(`^${secondDay}`) })
        .first()
        .locator("button", { hasText: "Mover" }),
    ).toBeVisible();

    await chips(page)
      .filter({ hasText: "Mover" })
      .first()
      .dragTo(page.getByRole("heading", { name: "Content", exact: true }));
    await expect(page.locator("body")).toContainText("Content returned to Unscheduled");
    await expect(chips(page).filter({ hasText: "Mover" })).toHaveCount(0);
    await expect(card).toContainText("Unscheduled");

    await page.reload();
    await expect(contentCards(page).filter({ hasText: "Mover" })).toContainText("Unscheduled");
  });

  test("multiple items stack on the same date via the DD/MM/YYYY dialog @smoke", async ({
    page,
  }) => {
    await enterDemoCalendar(page, "client-kavo");
    await addContent(page, "Stack A", ["photo-1.png"]);
    await addContent(page, "Stack B", ["photo-2.png"]);

    const now = new Date();
    const numeric = `15/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
    for (const name of ["Stack A", "Stack B"]) {
      await contentCards(page)
        .filter({ hasText: name })
        .getByRole("button", { name: "Schedule", exact: true })
        .click();
      const dialog = page.getByRole("dialog", { name: /Schedule/ });
      await dialog.getByLabel("Date (DD/MM/YYYY)").fill(numeric);
      await dialog.getByRole("button", { name: "Schedule" }).click();
      await expect(page.locator("body")).toContainText("Content placed");
    }

    const cell = dayCell(page).filter({ hasText: /^15/ }).first();
    await expect(cell.locator("button", { hasText: "Stack A" })).toBeVisible();
    await expect(cell.locator("button", { hasText: "Stack B" })).toBeVisible();
    await evidence(page, "calendar", "two-posts-same-day");
  });

  test("Content filters: All / Unscheduled / Scheduled; placed content stays listed", async ({
    page,
  }) => {
    await enterDemoCalendar(page, "client-aurelle");
    await expect(contentCards(page)).toHaveCount(2); // seeded Post 1 + Post 2

    await contentCards(page)
      .filter({ hasText: "Post 1" })
      .getByRole("button", { name: "Schedule", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: /Schedule/ });
    await dialog.getByRole("button", { name: "Schedule" }).click();
    await expect(page.locator("body")).toContainText("Content placed");

    await page.getByRole("radio", { name: "Scheduled", exact: true }).click();
    await expect.poll(() => contentCards(page).count()).toBe(1);
    await expect(contentCards(page).first()).toContainText(/Scheduled · \d{2}\/\d{2}\/\d{4}/);

    await page.getByRole("radio", { name: "Unscheduled" }).click();
    await expect.poll(() => contentCards(page).count()).toBe(1);

    await page.getByRole("radio", { name: "All" }).click();
    await expect.poll(() => contentCards(page).count()).toBe(2);
  });

  test("FOLDER IMPORT: recursive, hidden/system and unsupported files skipped @smoke", async ({
    page,
  }) => {
    await enterDemoCalendar(page, "client-kavo");
    await page.getByRole("button", { name: "Add content" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Add content" });

    // campaign-folder: 01-cover.png + 02-detail.jpg + nested/03-extra.png
    // + notes.txt (unsupported) + .DS_Store/Thumbs.db/desktop.ini (system).
    await dialog.getByLabel("Choose folder").setInputFiles(paths.asset("campaign-folder"));
    await expect(dialog.getByRole("status")).toHaveText(
      "3 files added, 1 unsupported file skipped.",
    );
    await expect(dialog.getByText("01-cover.png")).toBeVisible();
    await expect(dialog.getByText("03-extra.png")).toBeVisible(); // nested subfolder
    for (const skipped of ["notes.txt", ".DS_Store", "Thumbs.db", "desktop.ini"]) {
      await expect(dialog.getByText(skipped)).toHaveCount(0);
    }

    // Everything lands in ONE content package.
    await dialog.getByLabel("Content name").fill("Folder shoot");
    await dialog.getByRole("button", { name: "Add content" }).click();
    await expect(page.locator("body")).toContainText("Content added");
    const card = contentCards(page).filter({ hasText: "Folder shoot" });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText("3 files");
    await evidence(page, "calendar", "folder-import");
  });

  test("FOLDER IMPORT: exact duplicates are skipped on re-import", async ({ page }) => {
    await enterDemoCalendar(page, "client-kavo");
    await page.getByRole("button", { name: "Add content" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Add content" });

    await dialog.getByLabel("Choose folder").setInputFiles(paths.asset("campaign-folder"));
    await expect(dialog.getByRole("status")).toHaveText(
      "3 files added, 1 unsupported file skipped.",
    );
    // Same folder again — nothing new gets in.
    await dialog.getByLabel("Choose folder").setInputFiles(paths.asset("campaign-folder"));
    await expect(dialog.getByRole("status")).toHaveText(
      "0 files added, 1 unsupported file skipped, 3 duplicates skipped.",
    );
    // A duplicate via the plain file picker is skipped too.
    await dialog.getByLabel("Choose files").setInputFiles(
      paths.asset("campaign-folder/01-cover.png"),
    );
    await expect(dialog.getByRole("status")).toHaveText("0 files added, 1 duplicate skipped.");

    await dialog.getByLabel("Content name").fill("Dedupe check");
    await dialog.getByRole("button", { name: "Add content" }).click();
    await expect(page.locator("body")).toContainText("Content added");
    await expect(contentCards(page).filter({ hasText: "Dedupe check" })).toContainText("3 files");
  });

  test("FOLDER IMPORT: folder without supported media shows a clear error", async ({ page }) => {
    await enterDemoCalendar(page, "client-kavo");
    await page.getByRole("button", { name: "Add content" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Add content" });

    await dialog.getByLabel("Choose folder").setInputFiles(paths.asset("unsupported-folder"));
    await expect(dialog.getByRole("status")).toHaveText(
      "No supported files found in that folder.",
    );
    await dialog.getByLabel("Content name").fill("Empty import");
    await dialog.getByRole("button", { name: "Add content" }).click();
    await expect(dialog.getByText("Upload at least one photo or video.")).toBeVisible();
  });

  test("FOLDER IMPORT: deterministic order + original bytes; reorder controls survive", async ({
    page,
  }) => {
    await enterDemoCalendar(page, "client-kavo");
    await page.getByRole("button", { name: "Add content" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Add content" });
    await dialog.getByLabel("Choose folder").setInputFiles(paths.asset("campaign-folder"));
    await expect(dialog.getByRole("status")).toHaveText(
      "3 files added, 1 unsupported file skipped.",
    );
    await dialog.getByLabel("Content name").fill("Ordered shoot");
    await dialog.getByRole("button", { name: "Add content" }).click();
    await expect(page.locator("body")).toContainText("Content added");

    await contentCards(page)
      .filter({ hasText: "Ordered shoot" })
      .getByRole("button", { name: /Open/ })
      .click();
    await expect(page).toHaveURL(/\/posts\//);

    // Slide 1 = relative-path order (01-cover.png) with byte-identical content.
    await expect(phone(page)).toContainText("1/3");
    const src = await page.locator(".ig-root img").first().getAttribute("src");
    expect(src).toMatch(/^data:image\/png;base64,/);
    expect(src!.split(",")[1]).toBe(
      fs.readFileSync(paths.asset("campaign-folder/01-cover.png")).toString("base64"),
    );

    // The existing manual media reorder controls are still there.
    const editor = page.locator('section[aria-label="Create post"]');
    await expect(editor.getByRole("button", { name: "Move slide 2 left" })).toBeVisible();
  });

  test("editing date/time inline (DD/MM/YYYY) updates the calendar without UTC shift", async ({
    page,
  }) => {
    await enterDemo(page, "/clients/client-aurelle/posts/post-a4");
    const editor = page.locator('section[aria-label="Edit post"]');
    await editor.getByRole("switch", { name: "Schedule" }).click();
    // Local midnight is where UTC conversion bugs shift a day.
    await editor.getByLabel("Date (DD/MM/YYYY)").fill("01/08/2026");
    await editor.getByLabel("Time").fill("00:15");
    await editor.getByRole("button", { name: "Save changes" }).click();
    await expect(page.locator("body")).toContainText("Post updated");

    await enterDemoCalendar(page, "client-aurelle");
    await gotoCalendarMonth(page, 2026, 8);
    const day1 = dayCell(page).filter({ hasText: /^1(?!\d)/ }).first();
    await expect(day1.locator("button", { hasText: "Summer lookbook" })).toBeVisible();
  });
});
