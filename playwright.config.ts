import { defineConfig, devices } from "@playwright/test";

/**
 * QA audit configuration.
 *
 * Local runs (default): starts the production build via `npm start`.
 * Production runs: PLAYWRIGHT_BASE_URL=https://... npx playwright test --grep @smoke
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const isRemote = Boolean(process.env.PLAYWRIGHT_BASE_URL);

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./test-results",
  fullyParallel: false,
  workers: 1,
  retries: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
      grepInvert: /@mobile/,
    },
    {
      name: "mobile",
      // iPhone 13 metrics (390×844, touch, mobile UA) on the Chromium engine —
      // WebKit binaries are not installed in this environment (see audit
      // report §8 Browser coverage).
      use: { ...devices["iPhone 13"], browserName: "chromium" },
      grep: /@mobile/,
    },
  ],
  webServer: isRemote
    ? undefined
    : {
        // The local suite audits DEMO mode. The app's mode is frozen at build
        // time (NEXT_PUBLIC_BUILT_WITH_SUPABASE, see next.config.ts), so the
        // suite builds AND serves with the Supabase vars explicitly blanked —
        // real env vars take precedence over any .env.local.
        command: "npm run build && npm start",
        url: "http://localhost:3000/login",
        env: {
          NEXT_PUBLIC_SUPABASE_URL: "",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
        },
        reuseExistingServer: false,
        timeout: 180_000,
      },
});
