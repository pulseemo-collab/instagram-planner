# Playwright Testing Guide

The QA suite lives in `tests/e2e/` with configuration in `playwright.config.ts`.

> **All test suites at a glance** (CI runs every one of them on push and pull request,
> see `.github/workflows/ci.yml`):
>
> | Command | What | Needs |
> | --- | --- | --- |
> | `npm run test:e2e` | This Playwright suite (demo mode, desktop + mobile, axe) | Chromium |
> | `npm run test:unit` | Vitest unit tests in `tests/unit/` (dates, mappers, search, store ordering, DemoRepository with an in-memory IndexedDB, …) | — |
> | `npm run test:sql` | `scripts/sql-test.mjs`: a throwaway PostgreSQL cluster with Supabase stand-ins; applies all migrations and runs the verify scripts, the rollback chain and atomicity checks | PostgreSQL 15+ binaries (`PG_BIN`, or on `PATH`) |
> | `npm run test:live` | `tests/live/` against a **local** Supabase (`supabase start`) — real Auth, RLS, RPCs, Storage, Realtime | Docker + Supabase CLI; runs in CI only. The config refuses any non-local Supabase URL |
> | `npm run lint`, `npm run typecheck` | ESLint, TypeScript | — |

## One-time setup

```bash
npm install                     # installs @playwright/test and @axe-core/playwright
npx playwright install chromium # downloads the browser binary
```

## Running tests

```bash
# Full local suite (starts the production server automatically via `npm start`;
# make sure you've run `npm run build` at least once and port 3000 is free)
npx playwright test

# Desktop project only / mobile project only
npx playwright test --project=desktop
npx playwright test --project=mobile

# One file
npx playwright test tests/e2e/08-grid.spec.ts

# One test by title
npx playwright test -g "REAL mouse drag"

# Headed (watch the browser)
npx playwright test --headed --project=desktop

# Smoke subset against the production deployment
set PLAYWRIGHT_BASE_URL=https://instagram-planner-five.vercel.app&& npx playwright test --grep @smoke --project=desktop
```

> **Windows note:** if a previous `npm start` left a server behind, free the port
> first: `Get-NetTCPConnection -LocalPort 3000 -State Listen | Select -Expand
> OwningProcess -Unique | % { Stop-Process -Id $_ -Force }`.

## Reports, traces, screenshots

```bash
npx playwright show-report      # open the HTML report (playwright-report/)
npx playwright show-trace test-results/<test-folder>/trace.zip
```

- Failure screenshots and traces: `test-results/` (retained on failure only).
- Evidence screenshots written by the tests themselves (`<area>/<name>.png`) and
  the accessibility scan output (`axe-results.json`) go to
  `test-results/qa-evidence/` on a normal run, which is git-ignored, so running the
  suite never changes committed files.
- To refresh the **committed** evidence in `docs/qa-evidence/`, run the suite with
  `UPDATE_QA_EVIDENCE=1` (PowerShell: `$env:UPDATE_QA_EVIDENCE = "1"; npx playwright test`),
  then review and commit the changed images.

## How test data works

- Every Playwright browser context starts with an **empty IndexedDB**, so the app
  recreates its deterministic demo seed (3 clients, posts in every state) for each
  test. Tests never touch your personal browser profile or any production data.
- `tests/e2e/helpers.ts` → `enterDemo(page, route)` seeds the demo session flag
  before page scripts run, then navigates.
- Upload tests use small generated fixtures in `tests/assets/` (PNG, JPG, WEBP,
  WebM, and an invalid `.txt`). Nothing is fetched from the network.
- Tests tagged `@smoke` are safe against remote deployments (read-mostly; the
  reviewer flow writes only to demo/browser-local data). Tests tagged `@mobile`
  run in the iPhone 13 profile via the `mobile` project.

## Conventions

- Selectors prefer roles, accessible names, and labels (`getByRole`, `getByLabel`).
  The app's own aria-labels are the contract — no CSS-class-only selectors.
- One worker, `retries: 1` (IndexedDB seeding makes tests order-independent, but
  the suite is kept serial to avoid port/browser contention on Windows).
