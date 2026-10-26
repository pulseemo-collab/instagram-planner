# Project Audit — ig-preview ("Gridline Studio")

*Audit date: 2026-10-26 · Commit audited: `9272d8e` (main, clean tree) · Read-only review: no code was changed.*

Commands run during the audit were all read-only: `git log/ls-files`, `npm audit`, `npm outdated`, `npx eslint` (no `--fix`).
I did **not** run `next build` or `tsc` (both write files into the project), and I did not run the Playwright suite. So bundle-size and type-check results are not measured here.

---

## 1. OVERVIEW

**What it does.** Gridline Studio is a web app for planning Instagram content before it is published. You create a "client" (an Instagram account you manage). You edit a pixel-faithful mock of that client's Instagram profile: bio, avatar, highlights, and a 3-column grid of posts, carousels and reels. You can reorder the grid, schedule posts on a calendar, and send the client a public share link. The client opens the link, sees the planned feed as it will look on Instagram, and can comment, approve, or request changes without an account. The owner gets in-app notifications when the client responds.

**Who it's for.** Social-media managers, creators, and small agencies who need client sign-off on an Instagram feed. It does **not** publish to Instagram. It is a planning, preview and approval tool.

**Two run modes.**
- **Demo mode** (no env vars): everything lives in the browser (IndexedDB + localStorage). You sign in with "Continue in demo mode".
- **Live mode** (Supabase env vars set at *build* time): Supabase Auth, Postgres with Row-Level Security, Storage, and Realtime. The docs say production runs live mode on Vercel at `instagram-planner-five.vercel.app` (`docs/QA_FULL_AUDIT_REPORT.md:51`).

---

## 2. TECH STACK

| Area | What | Version (installed) |
|---|---|---|
| Framework | Next.js App Router (uses the new `proxy.ts` convention, which replaces `middleware.ts`) | 16.2.10 |
| UI runtime | React / React DOM | 19.2.4 |
| Language | TypeScript, `strict: true` | 5.9.3 |
| Styling | Tailwind CSS v4 via `@tailwindcss/postcss`; design tokens in `src/app/globals.css` `@theme` | 4.3.2 |
| Icons | `lucide-react` (v1 renamed many icons; see §11) | 1.24.0 |
| Animation | `motion` (Framer Motion successor). Used only in `app-shell.tsx` and `ui/fade-in.tsx` | 12.42.2 |
| Backend SDK | `@supabase/supabase-js` + `@supabase/ssr` (browser and cookie clients) | 2.110.6 / 0.12.3 |
| Fonts | `next/font/google`: Geist + Geist Mono | — |
| Lint | ESLint 9 flat config + `eslint-config-next` (core-web-vitals + TS) | 9.39.5 |
| E2E tests | Playwright + `@axe-core/playwright` (accessibility) | 1.61.1 / 4.12.1 |

**Database / services**
- **Supabase Postgres**: 10 tables (`profiles, clients, highlights, posts, post_media, comments, approvals, share_links, activity, notifications`) with RLS. Schema is in `supabase/migrations/0001–0005`.
- **Supabase Auth**: email + password.
- **Supabase Storage**: three **public** buckets: `avatars`, `highlights`, `post-media`.
- **Supabase Realtime**: notification inserts are streamed to the bell (`notification-bell.tsx:50-67`).
- **Browser APIs (demo mode)**: IndexedDB (`src/lib/idb.ts`), localStorage, BroadcastChannel (cross-tab sync), Canvas/`<video>` for extracting video cover frames (`src/lib/video-frames.ts`).
- There are **no** external APIs beyond Supabase. No Instagram API, no analytics, no email.

**Deployment.** The code has no deployment config: no `vercel.json`, Dockerfile, or CI workflows (`.github/` does not exist). The docs show it is deployed on **Vercel** in live mode. **Important:** demo vs. live mode is frozen at **build time** (`next.config.ts:10-19` inlines `NEXT_PUBLIC_BUILT_WITH_SUPABASE`). Changing env vars requires a rebuild or redeploy.

---

## 3. PROJECT STRUCTURE

