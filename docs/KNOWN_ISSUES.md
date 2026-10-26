# Known Issues — Confirmed & Unresolved

*Only currently unresolved items. All six confirmed bugs from the July 17, 2026
audit (BUG-001 … BUG-006) have been **fixed and verified** — see the resolution
log in `QA_FULL_AUDIT_REPORT.md` §12. What remains below are documented product
limitations, not defects.*

---

## LIMIT-001 — Demo-mode share links are browser-local (documented limitation, not a defect)

- **Status:** Confirmed by test (`10-sharing.spec.ts › DEMO LIMITATION PROOF`)
- Newly created demo share links resolve only in the browser profile that created
  them. A fresh browser context shows "Preview not found" for them (while seeded
  demo tokens resolve everywhere, because every fresh browser recreates the same
  seed). True public sharing requires Supabase mode. The UI does not currently warn
  the user about this when copying a demo link — see suggestion S-2 in the audit
  report.

## LIMIT-002 — Decorative top-bar search

- **Status:** Confirmed (scheduled: audit issue #22)
- The global top-bar **search field** (and its mobile search button) filters
  nothing, though it looks interactive. Documented in the user manual; see
  suggestion S-3.
- *Resolved part:* the **notification bell** is fully functional since the review
  notifications release (unread badge, panel, mark-read, live updates).

## LIMIT-004 — Comment "resolve" flag has no creator UI (by design of the calendar redesign)

- **Status:** Product decision (calendar-workspace redesign, July 2026)
- The Feedback card was removed from the post workspace per the calendar redesign;
  reviewer comments now render inside the Instagram preview and in the activity
  feed, and the full review workflow lives on public share pages. The
  `comments.resolved` field and repository methods remain intact, but no screen
  currently toggles it. Re-surface it later if comment triage becomes a need.

## LIMIT-005 — Touch drag-and-drop uses the Schedule dialog fallback

- **Status:** Documented limitation
- HTML5 drag-and-drop does not fire on touch devices; on phones/tablets the
  card's **Schedule / Reschedule / Unschedule** buttons (date-time dialog) are the
  supported path. Pointer drag works on desktop.

## LIMIT-006 — Abandoned uploads are never cleaned up

- **Status:** Known limitation (deferred by decision, Oct 2026)
- Files are stored the moment they are uploaded, before the form is saved.
  Uploads that never end up in a saved row stay in storage: a post, avatar or
  highlight form that is cancelled, or video-cover frames generated while
  browsing but not chosen. This applies to demo mode (IndexedDB "media" store)
  and live mode (Supabase Storage).
- Files that *were* saved are deleted correctly once the row that used them is
  deleted or replaced (audit #19). Live mode removes only those exact paths,
  in the owner's own folder, after re-checking that no row still uses them.
- Why it isn't swept automatically: an unreferenced file can't be told apart
  from an upload still in progress in another tab, so a "delete everything
  unreferenced" sweep could destroy someone's in-progress work. A safe fix
  needs upload timestamps (e.g. sweep only files unreferenced for > 24 h).

## LIMIT-003 — Reposts and Tagged tabs are always empty

- **Status:** Confirmed
- The phone renders Instagram's four tabs for fidelity, but no workflow can add
  content to Reposts or Tagged. Both show "No content yet".
