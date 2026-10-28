# Gridline Studio (ig-preview)

Plan, preview and approve Instagram content with your clients before it goes live.

Build a realistic copy of a client's Instagram profile: bio, avatar, highlights, and a 3-column grid of posts, carousels and reels. Arrange the grid, schedule posts on a calendar, then send the client a public **share link**. They review the feed exactly as it will look, then comment, approve or request changes without an account. Your team gets an in-app notification when they respond. The app does **not** publish to Instagram.

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
   - `0006`–`0009`: share-link security, atomic writes, one-transaction client duplication, and timezone-free content days.
   - `0010`: the team workspace with owner approval (see [Team and roles](#team-and-roles)).
   - `0011`: suspend / restore / remove members (deleting an account moves its clients to the owner), self-resolving sign-up notices, and a 30-day purge of read notifications.
   - **Deploying a release** ([`docs/DEPLOY_GUIDE.md`](docs/DEPLOY_GUIDE.md)): (1) if there is a migration, run it in the Supabase SQL Editor; (2) `git push origin main` — Vercel auto-deploys. Every migration is backward-compatible with the app in production, so it is always applied *before* the new code goes live.
3. Check each applied migration with its script in `supabase/verify/`. They are safe on production: everything is rolled back. Rollback scripts live in `supabase/rollback/`, deliberately outside `migrations/`.
4. In Supabase → Authentication → URL Configuration, set the **Site URL** to your deployment URL, so confirmation emails link back to the app.
5. Appoint the workspace owner (next section).

There is no seed data for live mode; the sample clients exist only in demo mode.

## Team and roles

Live mode is **one shared team workspace**: every approved account works on the same clients, posts, calendar, share links and notifications.

| | Owner (exactly one) | Member | Pending (new sign-up) |
|---|---|---|---|
| Clients, posts, calendar, share links | ✓ | ✓ | – |
| Delete clients | ✓ | – | – |
| **Team** page: approve / reject sign-ups; suspend, restore, remove members | ✓ | – | – |
| Sees | everything + sign-up notices | everything | only the "waiting for approval" screen |

Suspended accounts are like pending ones: they keep their account but see only a "Your access was suspended" screen (RLS blocks all data).

- **New sign-ups start pending.** The owner gets a notification and approves or rejects them on **Team**. Reject deletes the account (it can sign up again). The "waiting for approval" notice disappears for everyone once the account isn't pending any more, including after a change in the Table Editor.
- **Suspend / Restore / Remove** (owner only, never on the owner): Suspend blocks access but keeps the account; Restore gives it back; Remove deletes the account, and the clients that person created move to the owner. The database refuses to delete the owner's account, or any account while there is no owner, so a delete can never wipe the team's clients.
- **Roles are changed only in the Supabase dashboard,** never in the app or through the API. The database refuses role/status changes from API requests (privileges plus a guard trigger).
- **Appoint the owner:** *Table Editor* → `profiles` → the person's row → `role` = `owner` → *Save*. Or in the SQL editor:
  ```sql
  update public.profiles set role = 'owner' where email = 'owner@example.com';
  ```
  There can be only one owner. To hand over, demote the current one first, in the same run:
  ```sql
  update public.profiles set role = 'member' where role = 'owner';
  update public.profiles set role = 'owner' where email = 'new.owner@example.com';
  ```
- **Demo mode** plays the owner, with a seeded team (one member, two pending sign-ups). To see what a new account sees, use **Preview what a new account sees** on `/login`.

## Tests

| Command | What |
|---|---|
| `npm run test:unit` | Vitest unit tests (`tests/unit/`): dates, mappers, search, store ordering, the demo repository against an in-memory IndexedDB |
| `npm run test:e2e` | Playwright end-to-end tests (`tests/e2e/`, desktop + mobile Chromium, axe scans) against a **demo-mode** build. Run `npx playwright install chromium` once first |
| `npm run test:sql` | SQL/RLS tests: a throwaway PostgreSQL cluster (needs PostgreSQL 15+ binaries; set `PG_BIN` if they're not on `PATH`) that applies all migrations and runs the verify, rollback-chain and atomicity checks |
| `npm run test:live` | Live-mode tests (`tests/live/`) against a **local** Supabase (`supabase start`, Docker). They run in CI; the config refuses any non-local Supabase URL |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |

None of them ever touches a hosted Supabase project. GitHub Actions (`.github/workflows/ci.yml`) runs all of them on every push and pull request.

E2E runs write screenshots and reports to `test-results/` and `playwright-report/`, both git-ignored. To refresh the committed screenshots in `docs/qa-evidence/`, set `UPDATE_QA_EVIDENCE=1`. Details: [`docs/PLAYWRIGHT_TESTING.md`](docs/PLAYWRIGHT_TESTING.md).

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

All data access goes through the `Repository` interface, so any change to it must be made in **both** the demo and Supabase implementations (including the team rules: owner-only actions, pending accounts).

## Documentation

- [Quick start guide](docs/QUICK_START_GUIDE.md) and [user manual](docs/USER_MANUAL.md)
- [Routes & features](docs/ROUTES_AND_FEATURES.md)
- [Known issues](docs/KNOWN_ISSUES.md)
- [Playwright testing](docs/PLAYWRIGHT_TESTING.md) and the [test matrix](docs/TEST_MATRIX.md)
- [Project audit](AUDIT.md)

> This project uses **Next.js 16**, which has breaking changes from earlier versions. The version-matched docs ship in `node_modules/next/dist/docs/`; see `AGENTS.md`.
