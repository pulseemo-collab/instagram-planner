import { expect, type ConsoleMessage, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

/**
 * Where evidence screenshots and the axe report go. By default a normal test
 * run writes them under test-results/ (git-ignored), so it never rewrites the
 * committed copies; run with UPDATE_QA_EVIDENCE=1 to refresh docs/qa-evidence/.
 */
export const EVIDENCE_DIR =
  process.env.UPDATE_QA_EVIDENCE === "1"
    ? path.join(process.cwd(), "docs", "qa-evidence")
    : path.join(process.cwd(), "test-results", "qa-evidence");

/** Save an evidence screenshot under <EVIDENCE_DIR>/<folder>/<name>.png */
export async function evidence(page: Page, folder: string, name: string): Promise<void> {
  const dir = path.join(EVIDENCE_DIR, folder);
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: false });
}

/**
 * Enter demo mode by seeding the session flag before any page script runs,
 * then load the target route. Fresh Playwright contexts start with an empty
 * IndexedDB, so the app re-creates its demo seed data — giving every test a
 * deterministic dataset.
 */
export async function enterDemo(page: Page, route = "/"): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("gridline-demo-session", "1");
  });
  await page.goto(route);
  await expect(page.locator("body")).not.toContainText("Loading workspace…", { timeout: 15_000 });
}

/** Demo session + a pre-selected calendar client (the calendar is single-client). */
export async function enterDemoCalendar(page: Page, clientId = "client-aurelle"): Promise<void> {
  await page.addInitScript(
    ([id]) => {
      window.localStorage.setItem("gridline-demo-session", "1");
      window.localStorage.setItem("gridline-calendar-client", id);
    },
    [clientId] as const,
  );
  await page.goto("/calendar");
  await expect(page.getByRole("heading", { name: "Content", exact: true })).toBeVisible({
    timeout: 15_000,
  });
}

/**
 * Step the calendar with its month arrows until it shows the given month
 * (1-based), wherever it started — keeps tests independent of today's date.
 */
export async function gotoCalendarMonth(page: Page, year: number, month: number): Promise<void> {
  const heading = page.getByRole("heading", { level: 2 });
  const shown = new Date(`1 ${(await heading.textContent()) ?? ""}`);
  expect(Number.isNaN(shown.getTime()), "calendar month heading is parseable").toBe(false);
  const delta = (year - shown.getFullYear()) * 12 + (month - 1 - shown.getMonth());
  const arrow = page.getByRole("button", { name: delta > 0 ? "Next month" : "Previous month" });
  for (let i = 0; i < Math.abs(delta); i++) await arrow.click();
  const target = new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  await expect(heading).toHaveText(target);
}

/** Collect console errors + uncaught page errors for later assertions. */
export function watchConsole(page: Page): { errors: string[] } {
  const errors: string[] = [];
  page.on("console", (message: ConsoleMessage) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return { errors };
}

/** Ignore benign noise (favicon 404s on some hosts, aborted prefetches). */
export function significantErrors(errors: string[]): string[] {
  return errors.filter(
    (error) =>
      !error.includes("favicon") &&
      !error.includes("net::ERR_ABORTED") &&
      !error.includes("Failed to load resource: the server responded with a status of 404"),
  );
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "horizontal overflow in px").toBeLessThanOrEqual(1);
}

/** Wait for the workspace store to finish loading on dashboard pages. */
export async function waitForDashboard(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible({
    timeout: 15_000,
  });
}

export const paths = {
  asset: (name: string) => path.join(process.cwd(), "tests", "assets", name),
};

/**
 * The Instagram phone screen. `.ig-root` also styles the device status bar,
 * so target the last (innermost) match — the actual profile/post component.
 */
export function phone(page: Page) {
  return page.locator(".ig-root").last();
}

/** Workspace editing-panel tab (disambiguates from the phone's own tabs). */
export function panelTab(page: Page, name: string) {
  return page.getByRole("tablist", { name: "Editing panels" }).getByRole("tab", { name });
}

/** The in-page New client button (disambiguates from the top-bar one). */
export function newClientButton(page: Page) {
  return page.locator("#main-content").getByRole("button", { name: "New client" });
}
