import { defineConfig, devices } from "@playwright/test";

/**
 * Live-mode tests: the app built in Supabase mode against a LOCAL Supabase
 * stack (`supabase start`, run by the CI "live" job). Never a hosted project.
 *
 * Required env (exported from `supabase status -o env` in CI):
 *   NEXT_PUBLIC_SUPABASE_URL       http://127.0.0.1:54321
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY  the local stack's public demo key
 *   SUPABASE_SERVICE_ROLE_KEY      the local stack's admin key (test setup only)
 *   SUPABASE_MAIL_URL              http://127.0.0.1:54324 (local mail catcher)
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
let host = "";
try {
  host = new URL(supabaseUrl).hostname;
} catch {
  host = "";
}
// Safety guard: refuse anything but a local stack, so real keys or a hosted
// project can never be used by these tests — even by mistake.
if (host !== "127.0.0.1" && host !== "localhost") {
  throw new Error(
    `Live tests only run against a LOCAL Supabase (supabase start). ` +
      `NEXT_PUBLIC_SUPABASE_URL is ${supabaseUrl ? `"${supabaseUrl}"` : "not set"} — refusing.`,
  );
}
for (const name of ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!process.env[name]) throw new Error(`${name} is required for live tests (local stack only).`);
}

export default defineConfig({
  testDir: "./tests/live",
  outputDir: "./test-results/live",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report/live" }]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "live", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    // Built in Supabase mode: the env vars above are present at build time.
    command: "npm run build && npm start -- -H 127.0.0.1",
    url: "http://127.0.0.1:3000/login",
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
