import { expect, type ConsoleMessage, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

export const EVIDENCE_DIR = path.join(process.cwd(), "docs", "qa-evidence");

/** Save an evidence screenshot under docs/qa-evidence/<folder>/<name>.png */
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
