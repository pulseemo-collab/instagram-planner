import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { enterDemo, evidence, watchConsole } from "./helpers";

/** React render-phase violations that must never appear. */
const RENDER_ERROR = /Cannot update a component|while rendering a different component|setState in render/i;

function expectNoRenderErrors(errors: string[]): void {
  expect(errors.filter((e) => RENDER_ERROR.test(e)), "React render-phase errors").toEqual([]);
}

const SHARE_URL = "/share/demo-aurelle-h3ritage";

function bell(page: Page) {
  return page.getByRole("button", { name: /Notifications/ });
}

function panel(page: Page) {
  return page.getByRole("dialog", { name: "Notifications" });
}

async function fillReviewer(page: Page) {
  await page.getByLabel("Name").fill("Rita Reviewer");
  await page.getByLabel("Email").fill("rita@example.com");
}

/** Open the seeded Aurelle share link and the first grid post (post-a1). */
async function openFirstSharedPost(page: Page) {
  await page.goto(SHARE_URL);
  await expect(page.getByRole("heading", { name: "Maison Aurelle" })).toBeVisible();
  await fillReviewer(page);
  await page.locator(".ig-root .grid.grid-cols-3 > button").first().click();
  await expect(page.getByRole("heading", { name: "This post" })).toBeVisible();
}

