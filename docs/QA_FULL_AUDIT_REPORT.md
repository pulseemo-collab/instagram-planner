# QA Full Audit Report — Gridline Studio

**Audit date:** July 17, 2026 · **Auditor:** automated Playwright suite + manual
browser verification · **App version:** current `main` working tree

---

## 1. Executive summary

Gridline Studio was audited end-to-end with a real browser (Playwright/Chromium) on
desktop (1440×900), tablet (768×1024), and mobile (iPhone 13 / 390px) viewports,
in demo mode locally and with a read-only smoke pass against the production Vercel
deployment (which runs in Supabase live mode).

**The application is functionally solid.** Every advertised workflow — client
management, Instagram-faithful profile editing, highlights, uploads, all three post
types, grid reordering (literal mouse drag verified), scheduling, public share
links, reviewer comments/approvals, cross-page status propagation, and demo-mode
persistence — works as described and survives refresh and browser restart.

**Six issues were confirmed during the audit — all six are now RESOLVED** (fix
pass of July 17, 2026; see §12 for the resolution log): the High-severity demo-
button dead-end on live deployments, the build/runtime mode-mismatch hazard, both
axe accessibility findings (unlabeled file inputs; muted-text contrast), the
calendar drag failure (root-caused during the fix pass to a React remount that
aborted real users' drags — not merely an automation quirk), and the mobile
workspace overflow. No data-loss, corruption, or crash-class defects were found.
Console and page-error monitoring across all routes recorded **zero significant
runtime errors** and no hydration failures.

**Verdict (post-fix): Ready.** The full 78-test Playwright suite, TypeScript,
ESLint, and the production build all pass; the axe gate now requires a fully
clean WCAG A/AA scan. Remaining items are documented product limitations
(§12b), not defects. The production deployment needs a **redeploy** to pick up
the fixes.

## 2. Scope

- All 13 routes (inventory in §5), all user roles (creator/demo, public reviewer,
  visitor; authenticated live user code-verified + redirect-verified only).
- Functional, persistence, responsive, accessibility, error/edge-case, console/
  network, and UX audits.
- Out of scope: authenticated writes against the production Supabase project
  (deliberately, to protect production data), real Instagram publishing (the product
  does not publish), load/performance benchmarking beyond qualitative observation.

## 3. Environment

| | Local | Production |
| --- | --- | --- |
| URL | http://localhost:3000 | https://instagram-planner-five.vercel.app |
| Mode | Demo (env vars blanked for the test server) | Live (Supabase configured) |
| Build | `next build` production build, `next start` | Vercel deployment |
| Browser | Chromium 149 (Playwright 1.58) headless | same |
| OS | Windows 11 | — |

Note: the working tree contains a `.env.local` with Supabase credentials. The test
server intentionally blanks these so the local audit covers demo mode; production
covers live mode. This mismatch surfaced BUG-002 (see Known Issues).

## 4. Test strategy

1. **Repository audit** to enumerate routes, roles, flows, and the persistence
   architecture (repository pattern: IndexedDB demo adapter / Supabase adapter).
2. **Automated Playwright suite** — 12 spec files, 78 tests (74 desktop + 4
   dedicated mobile), two projects with role/label-based selectors, per-context demo seeding
   (every test context starts from the deterministic seed), local media fixtures,
   trace/screenshot retention on failure, axe-core scans, and curated evidence
   screenshots written into `docs/qa-evidence/`.
3. **Manual browser verification** for exploratory checks and everything automation
   could not do faithfully (production smoke, drag-hang investigation).
4. **Static checks** — TypeScript, ESLint, production build.

## 5. Route inventory & results

| Route | Loads | Console clean | Overflow-free | Refresh-safe | Mobile | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `/login` | ✅ | ✅ | ✅ | ✅ | ✅ | validation verified |
| `/signup` | ✅ | ✅ | ✅ | ✅ | ➖ | name required verified |
| `/` (dashboard) | ✅ | ✅ | ✅ | ✅ | ✅ | live-derived stats |
| `/clients` | ✅ | ✅ | ✅ | ✅ | ✅ | full CRUD |
| `/clients/[id]` | ✅ | ✅ | ✅ | ✅ | ✅ | workspace, both modes |
| `/clients/[id]/posts/[id]` | ✅ | ✅ | ✅ | ✅ | ✅ | deep-link verified |
| `/content` | ✅ | ✅ | ✅ | ✅ | ✅ | filters + bulk |
| `/calendar` | ✅ | ✅ | ✅ | ✅ | ✅ | horizontal scroll container by design |
| `/previews` | ✅ | ✅ | ✅ | ✅ | ✅ | |
| `/settings` | ✅ | ✅ | ✅ | ✅ | ✅ | wipe/restore verified |
| `/preview` (playground) | ✅ | ✅ | ✅ | ✅ | ➖ | static sample |
| `/share/[token]` | ✅ | ✅ | ✅ | ✅ | ✅ | + invalid/disabled/expired states |
| unknown ids (`/clients/x`, `/posts/x`) | ✅ | ✅ | ✅ | ✅ | ➖ | friendly not-found states |

## 6. Feature results (highlights)

Full matrix: `docs/TEST_MATRIX.md`. Selected observations:

- **Instagram fidelity holds under data**: long names/bios wrap without breaking the
  phone layout; counts format like Instagram (9,540 / 24.3K / 1.2M); optional
  elements (note bubble, Threads badge, verified seal, private lock, story ring)
  toggle correctly; preview mode is chrome-free.
- **Grid engine**: literal Playwright mouse drag reordered tiles and the order
  survived reload; keyboard reordering (Ctrl+Arrows) works and is announced via
  aria-labels; pinned posts stay first; max-3 pin validation enforced.
- **Uploads**: bad type and oversize files rejected with visible reasons; removal
  before saving works; files persist as data URLs in demo mode after refresh.
- **Approvals loop**: a reviewer approval on the share page updated the post badge,
  dashboard "Awaiting approval" count, client-card roll-up, content page, and the
  activity feed — verified in one continuous browser session and after reload.
- **Timezone**: a post scheduled at 00:15 local renders on the chosen calendar day
  (no UTC shift).
- **Persistence**: IndexedDB data survived page reloads, full browser restarts, and
  server restarts; wipe/restore work as designed.

## 7. Desktop / tablet / mobile results

- **Desktop (1440×900):** all suites pass; no layout defects observed.
- **Tablet (768×1024):** dashboard and workspace overflow-free; workspace collapses
  to a single column below `lg`.
- **Mobile (390×844, iPhone 13 metrics on Chromium):** drawer navigation,
  workspace stacking, the share page, and dashboard/clients/content/previews/
  settings verified overflow-free; dialogs render as bottom sheets; the public
  share page is genuinely usable one-handed. **Exception:** the client workspace
  overflows horizontally by ~19px under device emulation (**BUG-006** — the
  393px phone frame exceeds the viewport; one-line `min-w-0` fix recommended).
  Mobile Safari was **not** tested (Chromium only) — see Limitations.

## 8. Browser coverage

Chromium (headless shell 149) only, per environment constraints. WebKit/Firefox not
installed; risk concentrated in drag-and-drop and `<dialog>`-free custom dialogs,
both of which use widely-supported APIs. Recommend a WebKit spot-check before a
public launch.

## 9. Accessibility results

Automated axe-core (WCAG 2.0/2.1 A+AA) on 5 representative routes, plus manual
keyboard checks:

- ✅ Skip link, Escape-to-close dialogs, focus return, aria-labels on icon buttons,
  switch/tab/radiogroup semantics, keyboard alternative for drag-and-drop,
  `useReducedMotion` support in animated components.
- ✅ **Post-fix:** the axe scan is fully clean on all five scanned routes. The
  original findings — `label` (critical) and `nested-interactive` (serious) in the
  upload dropzones (BUG-003), and `color-contrast` (serious) on muted text
  (BUG-004) — were fixed and re-verified; the automated gate now requires zero
  WCAG A/AA violations.
- Full machine output: `docs/qa-evidence/axe-results.json`.

## 10. Persistence results

| Scenario | Result |
| --- | --- |
| Reload every route mid-session | ✅ state intact |
| Full browser restart (new Playwright context, same storage dir not required — IndexedDB per context verified via reload; manual restart verified in exploratory pass) | ✅ |
| Server restart between actions | ✅ (IndexedDB is client-side) |
| Wipe → empty states everywhere → restore seed | ✅ |
| Unsaved profile draft on refresh | draft intentionally discarded; saved data intact (documented) |
| Grid order after reload | ✅ |
| Uploaded media after reload | ✅ (data URLs) |

## 11. Console / network results

- Console + `pageerror` monitored on every automated test via a shared helper;
  route-sweep tests assert **zero significant errors** (favicon/aborted-prefetch
  noise excluded by filter — none observed locally anyway).
- No hydration warnings, no React key warnings, no failed requests locally.
- Production: `/login`, `/signup`, `/share/*` error states loaded clean; the only
  console error observed in the whole audit was a transient `ERR_UNKNOWN_URL_SCHEME`
  from a pre-fix media reference in an earlier session — **not reproducible** in the
  audited build.
- Performance: production build routes render in well under a second locally; the
  largest payloads are demo data URLs (uploaded images) which stay client-side. No
  severe layout shifts observed; skeletons cover initial load.

## 12. Confirmed issues — resolution log

All six confirmed bugs were **fixed on July 17, 2026** (post-audit fix pass) and
re-verified with the Playwright suite. Implementation notes below; remaining
limitations follow in §12b.

| ID | Title | Severity | Status | Fix |
| --- | --- | --- | --- | --- |
| BUG-001 | Demo-mode button dead-ends on Supabase deployments | High | **RESOLVED** | The demo-entry section on `/login` and `/signup` renders only in demo-mode builds (`authMode() === "demo"` in `src/components/auth/auth-form.tsx`). Live builds show sign-in/sign-up only. |
| BUG-002 | Stale-build env mismatch (server live / client demo) | Medium | **RESOLVED** | Mode is now frozen at build time: `next.config.ts` inlines `NEXT_PUBLIC_BUILT_WITH_SUPABASE` into both bundles and `src/proxy.ts` activates only when that build flag is set (plus runtime keys). Runtime-only env edits can no longer split the modes; `.env.example` documents the rebuild requirement. |
| BUG-003 | Unlabeled file input + nested-interactive in upload dropzones | Medium | **RESOLVED** | `UploadDropzone` wraps the input in a `<label>` (native activation, accessible name, `focus-within` ring) instead of a `role="button"` div; the input also carries an explicit `aria-label`. axe scan is clean. |
| BUG-004 | Muted text failed WCAG AA contrast | Medium | **RESOLVED** | Design tokens darkened with measured contrast: `--color-ink-faint` → `#736d62` (4.6:1 on canvas, 5.1:1 on panel), `--color-ink-soft` → `#5f5a51` (6.1:1). Hierarchy preserved; axe `color-contrast` clean on all scanned routes. |
| BUG-005 | Calendar chips could not be dragged (pointer input aborted) | Low → **re-graded Medium** | **RESOLVED** | Deeper investigation during the fix pass found the real root cause: `PostChip` was defined *inside* the page component, so the drag-state update fired by `dragstart` changed its component identity and React **remounted the dragged DOM node mid-drag** — the browser then aborted the drag session (CDP-verified: `Input.dragIntercepted` never fired). This affected real users, not just automation. Fixed by hoisting `PostChip` to module scope (stable identity), converting it to a draggable `<button>` with programmatic navigation, and adding `dataTransfer.setData` payload per the HTML5 DnD spec. The calendar test now performs a **literal Playwright mouse drag** — verified passing with persistence after reload. |
| BUG-006 | Client workspace ~19px horizontal overflow on mobile | Medium | **RESOLVED** | `min-w-0` added to the phone-frame grid columns on `/clients/[id]` and `/clients/[id]/posts/[id]` (same pattern as the earlier share-page fix). Mobile overflow suite passes with both routes included. |

## 12b. Remaining issues

| ID | Title | Category | Status | Blocks release? |
| --- | --- | --- | --- | --- |
| LIMIT-001 | Demo share links are browser-local | Documented limitation | Confirmed | No |
| LIMIT-002 | Decorative top-bar search + notifications | UX | Confirmed | No |
| LIMIT-003 | Reposts/Tagged tabs always empty | UX | Confirmed | No |

## 13. Suggestions (not defects)

- **S-1:** Hide or repurpose the demo button in live mode (fixes BUG-001 trivially).
- **S-2:** When copying a demo-mode share link, show a one-time notice that the link
  only works in this browser (LIMIT-001 is currently discoverable only by failure).
- **S-3:** Wire the top-bar search to the clients/content search, or remove it until
  functional.
- **S-4:** Give the notification bell a panel fed by the activity feed, or remove
  the unread dot.
- **S-5:** Post-detail "View all N comments" is display-only; either open the
  feedback panel or drop the button in creator view.
- **S-6:** Add `Cache-Control`-safe empty-state illustration for the `/preview`
  playground or fold it into docs — it's easy to mistake for a product page.
- **S-7:** Consider `<dialog>` or a focus-trap utility for dialogs — focus can
  currently tab behind the overlay (minor, keyboard-recoverable).
- **S-8:** Duplicate-username creation is allowed (two clients can share an
  Instagram handle); a soft warning would prevent accidental duplicates.

## 14. Release readiness & final verdict

**Ready** (post-fix verdict; originally "Ready with minor fixes").

- All six confirmed bugs are fixed and re-verified with the automated suite —
  see §12. The fix pass changed only the targeted files; architecture, design
  language, and data model are untouched.
- The production deployment still runs the pre-fix build; **redeploy to ship the
  fixes** (in particular BUG-001's login-page correction).
- Remaining items (§12b) are documented limitations with suggestions attached,
  not defects.

## 15. Limitations of this audit

- Chromium only; no WebKit/Firefox/mobile-Safari runs.
- Live-mode authenticated flows (Supabase CRUD, storage uploads, RLS-scoped share
  reads) were **code-verified, not browser-verified**, because exercising them would
  write to the production Supabase project. The repository abstraction means demo
  verification covers the same UI logic, but Supabase-specific failures (RLS
  mismatches, storage policies) would not have surfaced here.
- Reel playback used a minimal generated WebM; long/real video behavior untested.
- No load testing; demo mode is single-user by design.
