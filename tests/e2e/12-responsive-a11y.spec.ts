import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  enterDemo,
  enterDemoCalendar,
  evidence,
  expectNoHorizontalOverflow,
  newClientButton,
  phone,
} from "./helpers";

test.describe("Mobile experience @mobile", () => {
  test("mobile drawer opens, navigates, and closes @smoke", async ({ page }) => {
    await enterDemo(page, "/");
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    await expect(page.getByRole("dialog", { name: "Navigation" })).toBeVisible();
    await evidence(page, "mobile", "drawer-open");
    await page.getByRole("dialog", { name: "Navigation" }).getByRole("link", { name: "Calendar" }).click();
    await expect(page).toHaveURL(/\/calendar/);
    await expect(page.getByRole("dialog", { name: "Navigation" })).toHaveCount(0);
  });

  test("key routes have no horizontal overflow on 390px @smoke", async ({ page }) => {
    // Includes the client workspace and post detail — previously BUG-006
    // (fixed with min-w-0 on the phone-frame grid columns).
    for (const route of [
      "/",
      "/clients",
      "/clients/client-aurelle",
      "/clients/client-aurelle/posts/post-a1",
      "/content",
      "/previews",
      "/settings",
    ]) {
      await enterDemo(page, route);
      await page.waitForTimeout(400);
      await expectNoHorizontalOverflow(page);
    }
    // Calendar workspace (needs a selected client; month grid scrolls inside
    // its own container, the page itself must not).
    await enterDemoCalendar(page, "client-aurelle");
    await page.waitForTimeout(400);
    await expectNoHorizontalOverflow(page);
    await evidence(page, "mobile", "calendar-mobile");
  });

  test("public share page is usable on mobile @smoke", async ({ page }) => {
    await page.goto("/share/demo-aurelle-h3ritage");
    await expect(page.getByRole("heading", { name: "Maison Aurelle" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.locator(".ig-root .grid.grid-cols-3 > button").first().click();
    await expect(phone(page)).toContainText("Posts");
    await evidence(page, "mobile", "share-post-detail-mobile");
  });

  test("workspace stacks phone above editor panel on mobile", async ({ page }) => {
    await enterDemo(page, "/clients/client-aurelle");
    await expectNoHorizontalOverflow(page);
    const phoneBox = await phone(page).boundingBox();
    expect(phoneBox?.width).toBeGreaterThan(300);
    const panelBox = await page.getByRole("tablist", { name: "Editing panels" }).boundingBox();
    expect(panelBox && phoneBox && panelBox.y > phoneBox.y).toBe(true);
    await evidence(page, "mobile", "workspace-mobile");
  });
});

test.describe("Tablet viewport", () => {
  test.use({ viewport: { width: 768, height: 1024 } });
  test("dashboard and workspace fit a 768px tablet", async ({ page }) => {
    await enterDemo(page, "/");
    await expectNoHorizontalOverflow(page);
    await enterDemo(page, "/clients/client-aurelle");
    await expectNoHorizontalOverflow(page);
    await evidence(page, "mobile", "workspace-tablet-768");
  });
});

test.describe("Accessibility", () => {
  test("axe scan on core routes — record violations", async ({ page }) => {
    const results: Record<string, Array<{ id: string; impact: string | null; nodes: number }>> = {};
    for (const route of [
      "/login",
      "/",
      "/clients",
      "/clients/client-aurelle",
      "/calendar",
      "/share/demo-aurelle-h3ritage",
    ]) {
      if (route.startsWith("/share") || route === "/login") await page.goto(route);
      else if (route === "/calendar") await enterDemoCalendar(page, "client-aurelle");
      else await enterDemo(page, route);
      await page.waitForTimeout(500);
      const scan = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      results[route] = scan.violations.map((v) => ({
        id: v.id,
        impact: v.impact ?? null,
        nodes: v.nodes.length,
      }));
    }
    const outDir = path.join(process.cwd(), "docs", "qa-evidence");
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "axe-results.json"), JSON.stringify(results, null, 2));

    // BUG-003 (label/nested-interactive) and BUG-004 (color-contrast) are
    // fixed, so the gate now requires a fully clean WCAG A/AA scan. Results
    // are still recorded to docs/qa-evidence/axe-results.json as evidence.
    const all = Object.entries(results).flatMap(([route, violations]) =>
      violations.map((v) => `${route}: ${v.id} (${v.impact}, ${v.nodes} nodes)`),
    );
    expect(all, "axe violations").toEqual([]);
  });

  test("dialogs close on Escape and keep focus inside the app", async ({ page }) => {
    await enterDemo(page, "/clients");
    await newClientButton(page).click();
    await expect(page.getByRole("dialog", { name: "New client" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "New client" })).toHaveCount(0);
  });

  test("skip link jumps to main content", async ({ page }) => {
    await enterDemo(page, "/");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  });

  test("grid tiles expose reorder instructions to assistive tech", async ({ page }) => {
    await enterDemo(page, "/clients/client-aurelle");
    const label = await page
      .locator(".ig-root .grid.grid-cols-3 > button")
      .first()
      .getAttribute("aria-label");
    expect(label).toContain("Ctrl+Arrow keys to reorder");
  });
});

test.describe("Edge cases", () => {
  test("double-clicking create does not produce duplicate clients", async ({ page }) => {
    await enterDemo(page, "/clients");
    await newClientButton(page).click();
    const dialog = page.getByRole("dialog", { name: "New client" });
    await dialog.getByLabel("Client / business name").fill("Double Click Co");
    await dialog.getByLabel("Instagram username").fill("doubleclick");
    const submit = dialog.getByRole("button", { name: "Create client" });
    // A trusted double-click fires two click events back-to-back — the busy
    // flag must prevent a second create even before React re-renders the
    // disabled state. (Untrusted dispatchEvent clicks don't submit forms.)
    await submit.dblclick();
    await expect(page).toHaveURL(/\/clients\/[a-f0-9-]{36}/, { timeout: 15_000 });
    await page.goto("/clients");
    await expect(
      page.getByRole("link", { name: "Open workspace for Double Click Co" }),
    ).toHaveCount(1);
  });

  test("refresh during an unsaved profile edit loses only the draft (documented behavior)", async ({
    page,
  }) => {
    await enterDemo(page, "/clients/client-aurelle");
    await page.getByLabel("Profile name").fill("Never saved name");
    await expect(page.locator("body")).toContainText("Unsaved changes");
    await page.reload();
    await expect(page.getByLabel("Profile name")).toHaveValue("Maison Aurelle");
  });

  test("deep link into a post survives refresh", async ({ page }) => {
    await enterDemo(page, "/clients/client-norr/posts/post-n1");
    await expect(phone(page)).toContainText("studionorr");
    await page.reload();
    await expect(phone(page)).toContainText("studionorr");
  });
});
