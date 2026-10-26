# Test Matrix — Gridline Studio QA Audit

Legend: ✅ verified in browser · 🟡 partially verified (see note) · 📄 code-verified
only · ➖ not applicable. "Demo" = local demo-mode server; "Live" = Supabase mode
(production deployment, read-only smoke; authenticated live flows were **not**
exercised to protect production data).

| Feature | Route | Desktop | Tablet 768 | Mobile 390 | Demo | Live | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Redirect to login when signed out | `/` | ✅ | ➖ | ✅ | ✅ | ✅ | Pass | Proxy (live) and client guard (demo) both verified |
| Login validation | `/login` | ✅ | ➖ | ✅ | ✅ | 🟡 | Pass | Live invalid-credentials path code-verified only |
| Signup validation | `/signup` | ✅ | ➖ | ➖ | ✅ | 🟡 | Pass | No live account created (production safety) |
| Demo entry + session persistence | `/login` | ✅ | ➖ | ✅ | ✅ | ➖ | Pass | BUG-001 fixed: demo entry hidden entirely in live-mode builds |
| Sign out | `/settings` | ✅ | ➖ | ➖ | ✅ | 📄 | Pass | |
| Dashboard stats derived from data | `/` | ✅ | ✅ | ✅ | ✅ | 📄 | Pass | Counts change verified after approval |
| Client cards → workspace | `/` | ✅ | ➖ | ➖ | ✅ | 📄 | Pass | |
| Sidebar collapse / mobile drawer | shell | ✅ | ✅ | ✅ | ✅ | 📄 | Pass | Escape + backdrop close verified |
| Client list search/filter/sort | `/clients` | ✅ | ➖ | ✅ | ✅ | 📄 | Pass | |
| Create client (+avatar upload) | `/clients` | ✅ | ➖ | ➖ | ✅ | 📄 | Pass | Navigates to new workspace |
| Client validation | `/clients` | ✅ | ➖ | ➖ | ✅ | 📄 | Pass | Name + username format |
| Duplicate / delete client (confirm + cancel) | `/clients` | ✅ | ➖ | ➖ | ✅ | 📄 | Pass | |
| Independent client data | `/clients/[id]` | ✅ | ➖ | ➖ | ✅ | 📄 | Pass | Two fresh clients cross-checked |
| Profile editing, live preview, persistence | `/clients/[id]` | ✅ | ✅ | ✅ | ✅ | 📄 | Pass | All fields incl. counts formatting |
| Edit vs preview mode | `/clients/[id]` | ✅ | ➖ | ✅ | ✅ | 📄 | Pass | Preview strips all app chrome |
| Light/dark phone theme | `/clients/[id]` | ✅ | ➖ | ✅ | ✅ | 📄 | Pass | Screenshots in evidence |
| Note bubble / Threads badge / lock / story ring | `/clients/[id]` | ✅ | ➖ | ➖ | ✅ | 📄 | Pass | Optional elements toggle correctly |
| Highlights CRUD + reorder + persistence | `/clients/[id]` | ✅ | ➖ | ➖ | ✅ | 📄 | Pass | Arrow-button reordering |
| Upload validation (type/size), retry, remove | composer | ✅ | ➖ | ➖ | ✅ | 📄 | Pass | JPG/PNG/WEBP/WebM fixtures + .txt reject |
| Single-image post (caption/hashtags/emoji) | composer | ✅ | ➖ | ➖ | ✅ | 📄 | Pass | Hashtags normalized |
| Carousel create/reorder/remove slides | composer | ✅ | ➖ | ➖ | ✅ | 📄 | Pass | Min-2-slides validation |
| Reel with video + cover | composer | ✅ | ➖ | ➖ | ✅ | 📄 | Pass | Tiny WebM fixture; real-video playback 🟡 |
| Pinned posts + max-3 validation | composer | ✅ | ➖ | ➖ | ✅ | 📄 | Pass | Toggle disables at limit |
| Grid mouse drag (literal pointer) | `/clients/[id]` | ✅ | ➖ | ➖ | ✅ | 📄 | Pass | Real `dragTo`, order persists reload |
| Grid keyboard reorder (Ctrl+Arrows) | `/clients/[id]` | ✅ | ➖ | ➖ | ✅ | 📄 | Pass | |
| Grid <3 posts left-aligned | `/clients/[id]` | ✅ | ➖ | ➖ | ✅ | 📄 | Pass | |
| Phone tabs (Posts/Reels/Reposts/Tagged) | `/clients/[id]` | ✅ | ➖ | ➖ | ✅ | 📄 | Pass | Reposts/Tagged always empty (LIMIT-003) |
| Post detail (single/carousel/reel) | `/clients/[id]/posts/[id]` | ✅ | ➖ | ✅ | ✅ | 📄 | Pass | Deep link + refresh verified |
| Creator approval actions + resolve comments | post detail | ✅ | ➖ | ➖ | ✅ | 📄 | Pass | |
| Content filters/search/views | `/content` | ✅ | ➖ | ✅ | ✅ | 📄 | Pass | Combined filters + clear |
| Bulk select / approval / delete | `/content` | ✅ | ➖ | ➖ | ✅ | 📄 | Pass | |
| Calendar single-client selection + persisted switcher (no "All clients") | `/calendar` | ✅ | ➖ | ✅ | ✅ | 📄 | Pass | Selection state → picker; localStorage persistence |
| Post package creation (required name; 1..n original files = one package) | `/calendar` | ✅ | ➖ | ➖ | ✅ | 📄 | Pass | Multi-file stays one card ("3 files") |
| Original-media integrity (stored bytes = uploaded bytes) | `/calendar` | ✅ | ➖ | ➖ | ✅ | 📄 | Pass | Byte-for-byte base64 comparison in demo path; live path passes the File object straight to Storage (code-verified) |
| Posts section filters (All/Unscheduled/Scheduled); scheduled stays listed | `/calendar` | ✅ | ➖ | ✅ | ✅ | 📄 | Pass | |
| Calendar drag: card→day, day→day, drop-to-unschedule | `/calendar` | ✅ | ➖ | 🟡 | ✅ | 📄 | Pass | Literal Playwright mouse drags; touch uses the Schedule dialog fallback |
| Schedule dialog fallback (touch/keyboard) + multiple posts per day | `/calendar` | ✅ | ➖ | ➖ | ✅ | 📄 | Pass | Two chips stacked on one day verified |
| Inline post editor beside preview (no modal; no Feedback/Approval cards) | post detail | ✅ | ➖ | ✅ | ✅ | 📄 | Pass | Live caption preview + persistence verified |
| Calendar month nav / Today | `/calendar` | ✅ | ➖ | ✅ | ✅ | 📄 | Pass | |
| Local-timezone scheduling (no UTC shift) | `/calendar` | ✅ | ➖ | ➖ | ✅ | 📄 | Pass | 00:15 stays on chosen day |
| Share link create/expiry/toggles/regenerate | share dialog | ✅ | ➖ | ➖ | ✅ | 📄 | Pass | |
| Previews page statuses + actions | `/previews` | ✅ | ➖ | ✅ | ✅ | 📄 | Pass | Active/Disabled/Expired states |
| Public share page (clean, themed) | `/share/[token]` | ✅ | ➖ | ✅ | ✅ | 🟡 | Pass | Live: error state verified; valid live token not available |
| Reviewer validation (name/email/message) | `/share/[token]` | ✅ | ➖ | ✅ | ✅ | 📄 | Pass | |
| Approve / request changes / comment / approve-all | `/share/[token]` | ✅ | ➖ | ✅ | ✅ | 📄 | Pass | Status propagates to dashboard/cards/content |
| Demo share-link locality | `/share/[token]` | ✅ | ➖ | ➖ | ✅ | ➖ | **LIMIT-001** | Fresh context: created token 404s, seed token resolves |
| Share error states (invalid/disabled/expired) | `/share/*` | ✅ | ➖ | ✅ | ✅ | ✅ | Pass | Invalid verified on production too |
| Settings profile/defaults/mode indicator | `/settings` | ✅ | ➖ | ✅ | ✅ | 📄 | Pass | |
| Demo data wipe + restore | `/settings` | ✅ | ➖ | ➖ | ✅ | ➖ | Pass | Empty states verified after wipe |
| No horizontal overflow | all key routes | ✅ | ✅ | ✅ | ✅ | 🟡 | Pass | BUG-006 fixed (`min-w-0` on phone-frame columns); workspace + post detail verified clean on mobile. Live smoke: login only |
| Console/pageerror monitoring | all routes | ✅ | ➖ | ✅ | ✅ | 🟡 | Pass | Zero significant errors in monitored runs |
| axe-core WCAG 2.0/2.1 AA scan | 5 routes | ✅ | ➖ | ➖ | ✅ | ➖ | Pass | Clean scan post-fix (BUG-003/004 resolved); gate requires zero violations |
| Keyboard: skip link, Escape, dialog focus | shell | ✅ | ➖ | ➖ | ✅ | 📄 | Pass | |
| Double-submit protection | create client | ✅ | ➖ | ➖ | ✅ | 📄 | Pass | Single client created |
| Unsaved-edit refresh behavior | workspace | ✅ | ➖ | ➖ | ✅ | 📄 | Pass | Draft intentionally discarded, documented |
| Missing client/post/token error states | various | ✅ | ➖ | ➖ | ✅ | 🟡 | Pass | Friendly not-found screens |

