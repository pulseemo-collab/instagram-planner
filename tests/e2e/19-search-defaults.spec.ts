import { expect, test, type Page } from "@playwright/test";
import { enterDemo, newClientButton, significantErrors, watchConsole } from "./helpers";

function searchBox(page: Page) {
  return page.getByRole("combobox", { name: "Search clients and posts" }).first();
}

test.describe("Top-bar search", () => {
  test("Ctrl+K focuses search; accent-insensitive results open the post", async ({ page }) => {
    await enterDemo(page, "/");
    await page.keyboard.press("Control+k");
    await expect(searchBox(page)).toBeFocused();

    await page.keyboard.type("heritage"); // matches "Héritage …"
    const listbox = page.getByRole("listbox", { name: "Search results" });
    await expect(listbox.getByRole("option", { name: /Héritage signet/ })).toBeVisible();
    await listbox.getByRole("option", { name: /Héritage signet/ }).click();
    await expect(page).toHaveURL(/\/clients\/client-aurelle\/posts\/post-a1$/);
    await expect(searchBox(page)).toHaveValue("");
  });

  test("keyboard: arrows + Enter open a client; Escape clears; no-match message", async ({ page }) => {
    await enterDemo(page, "/");
    await searchBox(page).click();
    await page.keyboard.type("kavo");
    const listbox = page.getByRole("listbox", { name: "Search results" });
    await expect(listbox.getByRole("group", { name: "Clients" }).getByRole("option")).toHaveCount(1);
    await expect(searchBox(page)).toHaveAttribute("aria-activedescendant", /option-0$/);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/clients\/client-kavo$/);

    await searchBox(page).click();
    await page.keyboard.type("zzz-no-such-thing");
    await expect(page.getByRole("status").filter({ hasText: "No matches" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(searchBox(page)).toHaveValue("");
  });

  test("the Shared previews page shows its own title", async ({ page }) => {
    // Regression: the deleted /preview playground's title also matched /previews.
    await enterDemo(page, "/previews");
    await expect(page.locator("header h1")).toHaveText("Shared previews");
  });

  test("mobile search button opens a working search @mobile", async ({ page }) => {
    await enterDemo(page, "/");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    const box = page.locator("#mobile-search").getByRole("combobox", { name: "Search clients and posts" });
    await expect(box).toBeFocused();
    await box.fill("norr");
    await page.getByRole("option", { name: /Studio Norr/ }).click();
    await expect(page).toHaveURL(/\/clients\/client-norr$/);
    await expect(page.locator("#mobile-search")).toHaveCount(0);
  });
});

test.describe("Settings defaults", () => {
  test("new clients use the default theme; new links use the default approval flow", async ({ page }) => {
    await enterDemo(page, "/settings");
    await page.getByLabel("Default preview theme").selectOption("dark");
    await page.getByLabel("Default approval flow").selectOption("view_only");

    await page.goto("/clients");
    await newClientButton(page).click();
    await expect(page.getByRole("dialog", { name: "New client" }).getByLabel("Preview theme")).toHaveValue("dark");
    await page.keyboard.press("Escape");

    await page.goto("/clients/client-norr");
    await page.getByRole("button", { name: "Share", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Share preview" });
    await expect(dialog.getByRole("switch", { name: "Allow comments" })).toHaveAttribute("aria-checked", "false");
    await expect(dialog.getByRole("switch", { name: "Allow approvals" })).toHaveAttribute("aria-checked", "false");
    await dialog.getByRole("button", { name: "Create share link" }).click();
    await expect(dialog.locator("li").last()).toContainText("Comments off");
    await expect(dialog.locator("li").last()).toContainText("Approvals off");

    // "Comments only" → comments on, approvals off.
    await page.goto("/settings");
    await page.getByLabel("Default approval flow").selectOption("comments_only");
    await page.goto("/clients/client-norr");
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await expect(dialog.getByRole("switch", { name: "Allow comments" })).toHaveAttribute("aria-checked", "true");
    await expect(dialog.getByRole("switch", { name: "Allow approvals" })).toHaveAttribute("aria-checked", "false");
  });
});

test.describe("Stored values without hydration errors", () => {
  test("calendar, settings and share page restore stored values cleanly", async ({ page }) => {
    const { errors } = watchConsole(page);
    await page.addInitScript(() => {
      localStorage.setItem("gridline-demo-session", "1");
      localStorage.setItem("gridline-calendar-client", "client-kavo");
      sessionStorage.setItem("gridline-calendar-month", "2026-7"); // August 2026
      localStorage.setItem(
        "gridline-preferences",
        JSON.stringify({ defaultTheme: "dark", defaultApprovals: "comments_only" }),
      );
      localStorage.setItem("gridline-reviewer", JSON.stringify({ name: "Stored Reviewer", email: "s@example.com" }));
    });

    await page.goto("/calendar");
    await expect(page.getByRole("heading", { level: 2, name: "August 2026" })).toBeVisible();
    await expect(page.locator("#main-content")).toContainText("Kavo Coffee");

    await page.goto("/settings");
    await expect(page.getByLabel("Default preview theme")).toHaveValue("dark");
    await expect(page.getByLabel("Default approval flow")).toHaveValue("comments_only");

    await page.goto("/share/demo-aurelle-h3ritage");
    await expect(page.getByLabel("Name")).toHaveValue("Stored Reviewer");

    expect(significantErrors(errors)).toEqual([]);
  });
});
