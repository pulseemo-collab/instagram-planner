# Gridline Studio (ig-preview)

Plan, preview and approve Instagram content with your clients before it goes live.

Build a realistic copy of a client's Instagram profile: bio, avatar, highlights, and a 3-column grid of posts, carousels and reels. Arrange the grid, schedule posts on a calendar, then send the client a public **share link**. They review the feed exactly as it will look, then comment, approve or request changes without an account. You get an in-app notification when they respond. The app does **not** publish to Instagram.

## Two modes

| Mode | When | Data lives in |
|---|---|---|
| **Demo** | No Supabase env vars at build time | This browser only (IndexedDB + localStorage). Seeded with 3 sample clients |
| **Live** | `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` set at build time | Supabase: Auth, Postgres (with Row-Level Security), Storage, Realtime |

The mode is **frozen when the app is built** (`next.config.ts`). After adding, changing or removing the env vars, rebuild. A live-mode build has no "Continue in demo mode" button on `/login`.

## Quick start

Requires Node.js 20.9+ (developed on Node 24).

```bash
npm ci
cp .env.example .env.local     # leave the values blank for demo mode
npm run dev                    # http://localhost:3000 → "Continue in demo mode"
```

Production build: `npm run build && npm start`. Lint: `npm run lint`.

## Environment variables

See `.env.example`. Real values go in `.env.local`, which is git-ignored.

| Variable | Needed for | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Live mode | Inlined into the browser bundle at build time |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Live mode | Public key; data is protected by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Nothing | Not used by the app. Server-only secret: don't put it on Vercel |

On Vercel, set the two public variables for **every environment that builds**: Production, plus Preview if you test previews against Supabase.

## Setting up Supabase (live mode)

1. Create a Supabase project.
2. Apply the migrations in `supabase/migrations/` **in order** (SQL editor, `psql`, or `supabase db push`). Each later migration builds on the previous ones.
   - `0001`–`0005`: schema, RLS, storage buckets, content stage, video covers, review notifications.
   - `0006`–`0009`: share-link security, atomic writes, one-transaction client duplication, and timezone-free content days. Read the guides first ([0006](docs/MIGRATION_0006.md), [0007](docs/MIGRATION_0007.md), [0008](docs/MIGRATION_0008.md), [0009](docs/MIGRATION_0009.md)): they must be deployed **together with the matching app version**, and the guides give the safe order, verification and rollback.
3. Check each applied migration with its script in `supabase/verify/`. They are safe on production: everything is rolled back. Rollback scripts live in `supabase/rollback/`, deliberately outside `migrations/`.
4. In Supabase → Authentication → URL Configuration, set the **Site URL** to your deployment URL, so confirmation emails link back to the app.

There is no seed data for live mode; the sample clients exist only in demo mode.

## Tests

End-to-end tests use Playwright (desktop and mobile Chromium) with axe accessibility scans. They always run against a **demo-mode** build and never touch a Supabase project.

```bash
npx playwright install chromium   # once
npx playwright test               # builds + serves the app automatically
npx playwright show-report
```

Normal runs write screenshots and reports to `test-results/` and `playwright-report/`, both git-ignored. To refresh the committed screenshots in `docs/qa-evidence/`, set `UPDATE_QA_EVIDENCE=1`. Details: [`docs/PLAYWRIGHT_TESTING.md`](docs/PLAYWRIGHT_TESTING.md).

## Project structure

```
src/
  proxy.ts            Next.js 16 proxy (formerly middleware): session refresh + auth redirects (live mode)
  app/                Routes: (auth) login/signup · (dashboard) app pages · share/[shareToken] public review
  components/         instagram/ (pure profile/post UI) · posts/ · calendar/ · layout/ · ui/ …
  lib/repositories/   Repository interface + DemoRepository (IndexedDB) + SupabaseRepository
  lib/store/          Workspace store (useWorkspace / useMutate / useAction)
  lib/instagram/      Domain → Instagram view-model mappers
  types/domain.ts     Shared domain model
supabase/
  migrations/  verify/  rollback/
tests/e2e/            Playwright specs + fixture assets
docs/                 User manual, routes, known issues, migration guides, QA reports
```

All data access goes through the `Repository` interface, so any change to it must be made in **both** the demo and Supabase implementations.

## Documentation

- [Quick start guide](docs/QUICK_START_GUIDE.md) and [user manual](docs/USER_MANUAL.md)
- [Routes & features](docs/ROUTES_AND_FEATURES.md)
- [Known issues](docs/KNOWN_ISSUES.md)
- [Playwright testing](docs/PLAYWRIGHT_TESTING.md) and the [test matrix](docs/TEST_MATRIX.md)
- [Project audit](AUDIT.md)

> This project uses **Next.js 16**, which has breaking changes from earlier versions. The version-matched docs ship in `node_modules/next/dist/docs/`; see `AGENTS.md`.
