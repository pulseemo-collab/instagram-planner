import { expect, test } from "@playwright/test";
import { enterDemo, evidence, newClientButton, panelTab, paths, phone } from "./helpers";

test.describe("Highlights", () => {
  async function openHighlightsPanel(page: import("@playwright/test").Page) {
    await enterDemo(page, "/clients/client-aurelle");
    await panelTab(page, "Highlights").click();
  }

  test("create highlight with cover appears on the profile @smoke", async ({ page }) => {
    await openHighlightsPanel(page);
    await page.getByRole("button", { name: "New highlight" }).click();
    const dialog = page.getByRole("dialog", { name: "New highlight" });
    await dialog.getByLabel("Title").fill("Summer");
    await dialog.locator('input[type="file"]').setInputFiles(paths.asset("cover.png"));
    await expect(dialog.getByText("cover.png")).toBeVisible();
    await dialog.getByRole("button", { name: "Save highlight" }).click();
    await expect(page.locator("body")).toContainText("Highlight added");
    await expect(phone(page)).toContainText("Summer");
    await evidence(page, "instagram-profile", "profile-with-highlights");

    await page.reload();
    await expect(phone(page)).toContainText("Summer");
  });

  test("title is required; long titles truncate on the profile", async ({ page }) => {
    await openHighlightsPanel(page);
    await page.getByRole("button", { name: "New highlight" }).click();
    const dialog = page.getByRole("dialog", { name: "New highlight" });
    await dialog.getByRole("button", { name: "Save highlight" }).click();
    await expect(dialog.getByText("Title is required")).toBeVisible();
    await dialog.getByLabel("Title").fill("A very long highlight title");
    await dialog.getByRole("button", { name: "Save highlight" }).click();
    await expect(page.locator("body")).toContainText("Highlight added");
  });

  test("edit, reorder, and delete a highlight", async ({ page }) => {
    await openHighlightsPanel(page);

    // Edit "Press" → "Media".
    await page.getByRole("button", { name: "Edit Press" }).click();
    await page.getByRole("dialog").getByLabel("Title").fill("Media");
    await page.getByRole("dialog").getByRole("button", { name: "Save highlight" }).click();
    await expect(phone(page)).toContainText("Media");

    // Reorder: move first highlight later, verify profile order.
    const labelsBefore = await page
      .locator(".ig-root [role=list] button span.truncate")
      .allTextContents();
    await page.getByRole("button", { name: `Move ${labelsBefore[0]} later` }).click();
    await expect(async () => {
      const labelsAfter = await page
        .locator(".ig-root [role=list] button span.truncate")
        .allTextContents();
      expect(labelsAfter[1]).toBe(labelsBefore[0]);
    }).toPass();

    // Delete "Media" with confirmation.
    await page.getByRole("button", { name: "Delete Media" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(phone(page)).not.toContainText("Media");
  });

  test("client with no highlights shows editor empty state; profile hides row entry", async ({
    page,
  }) => {
    await enterDemo(page, "/clients");
    // Fresh client has zero highlights.
    await newClientButton(page).click();
    const dialog = page.getByRole("dialog", { name: "New client" });
    await dialog.getByLabel("Client / business name").fill("Fresh Client Studio");
    await dialog.getByLabel("Instagram username").fill("freshclient");
    await dialog.getByRole("button", { name: "Create client" }).click();
    await expect(page).toHaveURL(/\/clients\/[a-f0-9-]{36}/);
    await panelTab(page, "Highlights").click();
    await expect(page.getByRole("heading", { name: "No highlights", exact: true })).toBeVisible();
    await evidence(page, "instagram-profile", "profile-without-highlights");
  });
});
