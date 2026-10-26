# Migration 0009 — Timezone-free content days

> **Status: not applied anywhere.** 0009 ships **together with 0006–0008 in one deploy**, applied in order (0006 → 0007 → 0008 → 0009). Backup, staged-deployment order, env-var checks and smoke test: [MIGRATION_0006.md](MIGRATION_0006.md). All of it will be folded into one combined deploy guide at the end of the audit fixes.

**Files**

| File | Purpose |
|---|---|
| `supabase/migrations/0009_content_scheduled_day.sql` | The migration (one transaction) |
| `supabase/verify/0009_verify.sql` | 7 checks. **Safe on production**: everything is rolled back |
| `supabase/rollback/0009_rollback.sql` | Back to the 0008 state |

**Fixes audit #18.** A content package dropped on a calendar day used to be stored as **local midnight converted to UTC** (`posts.scheduled_at`). Someone in a different timezone could therefore see it on the previous or next day. Now:

- **Content packages** keep a plain date in the new **`posts.scheduled_day`** column: "2026-08-01" is 1 August for everyone.
- **Completed posts** keep their real publishing moment in `scheduled_at`, unchanged.
- **Two check constraints** enforce the rule: content packages can't have `scheduled_at`, and completed posts can't have `scheduled_day`. Converting content into a post swaps the day for a time in one update, which is what the app does.
- **`duplicate_client()`** (from 0008) is re-created so it also copies `scheduled_day`.

**Backfill of existing content packages:** `scheduled_day = date(scheduled_at in UTC + 12 hours)`, and their `scheduled_at` is cleared.
- This recovers the day the content was dropped on for any owner timezone from **UTC−11 to UTC+12**, because the old value was local midnight there.
- Owners in UTC+13/+14 or UTC−12 may see old content one day off once. Content placed after the migration is exact everywhere.
- Demo mode repairs its local data the same way on first load. That repair is exact, because demo data never leaves the browser it was created in.

> I tested this on a throwaway local PostgreSQL 17 cluster with Supabase stubs, never against your project:
> - Content stored the old way for owners in UTC−11, −7, 0, +2 and +12 all backfilled to the correct day. Unplaced content and real posts were untouched.
> - The 0006, 0007, 0008 and 0009 verify scripts all passed.
> - Rollback, re-apply and the full chain rollback (0009 → 0006) worked, and a deliberately broken 0009 run left the database untouched.
> - **The rollback test caught a real bug:** the first rollback wrote days back as 12:00 UTC, and re-applying 0009 then moved content **one day later**. The rollback now writes 11:00 UTC. Three apply/rollback cycles kept every row on its day.

---

## Apply

As the fourth step of the combined deploy, after 0006, 0007 and 0008:

```bash
psql "<connection string>" -v ON_ERROR_STOP=1 -f supabase/migrations/0009_content_scheduled_day.sql
```

**App compatibility:**
- The app from this branch reads and writes `scheduled_day`, so **0009 must be applied before the new app goes live**. That's already the case with the staged-deployment order in [MIGRATION_0006.md](MIGRATION_0006.md) §2.
- The currently deployed app still writes content days into `scheduled_at`. During the seconds between applying 0009 and promoting the new deployment, a content placement made in the old app is refused by the new constraint. The user sees an error toast and can retry once the new version is live.

## Verify

```bash
psql "<connection string>" -v ON_ERROR_STOP=1 -f supabase/verify/0009_verify.sql
```

| # | Rule checked |
|---|---|
| 1 | `posts.scheduled_day` exists as a plain `date` |
| 2 | A content day reads back as the same date in `Pacific/Auckland` and `America/Los_Angeles` sessions |
| 3 | Completed posts can't have `scheduled_day` |
| 4 | Content packages can't have `scheduled_at` |
| 5 | Converting content into a post swaps the day for a publishing time; keeping the day while becoming a post is refused |
| 6 | `duplicate_client` copies content days |
| 7 | **Your real data** satisfies the rule (read-only), and every SECURITY DEFINER function still has `search_path = ''` |

## Roll back

```bash
psql "<connection string>" -v ON_ERROR_STOP=1 -f supabase/rollback/0009_rollback.sql
```

This puts content days back into `scheduled_at` as **11:00 UTC** on that day. The pre-0009 app shows that on the same day for viewers from UTC−11 to UTC+12, and re-applying 0009 maps it back to the same day. It then drops the constraints and the column, and restores `duplicate_client` verbatim from 0008.

A full rollback of this deploy runs `0009_rollback.sql` → `0008_rollback.sql` → `0007_rollback.sql` → `0006_rollback.sql`, **in that order**, then an Instant Rollback of the app on Vercel ([MIGRATION_0006.md](MIGRATION_0006.md) §4).