```
ig-preview/
├── src/
│   ├── proxy.ts                 # Next 16 "proxy" (ex-middleware): Supabase session refresh + auth redirects (live mode only)
│   ├── app/                     # App Router routes (almost all pages are "use client")
│   │   ├── layout.tsx           # Root HTML, fonts, metadata
│   │   ├── globals.css          # Tailwind v4 + design tokens + Instagram theme vars
│   │   ├── (auth)/              # /login, /signup (shared centered card layout)
│   │   ├── (dashboard)/         # Authenticated app: layout = AuthGuard → ToastProvider → AppShell
│   │   │   ├── page.tsx         #   /            Overview dashboard
│   │   │   ├── clients/…        #   /clients, /clients/[clientId], /clients/[clientId]/posts/[postId]
│   │   │   ├── content/         #   /content     cross-client content library
│   │   │   ├── calendar/        #   /calendar    main planning workspace (728 lines)
│   │   │   ├── previews/        #   /previews    share-link management
│   │   │   ├── settings/        #   /settings
│   │   │   └── preview/         #   /preview     static design playground (mock data, not in nav)
│   │   └── share/[shareToken]/  # Public reviewer page (no auth)
│   ├── components/
│   │   ├── instagram/           # Pure presentational Instagram clone (profile, grid, post detail, icons)
│   │   ├── layout/              # AppShell, Sidebar, TopBar, NotificationBell
│   │   ├── posts/               # PostForm (single source of post editing), PostComposer (dialog), VideoCoverPicker, ReviewActivity
│   │   ├── workspace/           # ProfileEditor, HighlightsEditor
│   │   ├── calendar/ clients/ sharing/ uploads/ preview/ auth/ providers/
│   │   └── ui/                  # Button, Dialog, Field, Toast, Skeleton, EmptyState, …
│   ├── lib/
│   │   ├── repositories/        # ★ Persistence layer: Repository interface + Demo (IndexedDB) and Supabase implementations + seed data
│   │   ├── store/               # ★ Global workspace store (useSyncExternalStore) + hooks useWorkspace/useMutate
│   │   ├── instagram/           # Domain → Instagram view-model mappers (map-profile, map-post), formatters, mock profile
│   │   ├── supabase/            # Browser / server client factories, env helpers
│   │   ├── auth/session.ts      # Mode detection + demo session flag
│   │   ├── idb.ts uploads.ts video-frames.ts dates.ts derive.ts id.ts preferences.ts navigation.ts
│   └── types/domain.ts          # ★ Shared domain model (Client, Post, PostMedia, Comment, Approval, ShareLink, …)
├── supabase/migrations/         # 0001 schema+RLS+storage, 0002 post.name, 0003 content stage, 0004 video cover, 0005 notifications+triggers
├── tests/e2e/                   # 14 Playwright specs (~97 tests) + fixture assets
├── docs/                        # User manual, routes inventory, previous QA report, known issues, test matrix, screenshots
├── playwright-report/, test-results/, *.log   # Test output (committed to git; see §6)
└── public/                      # Default create-next-app SVGs (unused)
```

### How the parts connect

```
 Page / component  ──useWorkspace()──▶  workspaceStore (lib/store)  ──getRepository()──▶  Repository (interface)
        │                                     ▲                                          ├─ DemoRepository   → IndexedDB + BroadcastChannel
        └──useMutate(fn)──────────────────────┘  (runs fn(repo), then reloads             └─ SupabaseRepository → PostgREST / Storage / RPC
                                                  the ENTIRE snapshot)
 Domain objects ──▶ lib/instagram/map-*.ts ──▶ Ig* view models ──▶ components/instagram/* (pure UI)
```

- **Entry points:** `src/app/layout.tsx` (root), `src/app/(dashboard)/layout.tsx` (auth gate + shell), `src/app/share/[shareToken]/page.tsx` (public), and `src/proxy.ts` (runs on every request in live mode).
- **Repository selection:** `src/lib/repositories/index.ts:7-18` picks one singleton, Supabase if the env vars were present at build time and demo otherwise.
- **Auth:** live mode uses `proxy.ts`, which redirects users without a session to `/login?next=…`. Demo mode uses `AuthGuard` (client-side localStorage flag). Real data protection in live mode comes **only from Postgres RLS**, because all data access happens in the browser with the anon key.

### Data flow

1. **Load:** `useWorkspace()` → `workspaceStore.ensureLoaded()` → `repo.loadSnapshot()`. In live mode this is about 9 queries covering every client, post, media item, comment, approval, link, activity entry and notification the user owns. In demo mode it is one IndexedDB read. Then `resolveLocalMedia()` (`workspace-store.ts:77-96`) replaces demo `local:<id>` references with full base64 `data:` URLs.
2. **Process:** pages derive what they show from the snapshot (`lib/derive.ts`, `useMemo`). Instagram views go through `buildIgProfile` / `buildIgPostDetail`.
3. **Mutate:** `useMutate()(repo => repo.updatePost(...))` writes, then **reloads the full snapshot** (`workspace-store.ts:60-65`).
4. **Display:** the Instagram components render the view models. Media URIs can be `gradient:` (seed placeholder), `local:` (demo), or `https:` (Supabase public URL).
5. **Public review:** the share page calls `repo.resolveShareToken()`. In live mode this uses a client that sends an `x-share-token` header, which RLS reads through `current_share_client()`. Reviewer approvals and comments fire SECURITY DEFINER triggers (`0005`) that update the post status and notify the owner.

---

## 4. FEATURES

### Pages / routes

