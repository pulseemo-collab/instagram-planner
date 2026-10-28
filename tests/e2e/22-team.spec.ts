import { expect, test, type Page } from "@playwright/test";
import { enterDemo } from "./helpers";

/*
 * Team workspace in demo mode: the demo user is the owner; two seeded
 * sign-ups (Maya Lindqvist, Théo Marchand) wait for approval.
 */

/** Change the stored demo workspace's user, then reload (another tab's write). */
async function setStoredUser(
  page: Page,
  patch: { role?: "owner" | "member"; status?: "approved" | "suspended" },
): Promise<void> {
  await page.evaluate(
    (userPatch) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("gridline-studio", 1);
        open.onsuccess = () => {
          const db = open.result;
          const store = db.transaction("state", "readwrite").objectStore("state");
          const rq = store.get("workspace-v1");
          rq.onsuccess = () => {
            const state = rq.result;
            Object.assign(state.user, userPatch);
            const put = store.put(state, "workspace-v1");
            put.onsuccess = () => {
              db.close();
              resolve();
            };
            put.onerror = () => reject(put.error);
          };
          rq.onerror = () => reject(rq.error);
        };
        open.onerror = () => reject(open.error);
      }),
    patch,
  );
  await page.reload();
}

const pendingSection = (page: Page) => page.getByRole("region", { name: "Waiting for approval" });
const membersSection = (page: Page) => page.getByRole("region", { name: "Members" });
const suspendedSection = (page: Page) => page.getByRole("region", { name: "Suspended" });

