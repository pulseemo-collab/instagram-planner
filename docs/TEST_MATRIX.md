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
| Calendar month nav / Today / client filter | `/calendar` | ✅ | ➖ | ✅ | ✅ | 📄 | Pass | |
| Calendar drag reschedule | `/calendar` | ✅ | ➖ | ➖ | ✅ | 📄 | Pass | Literal Playwright mouse drag, post-fix (BUG-005 resolved: PostChip remount aborted drags) |
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