| Route | What it does | State |
|---|---|---|
| `/login`, `/signup` | Email/password (live) or "Continue in demo mode" | ✅ Working. ⚠ Open redirect via `?next=` (§7). ⚠ Signup with email confirmation enabled has no "check your inbox" message (`auth-form.tsx:196-208`) |
| `/` | Dashboard: counts, upcoming posts, recent activity | ✅ Only page that renders the load-error state (`page.tsx:62`) |
| `/clients` | List, search, filter, sort, create, edit, duplicate, delete | ✅ |
| `/clients/[clientId]` | Instagram workspace: edit/preview modes, profile editor, highlights CRUD and reorder, grid drag/keyboard reorder, share dialog | ✅ |
| `/clients/[clientId]/posts/[postId]` | Phone preview + inline PostForm. Converts calendar "content" into a real post | ✅ |
| `/content` | Cross-client library, filters, grid/list, bulk approve/delete | ✅ |
| `/calendar` | One client at a time. Content packages → drag to a day → create post. Month navigation | ✅ (touch devices use the Schedule dialog instead of drag) |
| `/previews` | All share links: copy, open, disable, regenerate | ✅ |
| `/settings` | Display name, "defaults", demo reset/wipe, sign out | ⚠ The "Defaults" section is **non-functional**: preferences are saved but never read (§4 unfinished) |
| `/preview` | Static design playground on mock data | ⚠ Leftover from early foundation work. Not in the sidebar, but reachable |
| `/share/[shareToken]` | Public review: view feed, comment, approve, request changes, approve-all | ✅ in demo (same browser only). ⚠ Several live-mode bugs (§7, §10) |

### Main components

`InstagramProfile`, `InstagramPostDetail`, `ProfileGrid` (drag and keyboard reorder), `PostForm` (611 lines; all post editing goes through it), `VideoCoverPicker` (483 lines; picks a frame or uploads a cover), `UploadDropzone` (files and recursive folder import, progress, retry), `NotificationBell` (Realtime / BroadcastChannel / refresh on focus), `ReviewActivity`, `ShareDialog`, `ProfileEditor`, `HighlightsEditor`, `AddContentDialog`.

### API endpoints

There are **no Next.js API routes, route handlers, or server actions.** The whole app is client-rendered. The "API" is Supabase, called directly from the browser:
- PostgREST tables (all 10 tables, protected by RLS)
- RPC `share_token_client(share_token)`: SECURITY DEFINER, callable by anyone (anon)
- Storage `upload` / `getPublicUrl` on the three public buckets
- Realtime channel `notifications-<userId>`
- Triggers `approvals_review_event`, `comments_review_event` (migration `0005`)

### Finished vs. unfinished

There are **no `TODO`/`FIXME`/`HACK` comments, no `any`, and no `@ts-ignore`** anywhere in `src`. ESLint passes cleanly. Unfinished or dead parts I found:

- **Settings → "Defaults"** (`settings/page.tsx:99-123`, `lib/preferences.ts`): "Default preview theme" and "Default approval flow" are written to localStorage but never read. New clients and share links ignore them (`share-dialog.tsx:224-225` always defaults to `true/true`).
- **Top-bar search** (`top-bar.tsx:39-50`): looks interactive and shows a ⌘K hint, but filters nothing. The mobile search button does nothing.
- **Comment "resolved" flag:** the data and repo methods exist, but no UI uses them (documented in `docs/KNOWN_ISSUES.md` LIMIT-004).
- **Reposts / Tagged tabs:** always empty (by design, LIMIT-003).
- **`/preview` route + `lib/instagram/mock-profile.ts` + `components/preview/*`**: playground left over from early development.
- **Dead code:** `src/components/ui/avatar.tsx` (never imported), `src/lib/supabase/server.ts` (`getServerSupabase` never used), `idbDeleteMedia` in `src/lib/idb.ts:99` (never called, which is why demo media is never cleaned up), `SUPABASE_SERVICE_ROLE_KEY` (declared in `.env.example`, used nowhere), and `public/*.svg` (create-next-app defaults).
- **README.md** is still the create-next-app boilerplate. The real docs live in `docs/`.
- **`docs/KNOWN_ISSUES.md` LIMIT-002 is outdated.** It says the notification bell "has no panel", but commit `9272d8e` made it fully functional.

---

## 5. HOW TO RUN IT LOCALLY

There is no `engines` field. The audit machine has Node 24.15 and npm 11.12. Next 16 needs Node ≥ 20.9.

```bash
# 1. Install (uses the committed package-lock.json)
npm ci

# 2a. DEMO MODE — no env vars needed. Data lives in your browser.
#     Note: you DO currently have Supabase values in .env.local, so to get demo
#     mode you must blank them in the shell (or move .env.local away) and rebuild.
npm run dev            # http://localhost:3000 → "Continue in demo mode"

# 2b. LIVE MODE — see the Supabase steps below, then:
npm run build && npm start   # mode is frozen at build time; always rebuild after env changes

# Lint
npm run lint

# E2E tests (builds and serves DEMO mode automatically, with Supabase vars blanked)
npx playwright install chromium
npx playwright test
# Smoke subset against a deployment:
PLAYWRIGHT_BASE_URL=https://<your-deployment> npx playwright test --grep @smoke --project=desktop
```

