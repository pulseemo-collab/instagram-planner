import { expect, test } from "@playwright/test";
import { enterDemo, evidence, newClientButton, paths, phone } from "./helpers";

test.describe("Client management", () => {
  test("create client with avatar navigates to new workspace @smoke", async ({ page }) => {
    await enterDemo(page, "/clients");
    await newClientButton(page).click();
    const dialog = page.getByRole("dialog", { name: "New client" });
    await dialog.getByLabel("Client / business name").fill("Test Studio One");
    await dialog.getByLabel("Instagram username").fill("test.studio.one");
    await dialog.locator('input[type="file"]').setInputFiles(paths.asset("avatar.png"));
    await expect(dialog.getByText("avatar.png")).toBeVisible();
    await dialog.getByRole("button", { name: "Create client" }).click();

    await expect(page).toHaveURL(/\/clients\/[a-f0-9-]{36}/, { timeout: 15_000 });
    await expect(phone(page)).toContainText("test.studio.one");
    await evidence(page, "clients", "created-client-workspace");
  });

  test("create validates required fields and username format", async ({ page }) => {
    await enterDemo(page, "/clients");
    await newClientButton(page).click();
    const dialog = page.getByRole("dialog", { name: "New client" });
    await dialog.getByRole("button", { name: "Create client" }).click();
    await expect(dialog.getByText("Client name is required")).toBeVisible();
    await expect(dialog.getByText("Instagram username is required")).toBeVisible();

    await dialog.getByLabel("Client / business name").fill("Bad Username Co");
    await dialog.getByLabel("Instagram username").fill("has spaces!!");
    await dialog.getByRole("button", { name: "Create client" }).click();
    await expect(dialog.getByText(/Letters, numbers, dots and underscores/)).toBeVisible();
  });

  test("two clients keep independent data", async ({ page }) => {
    await enterDemo(page, "/clients");

    for (const name of ["Indep One", "Indep Two"]) {
      await newClientButton(page).click();
      const dialog = page.getByRole("dialog", { name: "New client" });
      await dialog.getByLabel("Client / business name").fill(name);
      await dialog
        .getByLabel("Instagram username")
        .fill(name.toLowerCase().replace(/\s/g, "."));
      await dialog.getByRole("button", { name: "Create client" }).click();
      await expect(page).toHaveURL(/\/clients\/[a-f0-9-]{36}/);
      await page.goto("/clients");
    }

    // Edit bio of Indep One only.
    await page.getByRole("link", { name: "Open workspace for Indep One" }).click();
    await page.getByLabel("Bio").fill("Bio only for client one");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.locator("body")).toContainText("Profile saved");

    await page.goto("/clients");
    await page.getByRole("link", { name: "Open workspace for Indep Two" }).click();
    await expect(page.getByLabel("Bio")).toHaveValue("");
    await expect(phone(page)).not.toContainText("Bio only for client one");
  });

  test("search, filter, and sort narrow the list", async ({ page }) => {
    await enterDemo(page, "/clients");
    const search = page.getByLabel("Search clients", { exact: true });
    await search.fill("kavo");
    await expect(page.getByRole("link", { name: /Kavo Coffee/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Maison Aurelle/ })).toHaveCount(0);
    await search.fill("");

    await page.getByLabel("Filter by approval state").selectOption("changes_requested");
    await expect(page.getByRole("link", { name: /Maison Aurelle/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Studio Norr/ })).toHaveCount(0);

    await page.getByLabel("Filter by approval state").selectOption("all");
    await page.getByLabel("Sort clients").selectOption("name");
    const names = await page
      .locator('a[aria-label^="Open workspace"]')
      .evaluateAll((links) => links.map((l) => l.getAttribute("aria-label")));
    expect(names).toEqual([...names].sort());
  });

  test("duplicate creates a copy with posts; delete removes it after confirm", async ({ page }) => {
    await enterDemo(page, "/clients");
    await page
      .locator("div.group", {
        has: page.getByRole("link", { name: "Open workspace for Kavo Coffee" }),
      })
      .getByRole("button", { name: "Client actions" })
      .click();
    await page.getByRole("button", { name: "Duplicate" }).click();
    await expect(page.getByRole("link", { name: "Open workspace for Kavo Coffee copy" })).toBeVisible();

    // Cancel delete first, then confirm.
    const copyCard = page.locator("div.group", {
      has: page.getByRole("link", { name: "Open workspace for Kavo Coffee copy" }),
    });
    await copyCard.getByRole("button", { name: "Client actions" }).click();
    await page.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("link", { name: "Open workspace for Kavo Coffee copy" })).toBeVisible();

    await copyCard.getByRole("button", { name: "Client actions" }).click();
    await page.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete client" }).click();
    await expect(
      page.getByRole("link", { name: "Open workspace for Kavo Coffee copy" }),
    ).toHaveCount(0);
  });
});
