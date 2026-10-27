# Deploy guide — migrations 0006 → 0009

> **Status: not applied anywhere yet.** These four migrations ship **together, in one deploy**, with the app from the `audit-fixes` branch. The app needs all four; the database is never changed without the matching app going live right after.

## What ships

| Migration | Audit issues | In one line |
|---|---|---|
| `0006_share_link_security.sql` | #2 #3 #5 #7 #8 | Reviewers use token-checked RPCs only: real link permissions, rate limit, no reviewer emails or drafts exposed, hardened functions, storage limits |
| `0007_atomic_writes_and_review_activity.sql` | #10 #11 (+ activity) | Atomic media replace and reorders; approval status moves with every approval; live-mode reviewer activity entries |
| `0008_duplicate_client.sql` | #20 | Duplicate a client in one transaction |
| `0009_content_scheduled_day.sql` | #18 | Content packages keep a timezone-free day (`posts.scheduled_day`) |

Each migration is **one transaction**: if it fails, it applies nothing. Each has a **verify** script (safe on production: it creates its own test data and rolls everything back) and a **rollback** script:

| | Files |
|---|---|
| Migrations | `supabase/migrations/0006…0009_*.sql` |
| Verify | `supabase/verify/0006_verify.sql` … `0009_verify.sql` |
| Rollback | `supabase/rollback/0006_rollback.sql` … `0009_rollback.sql` (kept **outside** `migrations/`, so `supabase db push` never runs them) |

