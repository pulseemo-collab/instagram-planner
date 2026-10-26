import { expect, test, type Page } from "@playwright/test";
import { enterDemo, waitForDashboard } from "./helpers";

/*
 * Mutations that update the workspace snapshot locally (no full reload).
 * Each test performs the action, checks the UI, then reloads the page and
 * checks the UI shows exactly the same — the patch must match the truth.
 */

function bell(page: Page) {
  return page.getByRole("button", { name: /Notifications/ });
}

function panel(page: Page) {
  return page.getByRole("dialog", { name: "Notifications" });
}

/** Make this page's IndexedDB writes fail on demand (window.__failIdbWrites). */
async function installWriteFault(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __failIdbWrites?: boolean };
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
      if (w.__failIdbWrites) throw new DOMException("Simulated write failure", "UnknownError");
      return put.apply(this, args);
    };
  });
}

test.describe("Locally patched mutations", () => {
  test("mark one notification read: badge updates and matches after reload", async ({ page }) => {
    await enterDemo(page, "/");
    await expect(page.getByRole("button", { name: "Notifications, 2 unread" })).toBeVisible();

    await bell(page).click();
    await panel(page).getByRole("button", { name: /^Mark ".*" as read$/ }).first().click();
    await expect(page.getByRole("button", { name: "Notifications, 1 unread" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("button", { name: "Notifications, 1 unread" })).toBeVisible();
  });

  test("mark all read: badge clears and stays cleared after reload", async ({ page }) => {
    await enterDemo(page, "/");
    await bell(page).click();
    await panel(page).getByRole("button", { name: "Mark all as read" }).click();
    await expect(page.getByRole("button", { name: "Notifications", exact: true })).toBeVisible();
    // History is kept — the items are still listed.
    await expect(panel(page).getByRole("button", { name: /requested changes/ })).toHaveCount(2);

    await page.reload();
    await expect(page.getByRole("button", { name: "Notifications", exact: true })).toBeVisible();
  });

  test("create a share link: list and activity feed update and match after reload", async ({
    page,
  }) => {
    await enterDemo(page, "/clients/client-norr");
    await page.getByRole("button", { name: "Share", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Share preview" });
    await expect(dialog.locator("li")).toHaveCount(1);
    await dialog.getByRole("button", { name: "Create share link" }).click();
    await expect(page.locator("body")).toContainText("Share link created");
    await expect(dialog.locator("li")).toHaveCount(2);
    const token = (await dialog.locator("code").last().textContent())?.trim();

    await page.goto("/");
    await waitForDashboard(page);
    await expect(page.locator("#main-content")).toContainText("Preview link created for Studio Norr");
    await page.goto("/previews");
    await expect(page.locator("#main-content")).toContainText(token!.replace("/share/", ""));

    await page.reload();
    await expect(page.locator("#main-content")).toContainText(token!.replace("/share/", ""));
    await page.goto("/");
    await waitForDashboard(page);
    await expect(page.locator("#main-content")).toContainText("Preview link created for Studio Norr");
  });

  test("disable and regenerate a link: previews page updates and matches after reload", async ({
    page,
  }) => {
    await enterDemo(page, "/previews");
    const main = page.locator("#main-content");
    await expect(main).toContainText("demo-norr-ostermalm");

    // The Norr link's card (found by token, so only used before regenerating).
    const card = main.locator("div.rounded-xl").filter({ hasText: "/share/demo-norr-ostermalm" });
    await card.getByRole("button", { name: "Disable" }).click();
    await expect(page.locator("body")).toContainText("Link disabled");
    await expect(card.getByRole("button", { name: "Enable" })).toBeVisible();

    await card.getByRole("button", { name: "Regenerate token" }).click();
    await expect(page.locator("body")).toContainText("Token regenerated");
    await expect(main).not.toContainText("demo-norr-ostermalm");
    const texts = await main.innerText();

    await page.reload();
    await expect(main).not.toContainText("demo-norr-ostermalm");
    expect(await main.innerText()).toBe(texts);
  });

  test("rename yourself: greeting updates and matches after reload", async ({ page }) => {
    await enterDemo(page, "/settings");
    await page.getByLabel("Display name").fill("Morgan Lee");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.locator("body")).toContainText("Profile saved");

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Welcome back, Morgan" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Welcome back, Morgan" })).toBeVisible();
  });

  test("a failed patched mutation changes nothing and shows the error", async ({ page }) => {
    await installWriteFault(page);
    await enterDemo(page, "/");
    await expect(page.getByRole("button", { name: "Notifications, 2 unread" })).toBeVisible();

    await page.evaluate(() => {
      (window as unknown as { __failIdbWrites?: boolean }).__failIdbWrites = true;
    });
    await bell(page).click();
    await panel(page).getByRole("button", { name: "Mark all as read" }).click();
    await expect(page.locator("body")).toContainText("Couldn't save your changes");
    // Not patched: still 2 unread, and the panel still offers "Mark all".
    await expect(page.getByRole("button", { name: "Notifications, 2 unread" })).toBeVisible();
    await expect(panel(page).getByRole("button", { name: "Mark all as read" })).toBeEnabled();

    await page.evaluate(() => {
      (window as unknown as { __failIdbWrites?: boolean }).__failIdbWrites = false;
    });
    await page.reload();
    await expect(page.getByRole("button", { name: "Notifications, 2 unread" })).toBeVisible();
  });
});
