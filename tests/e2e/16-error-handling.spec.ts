import { expect, test, type Page } from "@playwright/test";
import { enterDemo, waitForDashboard } from "./helpers";

/**
 * Lets a test make this page's IndexedDB writes and/or reads fail on demand
 * (window.__failIdbWrites / window.__failIdbReads), to exercise error paths
 * in demo mode deterministically.
 */
async function installIdbFaults(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __failIdbWrites?: boolean; __failIdbReads?: boolean };
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
      if (w.__failIdbWrites) throw new DOMException("Simulated write failure", "UnknownError");
      return put.apply(this, args);
    };
    const get = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function (...args: Parameters<typeof get>) {
      if (w.__failIdbReads) throw new DOMException("Simulated read failure", "UnknownError");
      return get.apply(this, args);
    };
  });
}

function setFault(page: Page, kind: "__failIdbWrites" | "__failIdbReads", on: boolean) {
  return page.evaluate(([k, value]) => {
    (window as unknown as Record<string, boolean>)[k as string] = value as boolean;
  }, [kind, on] as const);
}

/** Replace (or delete, with null) the stored workspace record. */
function writeStoredState(page: Page, value: unknown) {
  return page.evaluate(
    (next) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("gridline-studio", 1);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("state", "readwrite");
          const store = tx.objectStore("state");
          if (next === null) store.delete("workspace-v1");
          else store.put(next, "workspace-v1");
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        open.onerror = () => reject(open.error);
      }),
    value,
  );
}

test.describe("Error handling", () => {
  test("a workspace that can't load shows an error with Retry instead of a skeleton", async ({
    page,
  }) => {
    await enterDemo(page, "/settings");
    await writeStoredState(page, { broken: true }); // not a workspace
    await page.reload();

    const main = page.locator("#main-content");
    await expect(main.getByRole("heading", { name: "Couldn't load your workspace" })).toBeVisible();
    await expect(main.getByRole("button", { name: "Retry" })).toBeVisible();

    // Once the cause is gone, Retry recovers without a page reload.
    await writeStoredState(page, null); // demo mode re-seeds an empty store
    await main.getByRole("button", { name: "Retry" }).click();
    await expect(main.getByRole("heading", { name: "Your profile" })).toBeVisible();
  });

  test("a failed save shows an error toast, no success message, and changes nothing", async ({
    page,
  }) => {
    await installIdbFaults(page);
    await enterDemo(page, "/previews");
    const disable = page.locator("#main-content").getByRole("button", { name: "Disable" }).first();
    await expect(disable).toBeVisible();

    await setFault(page, "__failIdbWrites", true);
    await disable.click();
    await expect(page.locator("body")).toContainText("Couldn't save your changes");
    await expect(page.locator("body")).not.toContainText("Link disabled");
    await expect(disable).toHaveText(/Disable/); // still active

    // The app keeps working once writes succeed again.
    await setFault(page, "__failIdbWrites", false);
    await disable.click();
    await expect(page.locator("body")).toContainText("Link disabled");
  });

  test("a failed background refresh keeps data visible with a notice and Retry", async ({
    page,
    context,
  }) => {
    await installIdbFaults(page);
    await enterDemo(page, "/");
    await waitForDashboard(page);

    // Reads fail in this tab; another tab's write makes it refresh.
    await setFault(page, "__failIdbReads", true);
    const other = await context.newPage();
    await enterDemo(other, "/settings");
    await other.getByLabel("Display name").fill("Changed elsewhere");
    await other.getByRole("button", { name: "Save profile" }).click();
    await expect(other.locator("body")).toContainText("Profile saved");
    await other.close();

    const notice = page.getByRole("status").filter({ hasText: "Couldn't refresh your workspace" });
    await expect(notice).toBeVisible();
    await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible(); // data still shown

    await setFault(page, "__failIdbReads", false);
    await notice.getByRole("button", { name: "Retry" }).click();
    await expect(notice).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Welcome back, Changed/ })).toBeVisible();
  });
});
