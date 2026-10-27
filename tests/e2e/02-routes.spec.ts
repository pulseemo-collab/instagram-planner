import { expect, test } from "@playwright/test";
import {
  enterDemo,
  expectNoHorizontalOverflow,
  significantErrors,
  watchConsole,
} from "./helpers";

const routes = [
  { path: "/", marker: /Welcome back/ },
  { path: "/clients", marker: /Maison Aurelle/ },
  { path: "/clients/client-aurelle", marker: /maisonaurelle/ },
  { path: "/clients/client-aurelle/posts/post-a1", marker: /Edit post/ },
  { path: "/content", marker: /New post|No content yet/ },
  { path: "/calendar", marker: /Choose a client/ },
  { path: "/previews", marker: /share\// },
  { path: "/settings", marker: /demo mode/ },
];

test.describe("Route sweep — loads, console, overflow", () => {
  for (const route of routes) {
    test(`route ${route.path} loads cleanly @smoke`, async ({ page }) => {
      const console = watchConsole(page);
      await enterDemo(page, route.path);
      await expect(page.locator("body")).toContainText(route.marker, { timeout: 15_000 });
      await expectNoHorizontalOverflow(page);
      expect(significantErrors(console.errors), `console errors on ${route.path}`).toEqual([]);
    });
  }

  test("browser back navigation works between dashboard pages", async ({ page }) => {
    await enterDemo(page, "/");
    await page.getByRole("link", { name: "Clients", exact: true }).click();
    await expect(page).toHaveURL(/\/clients$/);
    await page.getByRole("link", { name: "Open workspace for Maison Aurelle" }).click();
    await expect(page).toHaveURL(/\/clients\/client-aurelle/);
    await page.goBack();
    await expect(page).toHaveURL(/\/clients$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
  });

  test("unknown client and post ids show friendly not-found states", async ({ page }) => {
    await enterDemo(page, "/clients/does-not-exist");
    await expect(page.getByText("Client not found")).toBeVisible();
    await page.goto("/clients/client-aurelle/posts/does-not-exist");
    await expect(page.getByText("Post not found")).toBeVisible();
  });
});