**Environment variables** (names only; `.env.local` currently has all three set):

| Name | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Live mode | Inlined into the browser bundle at build |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Live mode | Public key; security relies entirely on RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **No** | Not used by any code. Server-only secret. Should not be on disk unless needed |

**Extra steps for live mode**
1. Create a Supabase project.
2. Run the migrations **in order** (`0001` → `0005`) in the SQL editor, or with `supabase db push`. There is no `supabase/config.toml`, so you would need `supabase init` / `supabase link` first.
3. Make sure the `supabase_realtime` publication exists so notifications stream (migration `0005` adds the table only if it does).
4. There is no seed script for live mode. The seed (`src/lib/repositories/seed.ts`) is demo-only.
5. ⚠ **`.env.example` is not in git.** `.gitignore:34` ignores `.env*`, which also matches `.env.example`. A fresh clone has no template. Recreate it from the table above.

---

## 6. CODE QUALITY

**Strengths**
- Clear architecture: one `Repository` interface with two interchangeable backends. UI never talks to storage directly, domain types are centralized, and the Instagram UI is pure presentation behind view-model mappers.
- TypeScript strict, no `any`, no suppressed type errors. ESLint is clean (4 justified `no-img-element` disables).
- Comments explain *why*, not just *what* (for example, the build-time mode freeze and the render-phase state sync).
- Accessibility is clearly considered: ARIA labels, keyboard grid reorder, an axe test gate.
- Migrations are additive and well commented. RLS is enabled on every table.

**Weaknesses**
- **Large files:** `supabase-repository.ts` (759), `calendar/page.tsx` (728), `post-form.tsx` (611), `demo-repository.ts` (567), `video-cover-picker.tsx` (483), `share/[shareToken]/page.tsx` (458), `content/page.tsx` (427). The calendar page mixes data shaping, drag-and-drop, dialogs and three module-level components in one file.
- **Duplicated code:**
  - The `local:` → data-URL resolution exists twice: `workspace-store.ts:77-96` and `share/[shareToken]/page.tsx:91-102`. Only one copy is used on refresh, which caused a bug (§10).
  - The Supabase `post_media` row-building block is copy-pasted (`supabase-repository.ts:429-441` and `:467-479`).
  - Reviewer-response logic (status change + notification + activity) is implemented twice: in TypeScript for demo (`demo-repository.ts:492-559`) and in SQL triggers for live (`0005`). The two can drift. For example, demo checks `allowComments` and `allowApproval`, while live RLS does not.
  - Email regexes are duplicated in `auth-form.tsx:152`, `share/page.tsx:51`, and the SQL checks.
- **Error handling is inconsistent.** Many `mutate()` calls have no `try/catch`, so a failure becomes an unhandled promise rejection with no toast. Examples: `calendar/page.tsx:359,376,388`, `clients/[clientId]/page.tsx:92`, `share-dialog.tsx:232,314,323`, `settings/page.tsx:47`, `previews/page.tsx:122,131`. Some Supabase calls also ignore their returned `error`: `reorderHighlights` `:408-414`, `reorderPosts` `:485-491`, and the post-status update in `recordApproval` `:542`.
- **Load-error UI is missing.** If the first snapshot load fails, `status` becomes `"error"` with `snapshot === null`. Every page except the dashboard then shows `PageSkeleton` **forever** (for example `settings/page.tsx:32`, `calendar/page.tsx:286`).
- **Hydration risk:** several `useState` initializers read `localStorage`/`sessionStorage` behind `typeof window` checks (`calendar/page.tsx:229-232`, `share/page.tsx:61`, `settings/page.tsx:25`). The server and client can render different initial HTML.
- **Tests:** 14 Playwright E2E specs (~97 tests, including mobile and axe). The last recorded run passed 85 tests with 1 flaky test (`09-content-calendar.spec.ts:6`). However:
  - **No unit tests** (no Vitest/Jest), even though `dates.ts`, `derive.ts`, `uploads.ts`, the mappers and both repositories are easy to unit-test.
  - The local suite **only covers demo mode** (`playwright.config.ts:52-59` blanks the Supabase vars). The live Supabase repository, RLS policies and triggers have **no automated tests**, and that is where most of the serious bugs in this audit are.
  - No CI pipeline runs lint or tests.
- **Repo hygiene:** generated output is committed: `playwright-report/index.html` (540 KB), `playwright-final-*.log`, `tests/e2e/playwright-run3.log`, `test-results/.last-run.json`, and ~40 screenshots in `docs/qa-evidence` (the `.git` folder is 17 MB). Earlier commits also added and removed trace zips.

---

## 7. SECURITY