## Added coverage — October 2026 (audit-fixes)

The table above is the July 2026 matrix. These areas were added with the audit fixes
(spec files in `tests/e2e/`, `tests/unit/`, `tests/live/`):

| Area | Where | Demo | Live |
| --- | --- | --- | --- |
| Link permissions (comments/approvals off), drafts hidden from reviewers, companion comment | `10-sharing`, `tests/live` | ✅ | CI |
| Share token isolation: owner sees the right client on their own link | `14-review-notifications`, `tests/live` | ✅ | CI |
| Rate limit per link, "Approve all" partial progress | unit `demo-repository`, `tests/live`, SQL verify 0006 | ✅ | CI |
| Demo integrity: no inline images stored, old data repaired, media cleanup, two tabs | `15-demo-integrity`, unit `demo-repository` | ✅ | ➖ |
| Storage cleanup: only unreferenced files, owner folder only | `tests/live` | ➖ | CI |
| Error states: load failure + Retry, refresh notice, failed save toast | `16-error-handling` | ✅ | ➖ |
| Ordered refreshes, local patches (UI matches after reload) | unit `store-ordering`, `18-patched-mutations` | ✅ | ➖ |
| Open-redirect protection on `?next=` | `01-auth`, unit `redirect` | ✅ | ➖ |
| Signup with email confirmation ("Check your inbox") | `tests/live` | ➖ | CI |
| Top-bar search (⌘K/Ctrl+K, mobile), settings defaults, hydration-safe storage | `19-search-defaults` | ✅ | ➖ |
| Timezone-free content days (Auckland → Los Angeles), old-data repair | `20-content-days`, SQL verify 0009 | ✅ | CI |
| Migrations 0006–0009: verify, rollback chain, atomicity | `npm run test:sql`; CI runs verify on real Supabase | ➖ | ✅ / CI |

"CI" = the GitHub Actions **live** job against a local Supabase (`supabase start`). It has
not run yet, because the branch hasn't been pushed.
