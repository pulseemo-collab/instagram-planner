import { expect, test } from "@playwright/test";
import { enterDemo, evidence } from "./helpers";

test.describe("Shared previews page", () => {
  test("lists links with status, counts, and working actions", async ({ page }) => {
    await enterDemo(page, "/previews");
    // Seed: 2 active links shown directly; the disabled one is in Kavo's archive.
    const cards = page.getByTestId("share-link-card");
    await expect(cards.filter({ visible: true })).toHaveCount(2);
    await expect(cards.filter({ visible: true }).filter({ hasText: "Active" })).toHaveCount(2);
    await expect(page.locator("body")).toContainText(/\d+ comments?/);
    await expect(page.locator("body")).toContainText(/\d+\/\d+ approved/);
    await evidence(page, "sharing", "previews-page");

    const aurelle = page.getByRole("region", { name: "Maison Aurelle" });
    await aurelle.getByRole("button", { name: "Disable" }).click();
    await expect(page.locator("body")).toContainText("Link disabled");
    await expect(cards.filter({ visible: true })).toHaveCount(1);

    // Regenerate a token.
    await page.getByRole("button", { name: "Regenerate token" }).first().click();
    await expect(page.locator("body")).toContainText("Token regenerated");
  });
});

test.describe("Settings", () => {
  test("display name saves and shows across the app @smoke", async ({ page }) => {
    await enterDemo(page, "/settings");
    await page.getByLabel("Display name").fill("QA Auditor");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.locator("body")).toContainText("Profile saved");
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Welcome back, QA" })).toBeVisible();
  });

  test("mode indicator, timezone, and preference selects render", async ({ page }) => {
    await enterDemo(page, "/settings");
    await expect(page.locator("body")).toContainText("demo mode");
    await expect(page.locator("body")).toContainText("Timezone:");
    await expect(page.getByLabel("Default preview theme")).toBeVisible();
    await expect(page.getByLabel("Default approval flow")).toBeVisible();
    await evidence(page, "settings", "settings-page");
  });

  test("delete all data empties the workspace; restore brings the seed back", async ({ page }) => {
    await enterDemo(page, "/settings");
    await page.getByRole("button", { name: "Delete all data" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete everything" }).click();
    await expect(page.locator("body")).toContainText("All data cleared");

    await page.goto("/clients");
    await expect(page.getByText("No clients yet")).toBeVisible();
    await evidence(page, "clients", "clients-empty-state");
    await page.goto("/");
    await expect(page.locator("body")).toContainText("No clients yet");

    await page.goto("/settings");
    await page.getByRole("button", { name: "Restore demo data" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Restore demo data" }).click();
    await expect(page.locator("body")).toContainText("Demo data restored");
    await page.goto("/clients");
    await expect(page.getByRole("link", { name: /Maison Aurelle/ })).toBeVisible();
  });
});