**Secrets**
- ✅ **No secrets are committed.** I scanned the full git history for JWTs, `sb_secret_`/`sb_publishable_` keys, `*.supabase.co` hosts, and AWS/Stripe patterns: nothing found. `.env.local` is git-ignored and was never committed.
- ⚠ `.env.local` holds a **`SUPABASE_SERVICE_ROLE_KEY`** that no code uses. This key bypasses RLS. If it isn't needed, delete it locally and rotate it in Supabase if it was ever shared.

**Authorization and RLS (live mode)**. These are the serious items:
1. **Share-link permissions are not enforced on the server.** The policies `comments shared insert` and `approvals shared insert` (`0001_init.sql:312-313, 320-321`) only check that the token is valid. They do **not** check `share_links.allow_comments` or `allow_approval`. On top of that, `SupabaseRepository.resolveShareToken` hardcodes `allowComments: true, allowApproval: true, expiresAt: null` (`supabase-repository.ts:704-712`). As a result, a "comments off" or "approvals off" link in production **still shows the Approve/Comment buttons, and they work.** Anyone with the link can also call the API directly.
2. **The share client is not isolated.** `shareRequest()` (`supabase-repository.ts:660-670`) calls `createBrowserClient(...)` without `isSingleton: false`. In `@supabase/ssr` 0.12.3, browser clients are a cached **singleton** (`node_modules/@supabase/ssr/dist/main/createBrowserClient.js:13-17`). So:
   - (a) If a Supabase client already exists in the tab, the `x-share-token` header is silently dropped.
   - (b) Whichever client is created first carries that token header for the rest of the session.
   - (c) `resolveShareToken` picks the client with `clients.select('*').limit(1)` (`:674`) and relies on RLS to return only one row. A signed-in owner opening their own share link passes **both** the owner policy and the share policy, so the page can show a **different client** than the one the link points to.
3. **Share links expose more than the feed.** The `* shared read` policies return every post of the client, including designer `stage = 'content'` drafts (filtered out only in the UI). They also return every comment and approval, **including reviewer email addresses**, to anyone holding the link.
4. **Anonymous writes have no rate limit.** Anyone with a token can insert unlimited comments and approvals, and each comment creates an owner notification (deduplication only catches identical text within 30 s, `0005:58-64`). Anonymous inserts may also set `resolved = true` on comments.
5. **Storage:** all three buckets are `public = true` (`0001_init.sql:335-339`), so all client media is readable by anyone who has the URL. There are no bucket-level `file_size_limit` or `allowed_mime_types` values. The 12 MB / 25 MB and type checks exist only in the browser (`lib/uploads.ts`), so a signed-in user can upload any file of any size through the API.

**Other**
6. **Open redirect after login:** `auth-form.tsx:172` takes `?next=` unvalidated, and `:207`/`:218` pass it to `router.replace`. A link like `/login?next=https://evil.example` sends the user to an external site right after a real sign-in.
7. **Proxy-bypass CVE:** the installed `next@16.2.10` has a **critical** advisory, "Middleware / Proxy bypass in App Router applications" (plus a Server Actions DoS). In this app the proxy only performs redirects and RLS protects the data, so the real-world impact is limited. Still, upgrade (non-breaking minor, 16.4.3).
8. Input validation is reasonable: SQL `CHECK` constraints on lengths and emails, React escaping everywhere, no `dangerouslySetInnerHTML`, and the website link is forced to `https://` (`profile-bio.tsx:38`). Share tokens are 24 chars from `crypto.getRandomValues` (~142 bits). There is a negligible modulo bias at `id.ts:17`.

**`npm audit`:** 10 vulnerabilities (1 critical, 8 high, 1 moderate).

| Package | Sev. | Direct? | Notes / fix |
|---|---|---|---|
| `next` 16.2.10 | **critical** | yes | Proxy bypass, Server Actions DoS → upgrade to **16.4.3** (semver-minor) |
| `postcss`, `sharp` | high | via next | Fixed by the same Next upgrade |
| `brace-expansion`, `js-yaml`, `browserslist`, `nanoid`, `source-map-js`, `zod` | high | transitive (mostly ESLint/tooling) | `npm audit fix` (dev-tooling; low runtime exposure) |
| `baseline-browser-mapping` | moderate | transitive | `npm audit fix` |

---

## 8. PERFORMANCE

