import { expect, test } from "@playwright/test";
import { enterDemo, evidence } from "./helpers";

test.describe("Share links & public reviewer flow", () => {
  test("seeded share link renders clean public profile; reviewer approves with comment @smoke", async ({
    page,
  }) => {
    await page.goto("/share/demo-aurelle-h3ritage");
    await expect(page.getByRole("heading", { name: "Maison Aurelle" })).toBeVisible();
    // No creator chrome on the public page.
    await expect(page.getByRole("button", { name: "New client" })).toHaveCount(0);
    await expect(page.getByRole("tablist", { name: "Editing panels" })).toHaveCount(0);
    await evidence(page, "sharing", "public-profile");

    // Reviewer details are validated.
    await page.locator(".ig-root .grid.grid-cols-3 > button").first().click();
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Please enter your name.")).toBeVisible();
    await page.getByLabel("Name").fill("Rita Reviewer");
    await page.getByLabel("Email").fill("bad-email");
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Please enter a valid email.")).toBeVisible();

    await page.getByLabel("Email").fill("rita@example.com");
    await page.getByLabel(/Message/).fill("Looks great — approved.");
    // Approval is a two-step confirmation to avoid accidental clicks.
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByText("Click Confirm approval to record your approval.")).toBeVisible();
    await page.getByRole("button", { name: "Confirm approval" }).click();
    await expect(page.locator("body")).toContainText("Post approved");
    await expect(page.locator("body")).toContainText("Approved");
    await evidence(page, "approvals", "reviewer-approved");
  });

  test("request changes requires a message; updates status", async ({ page }) => {
    await page.goto("/share/demo-aurelle-h3ritage");
    await page.getByLabel("Name").fill("Rita Reviewer");
    await page.getByLabel("Email").fill("rita@example.com");
    await page.locator(".ig-root .grid.grid-cols-3 > button").nth(2).click();
    await page.getByRole("button", { name: "Request changes" }).click();
    await expect(page.getByText("Describe the change you need first.")).toBeVisible();
    await page.getByLabel(/Message/).fill("Please brighten the second shot.");
    await page.getByRole("button", { name: "Request changes" }).click();
    await expect(page.locator("body")).toContainText("Change request sent");
  });

  test("approve all pending clears the queue and reflects on creator side", async ({ page }) => {
    await page.goto("/share/demo-aurelle-h3ritage");
    await page.getByLabel("Name").fill("Rita Reviewer");
    await page.getByLabel("Email").fill("rita@example.com");
    // Only the posts actually awaiting approval (Aurelle: 2 of them).
    await expect(page.locator("body")).toContainText("2 posts are waiting for your approval");
    await page.getByRole("button", { name: "Approve all pending" }).click();
    await expect(page.locator("body")).toContainText("2 posts approved");
    await expect(page.getByRole("button", { name: "Approve all pending" })).toBeDisabled();

    // Creator side sees the result (same browser storage in demo mode): the
    // inline editor's approval select now reads "approved".
    await enterDemo(page, "/clients/client-aurelle/posts/post-a1");
    await expect(page.locator("body")).toContainText("Approved");
    await expect(
      page.locator('section[aria-label="Edit post"]').getByLabel("Approval status"),
    ).toHaveValue("approved");

    // A post never sent for review is left alone.
    await enterDemo(page, "/clients/client-aurelle/posts/post-a4");
    await expect(
      page.locator('section[aria-label="Edit post"]').getByLabel("Approval status"),
    ).toHaveValue("not_sent");
  });

  test("reviewer comments reach the creator's preview and activity feed", async ({ page }) => {
    // The Feedback card was removed from the calendar/post workspace by
    // design; comments still flow into the Instagram preview's comment list
    // and the dashboard activity feed.
    await page.goto("/share/demo-aurelle-h3ritage");
    await page.getByLabel("Name").fill("Rita Reviewer");
    await page.getByLabel("Email").fill("rita@example.com");
    await page.locator(".ig-root .grid.grid-cols-3 > button").first().click();
    await page.getByLabel(/Message/).fill("One small note on the crop.");
    await page.getByRole("button", { name: "Comment only" }).click();
    await expect(page.locator("body")).toContainText("Comment sent");

    await enterDemo(page, "/clients/client-aurelle/posts/post-a1");
    // Latest comments render inside the Instagram post preview.
    await expect(page.locator(".ig-root").last()).toContainText("One small note on the crop.");

    await page.goto("/");
    await expect(page.locator("body")).toContainText("Rita Reviewer left a comment");
  });

  test("share dialog creates, disables, and regenerates links", async ({ page }) => {
    await enterDemo(page, "/clients/client-kavo");
    await page.getByRole("button", { name: "Share", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Share preview" });
    await dialog.getByRole("button", { name: "Create share link" }).click();
    await expect(page.locator("body")).toContainText("Share link created");
    // Seeded Kavo link + new link.
    await expect(dialog.locator("li")).toHaveCount(2);

    const firstToken = await dialog.locator("code").last().textContent();
    await dialog.getByRole("button", { name: "Regenerate" }).last().click();
    await expect(page.locator("body")).toContainText("Token regenerated");
    const newToken = await dialog.locator("code").last().textContent();
    expect(newToken).not.toBe(firstToken);
  });

  test("error states: invalid, disabled, and expired links @smoke", async ({ page }) => {
    await page.goto("/share/definitely-not-a-token");
    await expect(page.getByText("Preview not found")).toBeVisible();
    await evidence(page, "errors", "share-invalid");

    // Seeded Kavo link is disabled.
    await page.goto("/share/demo-kavo-hu1la");
    await expect(page.getByText("Preview disabled")).toBeVisible();

    // Create an expired link via the dialog, then open it.
    await enterDemo(page, "/clients/client-norr");
    await page.getByRole("button", { name: "Share", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Share preview" });
    await dialog.getByLabel(/Expiration date/).fill("2020-01-01");
    await dialog.getByRole("button", { name: "Create share link" }).click();
    await expect(page.locator("body")).toContainText("Share link created");
    const expiredToken = (await dialog.locator("code").last().textContent())
      ?.replace("/share/", "")
      .trim();
    await page.goto(`/share/${expiredToken}`);
    await expect(page.getByText("Preview expired")).toBeVisible();
    await evidence(page, "errors", "share-expired");
  });

  test("reviewer view excludes designer content packages", async ({ page }) => {
    // Maison Aurelle has 8 completed posts and 2 calendar content packages;
    // reviewers only ever receive the completed posts.
    await page.goto("/share/demo-aurelle-h3ritage");
    await expect(page.locator("body")).toContainText("8 planned posts");
  });

  test("link permissions: comments-off / approvals-off hide those actions", async ({ page }) => {
    await enterDemo(page, "/clients/client-norr");
    await page.getByRole("button", { name: "Share", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Share preview" });

    // View-only link: both switches off.
    await dialog.getByRole("switch", { name: "Allow comments" }).click();
    await dialog.getByRole("switch", { name: "Allow approvals" }).click();
    await dialog.getByRole("button", { name: "Create share link" }).click();
    await expect(page.locator("body")).toContainText("Share link created");
    const viewOnly = (await dialog.locator("code").last().textContent())?.replace("/share/", "").trim();

    // Comments-only link: approvals off.
    await dialog.getByRole("switch", { name: "Allow comments" }).click();
    await dialog.getByRole("button", { name: "Create share link" }).click();
    await expect(dialog.locator("li")).toHaveCount(3);
    const commentsOnly = (await dialog.locator("code").last().textContent())?.replace("/share/", "").trim();

    await page.goto(`/share/${viewOnly}`);
    await expect(page.getByRole("heading", { name: "Studio Norr" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve all pending" })).toHaveCount(0);
    await page.locator(".ig-root .grid.grid-cols-3 > button").first().click();
    await expect(page.getByRole("button", { name: "Back to grid" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Request changes" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Comment only" })).toHaveCount(0);

    await page.goto(`/share/${commentsOnly}`);
    await page.locator(".ig-root .grid.grid-cols-3 > button").first().click();
    await expect(page.getByRole("button", { name: "Comment only" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Request changes" })).toHaveCount(0);
  });

  test("an approval message becomes exactly one comment on the post", async ({ page }) => {
    await page.goto("/share/demo-norr-ostermalm");
    await page.getByLabel("Name").fill("Rita Reviewer");
    await page.getByLabel("Email").fill("rita@example.com");
    // "Handrail detail": not yet approved and no seeded comments.
    await page.locator(".ig-root .grid.grid-cols-3 > button").nth(4).click();
    await page.getByLabel(/Message/).fill("Ship it as is.");
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await page.getByRole("button", { name: "Confirm approval" }).click();
    await expect(page.locator("body")).toContainText("Post approved");
    await expect(page.locator(".ig-root").last().getByText("Ship it as is.")).toHaveCount(1);
  });

  test("DEMO LIMITATION PROOF: fresh browser context sees seed links but not newly created links", async ({
    browser,
  }) => {
    // Create a new link in context A.
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await pageA.addInitScript(() => localStorage.setItem("gridline-demo-session", "1"));
    await pageA.goto("/clients/client-kavo");
    await pageA.getByRole("button", { name: "Share", exact: true }).click();
    const dialog = pageA.getByRole("dialog", { name: "Share preview" });
    await dialog.getByRole("button", { name: "Create share link" }).click();
    await expect(pageA.locator("body")).toContainText("Share link created");
    const token = (await dialog.locator("code").last().textContent())
      ?.replace("/share/", "")
      .trim();
    // Works inside the same context (same IndexedDB).
    await pageA.goto(`/share/${token}`);
    await expect(pageA.getByRole("heading", { name: "Kavo Coffee" })).toBeVisible();
    await contextA.close();

    // A brand-new context (like an incognito window / another person's browser)
    // has its own empty IndexedDB → reseeded demo data → the NEW token is unknown,
    // while the SEEDED token resolves because the seed regenerates it.
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await pageB.goto(`/share/${token}`);
    await expect(pageB.getByText("Preview not found")).toBeVisible();
    await pageB.goto("/share/demo-aurelle-h3ritage");
    await expect(pageB.getByRole("heading", { name: "Maison Aurelle" })).toBeVisible();
    await contextB.close();
  });
});
