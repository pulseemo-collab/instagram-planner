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

## LIMIT-002 — Decorative top-bar controls

- **Status:** Confirmed
- The global top-bar **search field** filters nothing, and the **notification bell**
  has an unread dot but no panel. Both look interactive. Documented in the user
  manual; see suggestions S-3/S-4.

## LIMIT-003 — Reposts and Tagged tabs are always empty

- **Status:** Confirmed
- The phone renders Instagram's four tabs for fidelity, but no workflow can add
  content to Reposts or Tagged. Both show "No content yet".