Details of what each migration changes are in [Appendix A](#appendix-a--what-each-migration-changes), and every verify check is in [Appendix B](#appendix-b--verify-checks).

---

## 0. Before you start

1. **Let CI pass first.** Push the `audit-fixes` branch and wait for the GitHub Actions run to go green. Its **live** job applies 0001–0009 to a real (local) Supabase with the Supabase CLI and runs every verify script there. That's the closest rehearsal of this deploy. See [Appendix C](#appendix-c--how-this-was-tested).
2. **Check that 0001–0005 are applied** (read-only; expect 3 rows):
   ```sql
   select proname from pg_proc
   where proname in ('handle_review_approval', 'handle_review_comment', 'notify_review_event');
   ```
3. **Check the Supabase env vars on Vercel.** The app's demo/live mode is frozen **at build time** (`next.config.ts`). A deployment built without the variables runs in **demo mode**, even if the variables are added later.
   - Vercel → project → *Settings* → *Environment Variables*: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` must list **Production**. Add **Preview** too if you ever want to test a preview against Supabase; otherwise previews build in demo mode. `vercel env ls` shows the same.
   - `SUPABASE_SERVICE_ROLE_KEY` is not used by the app and must **not** be on Vercel.
   - **To tell a deployment's mode,** open its `/login` page. A **"Continue in demo mode"** button means a demo build; a live build shows only the email/password form.
4. **Supabase Auth → URL Configuration → Site URL** must be your production URL, so signup confirmation emails link back to the app. Signup shows "Check your inbox" when confirmation is on.
5. **Pick a quiet moment.** During the gap between applying the migrations and the new deployment going live, which is seconds with the order in §2, the old app hits the new database:
   - Share pages show "Preview not found".
   - Saving a post's media, reordering, duplicating a client or placing calendar content may fail with an error toast. Retrying after the new version is live works.
   - Owner pages otherwise keep working.

---

## 1. Back up

Do at least one of these:

**A. Dashboard backup.** Supabase Dashboard → *Database* → *Backups*: confirm a recent daily backup exists, or note the current time if you have Point-in-Time Recovery. Free-plan projects have no downloadable backups, so use B.

**B. Your own dump** (PostgreSQL client tools 15+; this machine has PostgreSQL 17 in `C:\Program Files\PostgreSQL\17\bin`). Get the connection string from Dashboard → *Connect* ("Session pooler" or "Direct connection") and use the database password:

```bash
# app tables (schema + data) plus the storage bucket settings the migrations edit
pg_dump "postgresql://postgres.<project-ref>:<password>@<host>:5432/postgres" \
  --schema=public --table=storage.buckets \
  --format=custom --file=gridline-before-0006.dump
```

Uploaded files (Storage objects) aren't in a database dump, and these migrations don't touch them. Optionally save the policy list for comparison:

```sql
select tablename, policyname, cmd from pg_policies where schemaname = 'public' order by 1, 2;
```

---

## 2. Deploy — exact order

The new app needs the new database, and the old app breaks on it. So the new app must be **fully built before** you touch the database, and going live must be **instant**.

**What Vercel's options actually do** (Vercel docs, Oct 2026):

| Option | Rebuild? | Downtime after the migrations |
|---|---|---|
| **Promote a *staged production* deployment** | **No** ("Vercel will instantly promote the deployment; it doesn't require a rebuild"); already built with production env vars | **Seconds** ✅ recommended |
| Promote a *preview* deployment | **Yes**: "triggers a complete rebuild with production environment variables" | A full build (minutes) — **don't** use it here |
| Merge to the production branch | Yes, a normal build | A full build (see the fallback below) |

### Recommended order

1. **Build a staged production deployment** of the new code. Use **one** of:
   - CLI, from the project folder on the `audit-fixes` code: `vercel --prod --skip-domain`. It prints the deployment URL.
   - Dashboard: *Settings* → *Environments* → *Production* → *Branch Tracking* → turn **off** "Auto-assign Custom Production Domains", then merge or push to the production branch. The new production deployment is **Staged**, not Current.

   Wait for **Ready**. Then open its own URL at `/login`: there must be **no** "Continue in demo mode" button, which proves a live-mode build.
2. **Apply the four migrations, in order.** With psql (stops at the first error):
   ```bash
   for m in 0006_share_link_security 0007_atomic_writes_and_review_activity \
            0008_duplicate_client 0009_content_scheduled_day; do
     psql "<connection string>" -v ON_ERROR_STOP=1 -f "supabase/migrations/$m.sql" || break
   done
   ```
   Or in the **SQL editor**: paste and run each file **separately, in that order**. Each must end with `COMMIT` and no error.

   `supabase db push` is only an option if 0001–0005 were also applied with the CLI. If you applied them by hand, the CLI has no history and would re-run 0001.

   > **If one migration fails:** it rolled itself back, but the earlier ones stay applied, and the new app needs all four. **Don't promote.** Either fix the cause and re-run just that migration, or roll back the ones already applied (§5). Only then decide.
3. **Promote the staged deployment immediately.** Dashboard → *Deployments* → the staged deployment → **⋯** → **Promote**, or `vercel promote <deployment-url>`. It's instant.
4. **If you used the dashboard toggle in step 1, turn "Auto-assign Custom Production Domains" back on.**
5. **Verify** (§3).
6. **Smoke test** in a private window:
   - Open an existing share link and leave a comment; the owner's bell should update.
   - A link with comments off shows no comment button.
   - Place a content package on a calendar day.
   - Duplicate a client.

**Reviewers with a share page already open must refresh it.** Until they do, their submissions fail with "Something went wrong"; nothing they had already submitted is lost.

**Fallback if you can't stage:** merge to the production branch and wait until that build is *Ready*. The old deployment keeps serving during the build. The moment the new one goes live, apply the migrations **right away**; downtime is the minutes the SQL takes. That's still better than promoting a preview, whose rebuild only starts after the migrations.

If an RPC reports "function … does not exist" right after applying, reload PostgREST's schema cache once:

```sql
notify pgrst, 'reload schema';
```

---

## 3. Verify

```bash
for v in 0006 0007 0008 0009; do
  psql "<connection string>" -v ON_ERROR_STOP=1 -f "supabase/verify/${v}_verify.sql" || break
done
```

Each script prints `PASS 1 …` and ends with `ALL 000x CHECKS PASSED — rolling back, nothing was saved`. The first broken rule stops with `ERROR: FAIL n: …`. In the SQL editor you usually only see the final row, and that row is the success signal.

- **They're safe on production:** each creates its own `verify-000x-…@example.invalid` users and data **inside a transaction it rolls back**. No rows, notifications or Realtime events remain.
- **Lock note:** `0008_verify.sql` check 7 briefly adds a constraint to `post_media` (an exclusive lock, well under a second, released at rollback).
- `0009_verify.sql` checks 1 and 7 also read your **real** data (read-only) to confirm every existing row follows the content-day rule.

**Quick read-only spot checks:**

```sql
-- No "shared" policies remain; owner policies intact.
select tablename, policyname from pg_policies where schemaname = 'public' order by 1, 2;

-- Who may call the public RPCs (expect anon + authenticated for each).
select routine_name, grantee from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in ('resolve_share', 'submit_share_comment', 'submit_share_approval')
order by 1, 2;

-- Owner-only RPCs (expect authenticated only).
select routine_name, grantee from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in ('set_post_media', 'reorder_posts', 'reorder_highlights', 'duplicate_client')
order by 1, 2;

-- Bucket limits.
select id, public, file_size_limit, allowed_mime_types from storage.buckets order by id;

-- Definer functions without an empty search_path (expect zero rows).
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and not coalesce(p.proconfig @> array['search_path=""'], false);

-- Rate-limit activity per link right now.
select l.client_id, s.share_link_id,
       count(*) filter (where s.created_at > now() - interval '10 minutes') as last_10_min,
       count(*) as last_24_h
from public.share_submissions s join public.share_links l on l.id = s.share_link_id
group by 1, 2 order by last_10_min desc;
```

---

## 4. What changes for users

- **Share links:**
  - Links with comments or approvals off really are view-only: the buttons disappear and the server refuses those actions.
  - Reviewers no longer see calendar content packages or other reviewers' email addresses.
  - Disabled and expired links show their own messages.
  - A burst of more than 60 responses in 10 minutes (or 300 a day) on one link shows "Too many responses"; it clears by itself.
  - Reviewer comments and approvals now appear in the owner's **activity feed** in live mode, as in demo mode.
- **Saving a post's media, reordering, approvals and duplicating** are all-or-nothing: a failure leaves the previous state instead of half a change.
- **Calendar content days** are the same date for everyone, whatever their timezone.
- **Uploads** over the size limits (12 MB images; 25 MB for post media, incl. MP4/WebM/MOV video) or of other types are refused by Storage. The app already enforces the same limits in the browser.

---

## 5. Roll back

Use this only if a problem can't be fixed forward. It re-opens the issues the migrations fixed.

1. **Run the rollbacks in reverse order** (each is one transaction):
   ```bash
   for r in 0009 0008 0007 0006; do
     psql "<connection string>" -v ON_ERROR_STOP=1 -f "supabase/rollback/${r}_rollback.sql" || break
   done
   ```
   If only some migrations were applied, start from the newest applied one.
2. **Immediately go back to the previous app version:** Vercel → *Deployments* → the pre-deploy production deployment → **Instant Rollback** (or `vercel rollback <url>`). It reassigns your domains to that existing build without rebuilding, so it takes seconds. A deployment that has already served production can't be "promoted" again; it must be a rollback.
3. Ask reviewers with an open share page to refresh.
4. If you use the Supabase CLI migration history: `supabase migration repair --status reverted 0006 0007 0008 0009`.

**What survives a rollback:**
- Comments, approvals, activity entries and duplicated clients created in the meantime are ordinary rows, so they stay.
- The rate-limit log (`share_submissions`) is dropped.
- Content days go back into `scheduled_at` as **11:00 UTC** on that day. The old app shows that on the same day for viewers from UTC−11 to UTC+12, and re-applying 0009 later maps it back to the same day.
- Restoring the §1 backup is a last resort, because it also discards every change made since.

---

## 6. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Every share link shows "Preview not found" | App and database out of step. Finish §2 step 3, or roll back (§5) and Instant Rollback the app |
| `function public.resolve_share(...)` (or another RPC) `does not exist` | Migration not applied, or PostgREST's cache is stale: `notify pgrst, 'reload schema';` |
| `permission denied for function …` | Grants missing: re-run that migration's "privileges" block |
| Saving a post / reordering / duplicating fails right after deploy | The app is newer than the database: check that 0007 and 0008 are applied |
| Placing content fails with a constraint error | The old app is still live against 0009: finish §2 step 3 |
| Reviewer sees "Too many responses…" | That link hit the rate limit; it clears by itself. See the last spot-check query |
| Upload refused with a size/type error | File over the bucket limits (§4); intended |

---

## Appendix A — what each migration changes

**0006 — share-link security**
- Drops the eight "shared read/insert" policies and the `x-share-token` header. Public reviewers use three SECURITY DEFINER RPCs that take the token as an argument:
  - `resolve_share`: real link flags; client looked up **by token**; completed posts only; no emails or `owner_id`.
  - `submit_share_comment`: requires *Allow comments*; always `general` and unresolved.
  - `submit_share_approval`: requires *Allow approvals*; a message also becomes a companion comment when comments are allowed.
- **Rate limit:** `share_submissions` log, 60 per rolling 10 minutes and 300 per 24 hours per link. An approval plus its companion comment counts as one.
- Review triggers recognise reviewer submissions by a transaction flag only the RPCs set.
- All SECURITY DEFINER functions use `search_path = ''` with schema-qualified names.
- Buckets stay public, with `file_size_limit` and `allowed_mime_types`.

**0007 — atomic writes and reviewer activity**
- `set_post_media` replaces a post's media in one transaction.
- `reorder_posts` and `reorder_highlights` apply each order as a single `UPDATE`. All three are SECURITY INVOKER (RLS applies), `authenticated` only.
- The approvals trigger moves `approval_status` for **every** approval row.
- Reviewer submissions also write **activity** entries (same wording as demo mode); the companion comment adds nothing extra.
- `submit_share_approval` is re-created to flag that companion comment.

**0008 — duplicate a client**
- `duplicate_client()` copies the client, its highlights, posts (incl. content packages) and media with fresh ids; comments, approvals, share links and activity aren't copied.
- Name and username are trimmed so the " copy"/".copy" suffix fits the 120/60-character limits.
- SECURITY INVOKER, `authenticated` only. Media files are shared by URL; Storage cleanup removes a file only when no row references it.

**0009 — timezone-free content days**
- Adds `posts.scheduled_day date`. Content packages keep a plain day there; completed posts keep `scheduled_at`.
- Two constraints: content can't have `scheduled_at`, posts can't have `scheduled_day`.
- **Backfill:** `scheduled_day = date(scheduled_at in UTC + 12 h)` for existing content, then `scheduled_at` is cleared. This is exact for owners from UTC−11 to UTC+12; owners in UTC+13/+14 or UTC−12 may see old content one day off once.
- `duplicate_client` is re-created to copy the day.

---

## Appendix B — verify checks

**0006** (14 checks)

| # | Rule |
|---|---|
| 1 | Anonymous direct table reads return nothing, even with the old `x-share-token` header |
| 2 | Anonymous direct inserts into `comments`/`approvals` are refused (RLS `42501`) |
| 3 | `resolve_share` returns the token's own client, completed posts and their media only, no `owner_id`, no emails, real flags |
| 4 | A view-only link reports both permissions as false |
| 5 | Unknown / disabled / expired tokens → `not_found` / `inactive` / `expired` |
| 6 | Comments-off / approvals-off are enforced; allowed actions still work |
| 7 | A token can't reach drafts or another client's posts |
| 8 | Reviewer comments are `general`, unresolved, trimmed; the email isn't returned |
| 9 | Approval with a message → companion comment, status updated, exactly one notification, one rate-limit submission |
| 10 | `anon` can't call internal helpers or touch `share_submissions` |
| 11 | 61st submission in 10 min / 301st in 24 h → `rate_limited`; rows older than 24 h purged |
| 12 | Every public SECURITY DEFINER function has `search_path = ''` |
| 13 | Bucket limits set, buckets still public |
| 14 | Owners still see their own data through RLS |

**0007** (9 checks)

| # | Rule |
|---|---|
| 1 | A reviewer comment → one `comment_received` activity entry + one notification |
| 2 | An approval with a message → one `approval_received` entry, one notification, status updated; the companion adds nothing |
| 3 | An owner-recorded approval moves the status in the same statement |
| 4 | `set_post_media` replaces the list in order (positions 0…n-1, cover fields kept) |
| 5 | A failing `set_post_media` leaves the existing media untouched |
| 6 | `reorder_posts` / `reorder_highlights` apply the order; unknown ids ignored |
| 7 | Another signed-in user gets `not_found` and can't reorder or replace the owner's data |
| 8 | `anon` can't execute `set_post_media` / `reorder_*` |
| 9 | Definer functions keep `search_path = ''` |

**0008** (8 checks)

| # | Rule |
|---|---|
| 1 | New client: fresh id/slug, "… copy" / ".copy", same owner and profile |
| 2 | Highlights, posts (incl. content) and media copied with fresh ids and correct links |
| 3 | Comments, approvals, share links, activity not copied |
| 4 | 120/60-character names trimmed to fit the suffix |
| 5 | Another user gets `not_found` |
| 6 | `anon` can't execute it |
| 7 | A failure part way through leaves nothing behind (brief `post_media` lock) |
| 8 | Definer functions keep `search_path = ''` |

**0009** (7 checks)

| # | Rule |
|---|---|
| 1 | `posts.scheduled_day` is a plain `date` |
| 2 | A content day reads back identically in Auckland and Los Angeles sessions |
| 3 | Completed posts can't have `scheduled_day` |
| 4 | Content packages can't have `scheduled_at` |
| 5 | Content → post swaps the day for a time; keeping the day as a post is refused |
| 6 | `duplicate_client` copies content days |
| 7 | Your real data follows the rule (read-only); definer functions keep `search_path = ''` |

---

## Appendix C — how this was tested

**Never against your Supabase project.**

- **`npm run test:sql`** (`scripts/sql-test.mjs`, runs locally and in CI) creates a throwaway PostgreSQL 17 cluster with Supabase stand-ins, then:
  - applies 0001→0009, including the 0009 backfill fixtures for owners in UTC−11, −7, 0, +2 and +12, and runs all four verify scripts
  - rolls back 0009 → 0006, checking at each step that the rolled-back migration's checks fail while earlier ones still pass
  - re-applies everything and checks it again (no content-day drift)
  - forces a failure part way through each migration and checks the schema is untouched

  During development this caught two real bugs: a `post_media` RLS problem in the first 0008, and a one-day drift in the first 0009 rollback.
- **CI "live" job** (GitHub Actions): `supabase start` applies 0001–0009 through the **real Supabase CLI** on a local stack. All verify scripts then run against the real Supabase schema, followed by end-to-end tests of the live app: signup confirmation, Storage cleanup, share-link permissions, Realtime notifications, the rate limit, and content days.
  - It uses only the local stack's public demo keys, and the test config refuses any non-local Supabase URL.
  - As of writing, the live job has **not run yet** (the branch hasn't been pushed). Its first run is the rehearsal in §0.1.

## References

- Vercel — [Promoting Deployments](https://vercel.com/docs/deployments/promoting-a-deployment): preview promotion = full rebuild; staged production promotion = instant; Instant Rollback = no rebuild.
- Vercel — [Promoting a preview deployment to production](https://vercel.com/docs/deployments/promote-preview-to-production): "triggers a complete rebuild with production environment variables".
- Vercel CLI — [Deploying a staged production build](https://vercel.com/docs/cli/deploying-from-cli#deploying-a-staged-production-build): `vercel --prod --skip-domain`, then `vercel promote`.
