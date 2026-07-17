import { expect, test } from "@playwright/test";
import { enterDemo, evidence, phone, waitForDashboard } from "./helpers";

test.describe("Dashboard", () => {
  test("summary counts reflect the seeded data @smoke", async ({ page }) => {
    await enterDemo(page, "/");
    await waitForDashboard(page);
    const summary = page.getByRole("region", { name: "Summary" }).or(
      page.locator("section[aria-label=Summary]"),
    );
    await expect(summary).toContainText("Active clients");
    // Seed: 3 clients, 6 drafts, 3 awaiting approval, 7 scheduled this month.
    await expect(summary).toContainText("3");
    await expect(summary).toContainText("6");
    await expect(page.locator("body")).toContainText("Recent client projects");
    await expect(page.locator("body")).toContainText("Upcoming content");
    await expect(page.locator("body")).toContainText("Recent activity");
  });

  test("client card opens the matching workspace", async ({ page }) => {
    await enterDemo(page, "/");
    await waitForDashboard(page);
    await page.getByRole("link", { name: "Open workspace for Studio Norr" }).click();
    await expect(page).toHaveURL(/\/clients\/client-norr/);
    await expect(phone(page)).toContainText("studionorr");
  });

  test("New client button opens the create dialog", async ({ page }) => {
    await enterDemo(page, "/");
    await page.getByRole("button", { name: "New client" }).first().click();
    await expect(page).toHaveURL(/\/clients\?new=1/);
    await expect(page.getByRole("dialog", { name: "New client" })).toBeVisible();
  });

  test("sidebar collapses and expands", async ({ page }) => {
    await enterDemo(page, "/");
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Shared previews" })).not.toContainText(
      "Shared previews",
    );
    await page.getByRole("button", { name: "Expand sidebar" }).click();
    await expect(page.getByRole("link", { name: "Shared previews" })).toBeVisible();
  });

  test("awaiting-approval count drops after approving a post", async ({ page }) => {
    await enterDemo(page, "/");
    await waitForDashboard(page);
    await expect(page.locator("section[aria-label=Summary]")).toContainText("Awaiting approval");
    const before = await page
      .locator("section[aria-label=Summary] > div > div", { hasText: "Awaiting approval" })
      .locator("p")
      .nth(1)
      .textContent();

    // Approve a seeded awaiting post from its detail page.
    await page.goto("/clients/client-aurelle/posts/post-a1");
    await page.getByRole("button", { name: "Mark approved" }).click();
    await expect(page.locator("body")).toContainText("Marked approved");

    await page.goto("/");
    await waitForDashboard(page);
    const after = await page
      .locator("section[aria-label=Summary] > div > div", { hasText: "Awaiting approval" })
      .locator("p")
      .nth(1)
      .textContent();
    expect(Number(after)).toBe(Number(before) - 1);
    await evidence(page, "dashboard", "counts-after-approval");
  });
});