test.describe("Client review notifications", () => {
  test("share token isolation: valid link shows only its client; invalid token rejected", async ({
    page,
  }) => {
    await page.goto(SHARE_URL);
    await expect(page.getByRole("heading", { name: "Maison Aurelle" })).toBeVisible();
    // A token grants access to exactly one client's package — nothing else leaks.
    await expect(page.locator("body")).not.toContainText("Kavo Coffee");
    await expect(page.locator("body")).not.toContainText("Studio Norr");

    await page.goto("/share/tampered-token-123456");
    await expect(page.getByText("Preview not found")).toBeVisible();
  });

  test("CHANGES FLOW: client feedback → owner notification → post review activity @smoke", async ({
    page,
  }) => {
    const { errors } = watchConsole(page);

    await openFirstSharedPost(page);
    // Empty feedback is rejected before anything is submitted.
    await page.getByRole("button", { name: "Request changes" }).click();
    await expect(page.getByText("Describe the change you need first.")).toBeVisible();

    await page.getByLabel(/Message/).fill("Please replace the second image.");
    await page.getByRole("button", { name: "Request changes" }).click();
    await expect(page.locator("body")).toContainText("Change request sent");
    await expect(page.locator("body")).toContainText("Changes requested");

    // Owner side: the bell shows the new unread notification (2 seeded + 1 new).
    await enterDemo(page, "/");
    await expect(page.getByRole("button", { name: "Notifications, 3 unread" })).toBeVisible();
    await bell(page).click();
    const item = panel(page).getByRole("button", { name: /^Rita Reviewer requested changes/ });
    await expect(item).toBeVisible();
    await expect(panel(page)).toContainText("Please replace the second image.");
    await expect(panel(page)).toContainText("Maison Aurelle");
    await evidence(page, "review-notifications", "bell-open");

    // Clicking the notification marks it read and opens the exact post.
    await item.click();
    await expect(page).toHaveURL(/\/clients\/client-aurelle\/posts\/post-a1\?focus=review/);
    const review = page.locator("#review-activity");
    await expect(review).toBeVisible();
    await expect(review).toContainText("Changes requested");
    await expect(review).toContainText("Rita Reviewer");
    await expect(review).toContainText("Please replace the second image.");
    await expect(
      page.locator('section[aria-label="Edit post"]').getByLabel("Approval status"),
    ).toHaveValue("changes_requested");
    await expect(page.getByRole("button", { name: "Notifications, 2 unread" })).toBeVisible();
    await evidence(page, "review-notifications", "post-review-activity");

    expectNoRenderErrors(errors);
  });

  test("APPROVAL FLOW: confirm step, owner notification, review history", async ({ page }) => {
    const { errors } = watchConsole(page);

    await openFirstSharedPost(page);
    await page.getByLabel(/Message/).fill("The post is ready.");
    // Two-step confirmation prevents accidental approvals.
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByText("Click Confirm approval to record your approval.")).toBeVisible();
    await page.getByRole("button", { name: "Confirm approval" }).click();
    await expect(page.locator("body")).toContainText("Post approved");

    await enterDemo(page, "/");
    await expect(page.getByRole("button", { name: "Notifications, 3 unread" })).toBeVisible();
    await bell(page).click();
    const item = panel(page).getByRole("button", { name: /^Rita Reviewer approved the post/ });
    await expect(item).toBeVisible();
    await item.click();

    await expect(page).toHaveURL(/\/clients\/client-aurelle\/posts\/post-a1\?focus=review/);
    const review = page.locator("#review-activity");
    await expect(review).toContainText("Approved");
    await expect(review).toContainText("Rita Reviewer");
    await expect(review).toContainText("approved the post");
    await expect(review).toContainText("The post is ready.");
    await expect(
      page.locator('section[aria-label="Edit post"]').getByLabel("Approval status"),
    ).toHaveValue("approved");

    expectNoRenderErrors(errors);
  });

  test("REALTIME: open dashboard updates the badge without a reload", async ({ page, context }) => {
    await enterDemo(page, "/");
    await expect(page.getByRole("button", { name: "Notifications, 2 unread" })).toBeVisible();

    // A second tab plays the client reviewer.
    const reviewerPage = await context.newPage();
    await openFirstSharedPost(reviewerPage);
    await reviewerPage.getByLabel(/Message/).fill("Swap the cover, please.");
    await reviewerPage.getByRole("button", { name: "Request changes" }).click();
    await expect(reviewerPage.locator("body")).toContainText("Change request sent");

    // The dashboard tab was never reloaded — BroadcastChannel drives the update.
    await expect(page.getByRole("button", { name: "Notifications, 3 unread" })).toBeVisible({
      timeout: 10_000,
    });
    await reviewerPage.close();
  });

  test("duplicate clicks stay single; unread persists across reload; mark all as read", async ({
    page,
  }) => {
    await openFirstSharedPost(page);
    await page.getByLabel(/Message/).fill("Tighten the crop on slide one.");
    // Fire two clicks in the same tick — the submit guard must keep one event.
    await page
      .getByRole("button", { name: "Request changes" })
      .evaluate((el: HTMLButtonElement) => {
        el.click();
        el.click();
      });
    await expect(page.locator("body")).toContainText("Change request sent");

    await enterDemo(page, "/");
    // Exactly one new notification (3 total), not two.
    await expect(page.getByRole("button", { name: "Notifications, 3 unread" })).toBeVisible();
    await bell(page).click();
    await expect(
      panel(page).getByRole("button", { name: /^Rita Reviewer requested changes/ }),
    ).toHaveCount(1);

    // Unread state survives a reload.
    await page.reload();
    await expect(page.getByRole("button", { name: "Notifications, 3 unread" })).toBeVisible();

    await bell(page).click();
    await panel(page).getByRole("button", { name: "Mark all as read" }).click();
    await expect(page.getByRole("button", { name: "Notifications", exact: true })).toBeVisible();
    // The default list only shows unread ones, so it is empty now…
    await expect(panel(page).getByRole("button", { name: /^Rita Reviewer requested changes/ })).toHaveCount(0);
    await expect(panel(page)).toContainText("You're all caught up.");
    // …and history is kept under All, without the unread dot.
    await panel(page).getByRole("button", { name: "All", exact: true }).click();
    const item = panel(page).getByRole("button", { name: /^Rita Reviewer requested changes/ });
    await expect(item).toHaveCount(1);
    await expect(item).not.toContainText("(unread)");

    // Read state also survives a reload.
    await page.reload();
    await expect(page.getByRole("button", { name: "Notifications", exact: true })).toBeVisible();
  });

  test("clicking a notification marks it read and opens its post; Unread / All toggle", async ({
    page,
  }) => {
    await enterDemo(page, "/");
    await expect(page.getByRole("button", { name: "Notifications, 2 unread" })).toBeVisible();
    await bell(page).click();
    // Default: unread only. The seeded sign-up notice is already read.
    await expect(panel(page).getByRole("button", { name: "Unread", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(panel(page)).not.toContainText("Maya Lindqvist is waiting for approval");

    await panel(page).getByRole("button", { name: /^Jasper Vink requested changes/ }).click();
    await expect(page).toHaveURL(/\/clients\/client-kavo\/posts\/post-k2\?focus=review/);
    await expect(page.getByRole("button", { name: "Notifications, 1 unread" })).toBeVisible();

    await bell(page).click();
    await expect(panel(page).getByRole("button", { name: /^Jasper Vink requested changes/ })).toHaveCount(0);
    await panel(page).getByRole("button", { name: "All", exact: true }).click();
    const jasper = panel(page).getByRole("button", { name: /^Jasper Vink requested changes/ });
    await expect(jasper).toHaveCount(1);
    await expect(jasper).not.toContainText("(unread)");
    await expect(panel(page)).toContainText("Maya Lindqvist is waiting for approval");

    // Reopening starts on Unread again.
    await page.keyboard.press("Escape");
    await bell(page).click();
    await expect(panel(page).getByRole("button", { name: "Unread", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(panel(page).getByRole("button", { name: /^Camille Aurelle requested changes/ })).toHaveCount(1);
  });

  test("resubmit after changes: back to pending review, history preserved", async ({ page }) => {
    const { errors } = watchConsole(page);
    await enterDemo(page, "/clients/client-aurelle/posts/post-a5");
    const review = page.locator("#review-activity");
    await expect(review).toContainText("Changes requested");
    await expect(review).toContainText("Camille Aurelle");
    await expect(review).toContainText("Crop feels too tight on slide two.");

    await review.getByRole("button", { name: "Resubmit for review" }).click();
    await expect(page.locator("body")).toContainText("Sent for review");
    await expect(review).toContainText("Awaiting approval");
    // Earlier feedback is immutable history — still visible after resubmission.
    await expect(review).toContainText("Crop feels too tight on slide two.");
    expectNoRenderErrors(errors);
  });

  test("bell keyboard behavior + focused axe scans", async ({ page }) => {
    const { errors } = watchConsole(page);
    await enterDemo(page, "/");
    await bell(page).click();
    await expect(panel(page)).toBeVisible();
    // Let the dashboard FadeIn animations settle — axe blends mid-animation
    // opacity into text colors and reports phantom contrast failures.
    await page.waitForTimeout(600);

    const dashboardScan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(
      dashboardScan.violations.map((v) => `${v.id} (${v.impact}, ${v.nodes.length} nodes)`),
      "axe violations on dashboard with notification panel open",
    ).toEqual([]);

    // Escape closes the panel and returns focus to the bell.
    await page.keyboard.press("Escape");
    await expect(panel(page)).toBeHidden();
    await expect(bell(page)).toBeFocused();

    // Clicking outside also closes it.
    await bell(page).click();
    await expect(panel(page)).toBeVisible();
    await page.getByRole("heading", { name: /Welcome back/ }).click();
    await expect(panel(page)).toBeHidden();

    // Post detail with the Client review section.
    await page.goto("/clients/client-aurelle/posts/post-a5");
    await expect(page.locator("#review-activity")).toBeVisible();
    await page.waitForTimeout(600);
    const reviewScan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(
      reviewScan.violations.map((v) => `${v.id} (${v.impact}, ${v.nodes.length} nodes)`),
      "axe violations on post detail with Client review section",
    ).toEqual([]);

    expectNoRenderErrors(errors);
  });
});
