import { expect, test, type Page } from "@playwright/test";
import { enterDemoCalendar, gotoCalendarMonth } from "./helpers";

const dayCell = (page: Page) => page.locator(".grid.grid-cols-7 > div");
const contentCards = (page: Page) => page.locator('[role=group][aria-label^="Content package"]');

/** The stored demo workspace (IndexedDB "state" record), parsed. */
function storedState(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ posts: Array<{ id: string; stage: string; scheduledAt: string | null; scheduledDay?: string | null }> }>(
        (resolve, reject) => {
          const open = indexedDB.open("gridline-studio", 1);
          open.onsuccess = () => {
            const db = open.result;
            const rq = db.transaction("state", "readonly").objectStore("state").get("workspace-v1");
            rq.onsuccess = () => {
              resolve(rq.result);
              db.close();
            };
            rq.onerror = () => reject(rq.error);
          };
          open.onerror = () => reject(open.error);
        },
      ),
  );
}

test.describe("Timezone-free content days", () => {
  test("content placed in Auckland shows on the same day in Los Angeles", async ({ browser }) => {
    // Owner in Pacific/Auckland (UTC+12/+13) places content on 1 Aug 2026.
    const auckland = await browser.newContext({ timezoneId: "Pacific/Auckland" });
    const ownerPage = await auckland.newPage();
    await enterDemoCalendar(ownerPage, "client-aurelle");
    await contentCards(ownerPage).filter({ hasText: "Post 1" })
      .getByRole("button", { name: "Schedule", exact: true }).click();
    const dialog = ownerPage.getByRole("dialog", { name: /Schedule/ });
    await dialog.getByLabel("Date (DD/MM/YYYY)").fill("01/08/2026");
    await dialog.getByRole("button", { name: "Schedule" }).click();
    await expect(ownerPage.locator("body")).toContainText("Content placed");
    await gotoCalendarMonth(ownerPage, 2026, 8);
    await expect(
      dayCell(ownerPage).filter({ hasText: /^1(?!\d)/ }).first().locator("button", { hasText: "Post 1" }),
    ).toBeVisible();
    const state = await auckland.storageState({ indexedDB: true });
    await auckland.close();

    // Same data, viewed from America/Los_Angeles (19–20 hours behind).
    const losAngeles = await browser.newContext({ timezoneId: "America/Los_Angeles", storageState: state });
    const viewer = await losAngeles.newPage();
    await viewer.goto("/calendar");
    await expect(viewer.getByRole("heading", { name: "Content", exact: true })).toBeVisible();
    await gotoCalendarMonth(viewer, 2026, 8);
    await expect(
      dayCell(viewer).filter({ hasText: /^1(?!\d)/ }).first().locator("button", { hasText: "Post 1" }),
    ).toBeVisible();
    await losAngeles.close();
  });

  test("placing content stores a date, not a timestamp", async ({ page }) => {
    await enterDemoCalendar(page, "client-aurelle");
    await contentCards(page).filter({ hasText: "Post 2" })
      .getByRole("button", { name: "Schedule", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: /Schedule/ });
    await dialog.getByLabel("Date (DD/MM/YYYY)").fill("15/09/2026");
    await dialog.getByRole("button", { name: "Schedule" }).click();
    await expect(page.locator("body")).toContainText("Content placed");

    const post = (await storedState(page)).posts.find((p) => p.id === "content-a2")!;
    expect(post.scheduledDay).toBe("2026-09-15");
    expect(post.scheduledAt).toBeNull();
  });

  test("content saved by an older version (local-midnight timestamp) is repaired on load", async ({ page }) => {
    await enterDemoCalendar(page, "client-aurelle");
    // Old shape: no scheduledDay, the day stored as local midnight in scheduledAt.
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const open = indexedDB.open("gridline-studio", 1);
          open.onsuccess = () => {
            const db = open.result;
            const tx = db.transaction("state", "readwrite");
            const store = tx.objectStore("state");
            const get = store.get("workspace-v1");
            get.onsuccess = () => {
              const state = get.result as { posts: Array<Record<string, unknown>> };
              for (const post of state.posts) delete post.scheduledDay;
              const target = state.posts.find((p) => p.id === "content-a1")!;
              target.scheduledAt = new Date(2026, 7, 20, 0, 0).toISOString(); // 20 Aug, local midnight
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
    );

    await page.reload();
    await expect(page.getByRole("heading", { name: "Content", exact: true })).toBeVisible();
    const state = await storedState(page);
    const repaired = state.posts.find((p) => p.id === "content-a1")!;
    expect(repaired.scheduledDay).toBe("2026-08-20");
    expect(repaired.scheduledAt).toBeNull();
    expect(state.posts.every((p) => p.scheduledDay !== undefined)).toBe(true);

    await gotoCalendarMonth(page, 2026, 8);
    await expect(
      dayCell(page).filter({ hasText: /^20(?!\d)/ }).first().locator("button", { hasText: "Post 1" }),
    ).toBeVisible();
  });
});
