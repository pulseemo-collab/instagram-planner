import { expect, test, type Page } from "@playwright/test";
import { enterDemo, evidence } from "./helpers";

/*
 * Shared previews page in demo mode. Seed: Maison Aurelle and Studio Norr
 * have one active link each; Kavo Coffee has one disabled link.
 */

const section = (page: Page, client: string) => page.getByRole("region", { name: client });
const visibleCards = (scope: Page | ReturnType<typeof section>) =>
  scope.getByTestId("share-link-card").filter({ visible: true });

test.describe("Shared previews: grouping, archive, filters, delete", () => {
  test("links are grouped by client; disabled ones sit in a collapsed archive", async ({ page }) => {
    await enterDemo(page, "/previews");
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      "Kavo Coffee",
      "Maison Aurelle",
      "Studio Norr",
    ]);
    await expect(visibleCards(section(page, "Maison Aurelle"))).toHaveCount(1);

    const kavo = section(page, "Kavo Coffee");
    await expect(kavo).toContainText("No active links.");
    await expect(visibleCards(kavo)).toHaveCount(0);
    await kavo.getByText("Archive (1)").click();
    await expect(visibleCards(kavo)).toHaveCount(1);
    await expect(visibleCards(kavo).first()).toContainText("Disabled");
    await evidence(page, "sharing", "previews-grouped");

    // Disabling a link moves it to that client's archive.
    const aurelle = section(page, "Maison Aurelle");
    await aurelle.getByRole("button", { name: "Disable" }).click();
    await expect(page.locator("body")).toContainText("Link disabled");
    await expect(aurelle).toContainText("Archive (1)");
    await expect(visibleCards(aurelle)).toHaveCount(0);
  });

  test("client and status filters", async ({ page }) => {
    await enterDemo(page, "/previews");
    await page.getByLabel("Filter by status").selectOption("disabled");
    // A status filter shows matching links directly (no archive).
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(["Kavo Coffee"]);
    await expect(visibleCards(page)).toHaveCount(1);

    await page.getByLabel("Filter by status").selectOption("expired");
    await expect(page.getByText("No links match these filters.")).toBeVisible();

    await page.getByRole("button", { name: "Clear filters" }).click();
    await page.getByLabel("Filter by client").selectOption({ label: "Studio Norr" });
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(["Studio Norr"]);
    await page.getByLabel("Filter by status").selectOption("active");
    await expect(visibleCards(page)).toHaveCount(1);
  });

  test("Delete link asks first, removes it, and its URL stops working", async ({ page }) => {
    await enterDemo(page, "/previews");
    const norr = section(page, "Studio Norr");
    await norr.getByRole("button", { name: "Delete link" }).click();
    const dialog = page.getByRole("dialog", { name: "Delete this link?" });
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(visibleCards(norr)).toHaveCount(1);

    await norr.getByRole("button", { name: "Delete link" }).click();
    await dialog.getByRole("button", { name: "Delete link" }).click();
    await expect(page.locator("body")).toContainText("Link deleted");
    await expect(section(page, "Studio Norr")).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole("heading", { name: "Maison Aurelle" })).toBeVisible();
    await expect(section(page, "Studio Norr")).toHaveCount(0);

    await page.goto("/share/demo-norr-ostermalm");
    await expect(page.getByText("Preview not found")).toBeVisible();
  });
});