test.describe("Team workspace", () => {
  test("the owner approves a pending account; it stays approved after reload", async ({ page }) => {
    await enterDemo(page, "/");
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Team" }).click();
    await expect(page).toHaveURL(/\/team$/);
    await expect(pendingSection(page)).toContainText("Maya Lindqvist");
    await expect(pendingSection(page)).toContainText("email not confirmed"); // Théo
    await expect(membersSection(page)).toContainText("Sam Rivera");

    await page.getByRole("button", { name: "Approve Maya Lindqvist" }).click();
    const dialog = page.getByRole("dialog", { name: "Approve Maya Lindqvist?" });
    await dialog.getByRole("button", { name: "Approve" }).click();
    await expect(page.locator("body")).toContainText("Maya Lindqvist can now use the workspace");
    await expect(membersSection(page)).toContainText("Maya Lindqvist");
    await expect(pendingSection(page)).not.toContainText("Maya Lindqvist");

    await page.reload();
    await expect(membersSection(page)).toContainText("Maya Lindqvist");
    await expect(pendingSection(page)).not.toContainText("Maya Lindqvist");
  });

  test("rejecting asks first, then deletes the account", async ({ page }) => {
    await enterDemo(page, "/team");
    await page.getByRole("button", { name: "Reject Théo Marchand" }).click();
    const dialog = page.getByRole("dialog", { name: "Reject Théo Marchand?" });
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(pendingSection(page)).toContainText("Théo Marchand");

    await page.getByRole("button", { name: "Reject Théo Marchand" }).click();
    await dialog.getByRole("button", { name: "Reject and delete account" }).click();
    await expect(page.locator("body")).toContainText("Théo Marchand's account was deleted");
    await expect(page.locator("main")).not.toContainText("Théo Marchand");

    await page.reload();
    await expect(pendingSection(page)).toContainText("Maya Lindqvist");
    await expect(page.locator("main")).not.toContainText("Théo Marchand");
  });

  test("suspend asks first, moves the member to Suspended; restore brings them back", async ({ page }) => {
    await enterDemo(page, "/team");
    // Never on the owner's own row.
    const ownerRow = membersSection(page).getByRole("listitem").filter({ hasText: "Owner" });
    await expect(ownerRow.getByRole("button")).toHaveCount(0);
    await expect(suspendedSection(page)).toHaveCount(0);

    await page.getByRole("button", { name: "Suspend Sam Rivera" }).click();
    const suspend = page.getByRole("dialog", { name: "Suspend Sam Rivera?" });
    await expect(suspend).toContainText("account is kept");
    await suspend.getByRole("button", { name: "Cancel" }).click();
    await expect(membersSection(page)).toContainText("Sam Rivera");

    await page.getByRole("button", { name: "Suspend Sam Rivera" }).click();
    await suspend.getByRole("button", { name: "Suspend" }).click();
    await expect(page.locator("body")).toContainText("Sam Rivera was suspended");
    await expect(suspendedSection(page)).toContainText("Sam Rivera");
    await expect(membersSection(page)).not.toContainText("Sam Rivera");

    await page.reload();
    await expect(suspendedSection(page)).toContainText("Sam Rivera");
    await page.getByRole("button", { name: "Restore Sam Rivera" }).click();
    await page.getByRole("dialog", { name: "Restore Sam Rivera?" }).getByRole("button", { name: "Restore access" }).click();
    await expect(page.locator("body")).toContainText("Sam Rivera can use the workspace again");
    await expect(membersSection(page)).toContainText("Sam Rivera");
    await expect(suspendedSection(page)).toHaveCount(0);
  });

  test("remove asks first, then deletes the member; their clients stay", async ({ page }) => {
    await enterDemo(page, "/team");
    await page.getByRole("button", { name: "Remove Sam Rivera" }).click();
    const dialog = page.getByRole("dialog", { name: "Remove Sam Rivera?" });
    await expect(dialog).toContainText("The clients they created move to you");
    await dialog.getByRole("button", { name: "Remove and delete account" }).click();
    await expect(page.locator("body")).toContainText("Sam Rivera was removed from the team");
    await expect(page.locator("main")).not.toContainText("Sam Rivera");

    await page.reload();
    await expect(page.locator("main")).not.toContainText("Sam Rivera");
    await page.goto("/clients");
    await expect(page.locator("main")).toContainText("Kavo");
  });

  test("a suspended account sees only the suspended screen", async ({ page }) => {
    await enterDemo(page, "/clients");
    await setStoredUser(page, { role: "member", status: "suspended" });
    await expect(page.getByRole("heading", { name: "Your access was suspended" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("Kavo");
  });

  test("approving resolves the sign-up notification", async ({ page }) => {
    await enterDemo(page, "/team");
    await page.getByRole("button", { name: "Approve Maya Lindqvist" }).click();
    await page.getByRole("dialog", { name: "Approve Maya Lindqvist?" }).getByRole("button", { name: "Approve" }).click();
    await expect(page.locator("body")).toContainText("Maya Lindqvist can now use the workspace");
    await page.reload();
    await page.getByRole("button", { name: /Notifications/ }).click();
    const panel = page.getByRole("dialog", { name: "Notifications" });
    await expect(panel).toBeVisible();
    await expect(panel).not.toContainText("Maya Lindqvist is waiting for approval");
  });

  test("a sign-up notification opens the Team page", async ({ page }) => {
    await enterDemo(page, "/");
    await page.getByRole("button", { name: /Notifications/ }).click();
    await page
      .getByRole("dialog", { name: "Notifications" })
      .getByRole("button", { name: /Maya Lindqvist is waiting for approval/ })
      .click();
    await expect(page).toHaveURL(/\/team$/);
  });

  test("a member has no Team page and can't delete clients", async ({ page }) => {
    await enterDemo(page, "/clients");
    await setStoredUser(page, { role: "member" });
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await expect(nav.getByRole("link", { name: "Clients" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Team" })).toHaveCount(0);

    await page.getByRole("button", { name: "Client actions" }).first().click();
    await expect(page.getByRole("button", { name: "Duplicate" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);

    await page.goto("/clients/client-kavo");
    await page.getByRole("button", { name: "More actions" }).click();
    await expect(page.getByRole("button", { name: "Duplicate client" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete client" })).toHaveCount(0);

    await page.goto("/team");
    await expect(page.getByText("Only the workspace owner can manage the team")).toBeVisible();
  });

  test("preview what a new account sees: the waiting screen, then sign out", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Preview what a new account sees" }).click();
    await expect(page.getByRole("heading", { name: "Your account is waiting for approval" })).toBeVisible();
    // No workspace at all: no navigation, no client data.
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);
    await page.goto("/clients/client-kavo");
    await expect(page.getByRole("heading", { name: "Your account is waiting for approval" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Kavo");

    await page.getByRole("button", { name: "Check again" }).click();
    await expect(page.getByRole("heading", { name: "Your account is waiting for approval" })).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);

    // The real demo workspace was never touched.
    await page.getByRole("button", { name: "Continue in demo mode" }).click();
    await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
    await page.goto("/clients");
    await expect(page.locator("main")).toContainText("Kavo");
  });
});
