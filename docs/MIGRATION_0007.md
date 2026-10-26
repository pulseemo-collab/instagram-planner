# Migration 0007 — Atomic writes & reviewer activity

> **Status: not applied anywhere.** 0007 ships **together with 0006 in one deploy**, applied in order (0006, then 0007). It requires 0006. The backup, staged-deployment order, env-var checks and smoke test are in [MIGRATION_0006.md](MIGRATION_0006.md), and will be folded into one combined deploy guide at the end of the audit fixes.

**Files**

| File | Purpose |
|---|---|
| `supabase/migrations/0007_atomic_writes_and_review_activity.sql` | The migration (one transaction) |
| `supabase/verify/0007_verify.sql` | 9 checks. **Safe on production**: everything is rolled back |
| `supabase/rollback/0007_rollback.sql` | Restores the exact 0006 state |

**Fixes audit #10 and #11, plus live-mode activity entries for reviewer actions.**

- **`set_post_media(post, media)`** replaces a post's media list in **one transaction**. Before, the browser deleted the old rows and then inserted the new ones, so a failed insert left the post with no media.
- **`reorder_posts` / `reorder_highlights`** apply a new order in **one `UPDATE`**. Before, there was one unchecked request per row, so a partial failure left a mixed order.
- These three are **SECURITY INVOKER**: they run as the signed-in owner, so the existing owner RLS policies decide what they may touch. Only `authenticated` may execute them.
- **Approvals:**
  - The approvals trigger now moves the post's `approval_status` for **every** approval row, including owner-recorded ones, in the same statement.
  - Reviewer submissions also write an **activity entry**, worded the same as demo mode: "Rita left a comment", "Rita approved a post", "Rita requested changes on a post".
  - The companion comment created with an approval message adds no second notification or activity entry.
- `submit_share_approval` is re-created unchanged apart from flagging that companion comment.

> I tested this on a throwaway local PostgreSQL 17 cluster with Supabase stubs, never against your project:
> - 0001→0007 applied cleanly.
> - Both `0006_verify.sql` (all 14) and `0007_verify.sql` (all 9) passed.
> - After the 0007 rollback, 0007's checks failed while 0006's still passed.
> - Re-applying 0007 passed again.
> - Rolling back 0007 then 0006 restored the pre-0006 state.
> - A deliberately broken 0007 run left the database untouched.

---

## Apply

As part of the combined deploy (see [MIGRATION_0006.md](MIGRATION_0006.md) §2), apply 0006 first and then 0007, using the same method:

```bash
psql "<connection string>" -v ON_ERROR_STOP=1 -f supabase/migrations/0006_share_link_security.sql
psql "<connection string>" -v ON_ERROR_STOP=1 -f supabase/migrations/0007_atomic_writes_and_review_activity.sql
```

In the SQL editor, run each file separately, in that order. Each must end with `COMMIT`. If 0007 fails, it rolls back by itself and 0006 stays applied. Fix the cause and re-run 0007 only.

**App compatibility:** the app from this branch needs **both** migrations. The live app calls `set_post_media` and `reorder_*` when you save a post or reorder the grid or highlights, and those calls fail until 0007 is applied.

## Verify

```bash
psql "<connection string>" -v ON_ERROR_STOP=1 -f supabase/verify/0006_verify.sql
psql "<connection string>" -v ON_ERROR_STOP=1 -f supabase/verify/0007_verify.sql
```

| # | Rule checked |
|---|---|
| 1 | A reviewer comment creates exactly one `comment_received` activity entry and one notification |
| 2 | An approval with a message creates one `approval_received` entry and one notification, and updates the status; its companion comment exists but adds nothing extra |
| 3 | An owner-recorded approval moves the post status in the same statement |
| 4 | `set_post_media` replaces the list in order (positions 0…n-1, cover fields kept) |
| 5 | A failing `set_post_media` (invalid media type) leaves the existing media untouched |
| 6 | `reorder_posts` / `reorder_highlights` apply the new order; unknown ids are ignored |
| 7 | Another signed-in user gets `not_found` and can't reorder or replace the owner's data (RLS) |
| 8 | `anon` cannot execute `set_post_media` / `reorder_*` |
| 9 | Every `public` SECURITY DEFINER function still has `search_path = ''` |

## Roll back

```bash
psql "<connection string>" -v ON_ERROR_STOP=1 -f supabase/rollback/0007_rollback.sql
```

This restores the exact 0006 state (the three changed functions are copied verbatim from 0006) and drops the new RPCs.

0006 and 0007 ship together, and no deployed app version matches "0006 only". So a real rollback normally means:
1. Run `0007_rollback.sql`, **then** `0006_rollback.sql`. Always in that order.
2. **Instant Rollback** on Vercel to the pre-deploy production version (see [MIGRATION_0006.md](MIGRATION_0006.md) §4).

Activity entries written by the triggers are ordinary rows and stay after a rollback.
