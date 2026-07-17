import { expect, test } from "@playwright/test";
import { evidence, watchConsole, significantErrors } from "./helpers";

test.describe("Authentication & demo mode", () => {
  test("unauthenticated visit redirects to /login @smoke", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    // The demo button exists only in demo-mode builds (BUG-001 fix): visible
    // on the local demo test server, absent on Supabase-configured deployments.
    const demoButton = page.getByRole("button", { name: "Continue in demo mode" });
    if (process.env.PLAYWRIGHT_BASE_URL) {
      await expect(demoButton).toHaveCount(0);
    } else {
      await expect(demoButton).toBeVisible();
    }
  });

  test("login form validates email and password", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Email is required")).toBeVisible();
    await expect(page.getByText("Password is required")).toBeVisible();

    await page.getByLabel("Email").fill("not-an-email");
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Enter a valid email address")).toBeVisible();
    await expect(page.getByText("Password must be at least 8 characters")).toBeVisible();
  });

  test("signup form requires a name and links back to login", async ({ page }) => {
    await page.goto("/signup");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Your name is required")).toBeVisible();
    await page.getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("demo mode entry lands on dashboard and persists across reload @smoke", async ({ page }) => {
    const console = watchConsole(page);
    await page.goto("/login");
    await page.getByRole("button", { name: "Continue in demo mode" }).click();
    await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
    await evidence(page, "dashboard", "dashboard-after-demo-login");

    await page.reload();
    await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
    expect(significantErrors(console.errors)).toEqual([]);
  });

  test("sign out returns to login and re-protects routes", async ({ page }) => {
    // Enter demo via the real button (an init script would re-seed the session
    // flag on every navigation and mask the sign-out behavior).
    await page.goto("/login");
    await page.getByRole("button", { name: "Continue in demo mode" }).click();
    await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
    await page.goto("/settings");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);
    // Session flag cleared → dashboard bounces back to login.
    await page.goto("/clients");
    await expect(page).toHaveURL(/\/login/);
  });
});