- **Every mutation reloads the entire workspace** (`workspace-store.ts:60-65`). In live mode that is about 9 PostgREST queries over all of the user's data (`supabase-repository.ts:246-300`) for something as small as marking one notification read. The bell also triggers a full reload **on every window focus** (`notification-bell.tsx:80`) and on every Realtime event. This grows linearly with data and will be the first thing to hurt at scale.
- **Concurrent refreshes are not ordered.** Two quick mutations can resolve out of order, and an older snapshot can overwrite a newer one.
- **Demo mode keeps all media in memory as base64.** The whole state blob is re-written to IndexedDB on every mutation, and `structuredClone`d on every load. Combined with the data-URL write-back bug (§10 #4), this gets slow quickly with videos.
- **Images are served at full resolution.** User uploads (up to 12 MB images) render as small grid tiles through a plain `<img>` (`media-art.tsx:17`), with no resizing, `loading="lazy"`, or `srcset`. Supabase image transformations or `next/image` with a remote loader would help.
- **The proxy calls `supabase.auth.getUser()` on every request** (`proxy.ts:40`). That is a network round-trip to Supabase Auth per page navigation. This is the Supabase-recommended pattern, but worth knowing about.
- **Supabase `duplicateClient`** (`supabase-repository.ts:341-369`) reloads the full snapshot and then inserts highlights and posts **one by one, sequentially**.
- Minor: `coverMediaFor` filters the whole media array once per calendar chip and grid tile (O(posts × media)). `profile-editor.tsx:41` calls `JSON.stringify` on the draft every render, and the draft can contain multi-MB data URLs in demo mode.
- Bundle size was **not measured** (it requires `next build`). The heaviest client dependencies are `motion` and the Supabase SDK, which is loaded lazily via dynamic `import()` (good).

---

## 9. DEPENDENCIES

From `npm outdated` (current → latest):

| Package | Current | Latest | Gap |
|---|---|---|---|
| `next` / `eslint-config-next` | 16.2.10 | 16.4.3 | 2 minors (**security fix**) |
| `react` / `react-dom` | 19.2.4 | 19.3.1 | 1 minor (pinned exactly in package.json) |
| `@supabase/supabase-js` | 2.110.6 | 2.118.0 | 8 minors |
| `@supabase/ssr` | 0.12.3 | 0.12.7 | patches |
| `lucide-react` | 1.24.0 | 1.61.0 | 37 minors (icon renames happen often; check before bumping) |
| `motion` | 12.42.2 | 14.6.0 | **2 majors** |
| `typescript` | 5.9.3 | 7.0.2 | **2 majors** (TS 7 is the Go-based compiler; don't bump casually) |
| `eslint` | 9.39.5 | 10.13.0 | 1 major |
| `@types/node` | 20.19.43 | 26.6.5 | major (keep matched to your Node runtime) |
| `@playwright/test` | 1.61.1 | 1.64.1 | 3 minors |
| `@axe-core/playwright` | 4.12.1 | 4.14.0 | 2 minors |
| `tailwindcss` / `@tailwindcss/postcss` | 4.3.2 | 4.3.3 | patch |
| `@types/react` / `@types/react-dom` | 19.2.x | 19.3.0 | minor |

**Unused packages:** none of the npm dependencies are unused. All 7 runtime deps are imported. `motion` is used in only two small places (`app-shell.tsx`, `fade-in.tsx`); you could drop it if you want a smaller bundle. Unused *project* assets: `public/*.svg`, `ui/avatar.tsx`, `lib/supabase/server.ts`.

---

## 10. ISSUES FOUND

| # | Issue | File:line | Severity | Suggested fix |
|---|---|---|---|---|
| 1 | `next@16.2.10` has a critical advisory (proxy bypass, Server Actions DoS) and pulls in vulnerable `postcss`/`sharp` | `package.json:16` | **Critical** | Upgrade `next` + `eslint-config-next` to 16.4.3, then run `npm audit fix` for tooling |
| 2 | Share-link "comments off / approvals off" is not enforced in live mode: RLS ignores the flags **and** the UI hardcodes them to `true` | `supabase/migrations/0001_init.sql:312-313,320-321`; `src/lib/repositories/supabase-repository.ts:704-712` | **High** | New migration: add `allow_comments`/`allow_approval` checks to the insert policies (via a SECURITY DEFINER helper). Add an RPC that returns the link's real flags and `expires_at`, and use it instead of the hardcoded object |
| 3 | Share client reuses the `@supabase/ssr` browser singleton, so the `x-share-token` header can be dropped or leak into the main client. `select … limit(1)` can show the wrong client to a signed-in viewer | `supabase-repository.ts:660-674` | **High** | Pass `isSingleton: false` (or use plain `createClient` from supabase-js with `persistSession: false`). Filter `clients` by the id returned from `share_token_client` instead of `limit(1)` |
| 4 | Demo mode: the store turns `local:` refs into base64 `data:` URLs, and the edit forms save those back. Each edit of a post, avatar or highlight inlines the full media into the state blob and orphans the original entry, so IndexedDB grows until it slows down or hits quota | `src/lib/store/workspace-store.ts:77-96` → `src/components/posts/post-form.tsx:104-118,261-271`, `src/components/workspace/profile-editor.tsx:51`, `src/components/clients/client-form-dialog.tsx:50`, `src/components/workspace/highlights-editor.tsx:49` | **High** | Keep the original reference next to the display URL (for example `displayUrl` vs `url`), or have the store map data URLs back to `local:` refs before saving. Add a test that asserts the stored state contains no `data:` URLs after an edit |
| 5 | Share links expose content-stage drafts, all comments, and reviewer emails to anyone holding the token | `0001_init.sql:293-294,310-311,318-319` | Medium | Add `stage = 'post'` to the shared posts policy. Expose comments/approvals to reviewers through a view or RPC without emails |
| 6 | Open redirect after login via `?next=` | `src/components/auth/auth-form.tsx:172,207,218` | Medium | Accept only same-origin paths: `next.startsWith("/") && !next.startsWith("//")`, otherwise `/` |
| 7 | Public storage buckets with no server-side size or MIME limits | `0001_init.sql:335-359`; `supabase-repository.ts:632` | Medium | Set `file_size_limit` and `allowed_mime_types` on the buckets. Consider private buckets with signed URLs for unapproved client media |
| 8 | No rate limiting on anonymous comment/approval inserts (notification spam), and anon can set `resolved = true` | `0001_init.sql:312-321`; `0005_review_notifications.sql:106-129` | Medium | Route public writes through a SECURITY DEFINER RPC that validates fields and throttles per token. Force `resolved = false` |
| 9 | Load failure shows an infinite skeleton on every page except the dashboard | e.g. `src/app/(dashboard)/settings/page.tsx:32`, `calendar/page.tsx:286` | Medium | Handle `status === "error"` once in `AppShell` (error panel + retry) |
| 10 | Many `mutate()` calls have no error handling (unhandled rejection, no feedback). Some Supabase calls ignore their `error` | `calendar/page.tsx:359,376,388`; `clients/[clientId]/page.tsx:92`; `share-dialog.tsx:232,314,323`; `settings/page.tsx:47`; `previews/page.tsx:122,131`; `supabase-repository.ts:408-414,485-491,542` | Medium | Make `useMutate` show an error toast centrally. Check every Supabase `error` |
| 11 | `setPostMedia` (live) deletes all media, then inserts. If the insert fails, the post loses all its media | `supabase-repository.ts:458-483` | Medium | Do it in one Postgres function (transaction) via RPC, or insert the new rows before deleting the old ones |
| 12 | Share page `refreshBundle()` skips the `local:` resolution, so in demo mode images and videos break after any reviewer action | `src/app/share/[shareToken]/page.tsx:162-166` | Medium | Reuse one shared `resolveBundleMedia()` helper for the initial load and refreshes |
| 13 | "Approve all pending" also approves `not_sent` items and content-stage packages, ignores `ShareError` results, and always reports success | `share/[shareToken]/page.tsx:243-264` | Medium | Filter to `stage === "post" && approvalStatus === "awaiting_approval"` (matching `pendingCount`, `:274`). Count actual successes |
| 14 | Demo multi-tab data loss: only reviewer actions broadcast. A second tab keeps stale in-memory state and its next save overwrites the whole snapshot | `src/lib/repositories/demo-repository.ts:83-102` (broadcast only at `:523,:557`) | Medium | Call `broadcast()` in `persist()`, or re-read IndexedDB before each write |
| 15 | Full snapshot reload after every mutation and on every window focus | `src/lib/store/workspace-store.ts:60-65`; `src/components/layout/notification-bell.tsx:80` | Medium | Patch the snapshot locally from mutation results. Throttle focus refreshes. Later, move to per-entity queries (e.g. TanStack Query) |
| 16 | `.env.example` is git-ignored (`.env*`), so fresh clones have no env template | `.gitignore:34` | Medium | Add `!.env.example` to `.gitignore` and commit the file |
| 17 | Live-mode repository, RLS, and triggers have zero automated tests. The local suite covers demo mode only | `playwright.config.ts:52-59` | Medium | Add a Supabase-local (`supabase start`) test project, plus pgTAP or SQL tests for the policies |
| 18 | Content dropped on a day is stored as local midnight in UTC ISO, so it can show on a different day in another timezone | `calendar/page.tsx:358`; `src/lib/dates.ts` | Low | Store day-only values as a `date` / `YYYY-MM-DD` string, separate from the publish timestamp |
| 19 | Media is never deleted: IndexedDB `idbDeleteMedia` is unused, and Storage objects stay after post or client deletion | `src/lib/idb.ts:99`; `demo-repository.ts:181-194,296-306` | Low | Delete media on post/client delete and on `setPostMedia` replacement |
| 20 | Supabase `duplicateClient` is sequential, not transactional, and reloads the full snapshot | `supabase-repository.ts:341-369` | Low | Move it into a Postgres function |
| 21 | Settings "Defaults" are saved but never used | `src/app/(dashboard)/settings/page.tsx:99-123`; `src/lib/preferences.ts` | Low | Wire them into `ClientFormDialog` and `ShareDialog`, or remove the section |
| 22 | Top-bar search is decorative | `src/components/layout/top-bar.tsx:39-58` | Low | Implement it or remove it |
| 23 | Dead code: `ui/avatar.tsx`, `lib/supabase/server.ts`, `/preview` route + mock profile, `public/*.svg`, unused `SUPABASE_SERVICE_ROLE_KEY` | various | Low | Delete (and remove the service key from `.env.local` if not needed) |
| 24 | Generated test output and logs committed to git | `playwright-report/`, `test-results/`, `*.log`, `tests/e2e/playwright-run3.log` | Low | Add them to `.gitignore` and `git rm --cached` |
| 25 | Signup doesn't handle email-confirmation flows (no session, so the user bounces back to /login silently) | `auth-form.tsx:196-208` | Low | If `data.session` is null after `signUp`, show "Check your email" |
| 26 | Storage reads in `useState` initializers can cause hydration mismatches | `calendar/page.tsx:229-232`; `share/page.tsx:61`; `settings/page.tsx:25` | Low | Read in an effect, or use `useSyncExternalStore` with a server snapshot |
| 27 | README is create-next-app boilerplate. KNOWN_ISSUES LIMIT-002 is outdated | `README.md`; `docs/KNOWN_ISSUES.md` | Low | Write a real README (modes, env, migrations, tests). Update the known issues |
| 28 | Upload error text says "MP4/WebM" but MOV is also accepted | `src/lib/uploads.ts:23` | Low | Update the copy |

---

## 11. RECOMMENDATIONS

### Top 5 to fix before adding new features
1. **Upgrade Next.js to 16.4.3 and run `npm audit fix`** (#1). It's a minor bump. Re-run the Playwright suite afterwards.
2. **Fix the share-link security and correctness cluster in live mode** (#2, #3, #5, #8). This is production, and the approval workflow is the core of the product. One new migration (`0006_share_permissions.sql`) plus an isolated, non-singleton share client covers it.
3. **Fix the demo-mode data-URL write-back** (#4), along with the related share-page refresh bug (#12). Otherwise demo data degrades with every edit.
4. **Centralize error handling** (#9, #10, #11): an error state in `AppShell`, an error toast in `useMutate`, and atomic `setPostMedia`. Silent failures are currently the most likely source of "I saved it and it's gone" reports.
5. **Fix the open redirect and repo setup** (#6, #16): validate `?next=`, commit `.env.example`, and write a real README so the project can be set up from a fresh clone.

### Improvements for later
- Add unit tests (Vitest) for `dates.ts`, `derive.ts`, `uploads.ts`, the mappers and `DemoRepository`. Add a live-mode test project against `supabase start`, plus SQL policy tests.
- Add CI (GitHub Actions: lint, type-check, build, Playwright) and stop committing test output.
- Replace "reload the whole snapshot" with targeted updates or a query cache. Add pagination before clients grow to hundreds of posts.
- Serve resized images (Supabase image transforms) and lazy-load grid tiles.
- Consider private storage buckets with signed URLs, since unapproved client content is currently world-readable by URL.
- Split `calendar/page.tsx`, `post-form.tsx` and `supabase-repository.ts` into smaller modules (for example, extract row mappers and a drag-and-drop hook).
- Finish or remove the half-features: search, settings defaults, comment resolve UI, the `/preview` playground.
- Warn users that demo share links only work in their own browser (LIMIT-001).

### What to be careful about (most fragile areas)
- **Build-time mode freeze** (`next.config.ts`, `proxy.ts`, `lib/supabase/env.ts`). Any env change needs `npm run build`. Your `.env.local` currently points at a real Supabase project, so `npm run dev` / `build` will run **live mode against that project**. Make sure that's what you want before testing destructive actions.
- **The two repositories must stay behaviourally identical.** Any change to `Repository` (`lib/repositories/types.ts`) has to be implemented in both `demo-repository.ts` and `supabase-repository.ts`. Reviewer logic is also duplicated in SQL triggers (`0005`). The E2E tests only exercise the demo version.
- **Media URI conventions** (`gradient:` / `local:` / `data:` / `https:`): `parseMediaRef`, `resolveLocalMedia`, and every form that saves media rely on them. This is where bug #4 lives.
- **RLS is the only security boundary in live mode.** All reads and writes come from the browser with the anon key, so any new table or column needs policies. Never edit applied migrations; add `0006+`.
- **Render-phase state syncs** (`post-form.tsx:147-151`, `share/page.tsx:75-80`) and the draft-emitting effect in `PostForm` (`:170-188`) are deliberately written to avoid React "setState during render" errors. Refactor them carefully.
- **Dates:** scheduling is stored as ISO built from local wall-clock time, with DD/MM/YYYY input parsing in `lib/dates.ts`. Timezone changes are easy to get subtly wrong.
- **`lucide-react` v1:** old icon aliases were removed (e.g. `MoreHorizontal`→`Ellipsis`, `CheckCircle2`→`CircleCheck`). Check names in `node_modules/lucide-react/dist/lucide-react.d.ts` when upgrading.
- **Next 16 conventions** (`proxy.ts` instead of `middleware.ts`, etc.). As `AGENTS.md` says, check `node_modules/next/dist/docs/` before writing Next-specific code. After moving or deleting route files, delete `.next/` before building, or stale generated types will fail the type-check.
