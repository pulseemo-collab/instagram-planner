# Migration 0006 — Share-link security

> **Status: not applied anywhere.** Per the plan, 0006 will be applied **together with the migrations from later phases, in one deploy**. At the end of the audit fixes this file will be folded into a single combined deploy guide. Until then, treat this as the 0006 reference.

**Files**

| File | Purpose |
|---|---|
| `supabase/migrations/0006_share_link_security.sql` | The migration (one transaction; a failure applies nothing) |
| `supabase/verify/0006_verify.sql` | 14 automated checks. **Safe on production**: everything is rolled back |
| `supabase/rollback/0006_rollback.sql` | Restores the exact pre-0006 state (one transaction) |

**Fixes audit issues #2, #3, #5, #7, #8.** The migration does five things:

- **Public reviewers no longer touch tables directly.** The `x-share-token` header and the eight "shared read/insert" RLS policies are removed. Reviewer access now goes through three SECURITY DEFINER RPCs that take the token as an argument:
  - `resolve_share(share_token)`: returns the link's **real** permission flags, the client looked up **by the token**, **completed posts only** (designer drafts excluded), and comments/approvals **without email addresses**.
  - `submit_share_comment(...)`: requires *Allow comments*. Only `general` comments; always `resolved = false`.
  - `submit_share_approval(...)`: requires *Allow approvals*. A message is also stored as a companion comment (when comments are allowed) as part of the **same** submission.
- **Rate limit per share link:** at most **60 submissions per rolling 10 minutes** and **300 per 24 hours**. An approval and its companion comment count as **one** submission.
- **Review notification triggers** now recognise reviewer submissions by a transaction flag that only the RPCs set, instead of the request header.
- **Every SECURITY DEFINER function** (new and pre-existing) runs with `search_path = ''` and schema-qualified names.
- **Storage buckets stay public** but get server-side limits: `avatars` and `highlights` allow 12 MB, JPEG/PNG/WebP only; `post-media` allows 25 MB, those image types plus MP4/WebM/QuickTime.

> I tested all of this on a **throwaway local PostgreSQL 17 cluster** with stubs for the Supabase `auth`/`storage` schemas, never against your project:
> - 0001→0006 applied cleanly on top of pre-existing data.
> - All 14 checks passed.
> - After the rollback, the checks correctly **failed**.
> - After re-applying, they passed again.
> - A deliberately broken run of 0006 left the database untouched.
>
> I could **not** test the Supabase CLI (`supabase db push`) or the dashboard SQL editor here.

---

## 0. Before you start

1. **Check that 0001–0005 are applied** (read-only). This should return 3 rows:
   ```sql
   select proname from pg_proc
   where proname in ('handle_review_approval', 'handle_review_comment', 'notify_review_event');
   ```
2. **Have the matching app build ready to ship.** It's the code on the `audit-fixes` branch at the Phase 2 commit or later. The app and the database must change **together** (see §2).
3. **Check the Supabase env vars on Vercel for every environment you'll build in.** The app's demo/live mode is frozen **at build time** (`next.config.ts`). A deployment built without the variables runs in **demo mode** even if the variables are added later.
   - Vercel → your project → *Settings* → *Environment Variables*: both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` must list **Production**. They must also list **Preview** if you want to test a preview deployment against Supabase. Otherwise every preview builds in demo mode, and testing it proves nothing about live mode.
   - Or with the CLI: `vercel env ls` shows which environments each variable is set for.
   - `SUPABASE_SERVICE_ROLE_KEY` is not used by the app and should **not** be on Vercel.
   - **How to tell a deployment's mode:** open its `/login` page. A **"Continue in demo mode"** button means it was built in demo mode. A live-mode build has only the email/password form. Once signed in, *Settings → Data* says "Connected to **Supabase**".
4. **Pick a quiet moment.** Share pages show "Preview not found" from the moment the migration is applied until the new deployment is live. With the staged-deployment order in §2 that gap is seconds. Owner pages keep working throughout.

---

## 1. Back up first

Do at least one of these:

**A. Dashboard backup (simplest).** Supabase Dashboard → *Database* → *Backups*. On paid plans, confirm a recent daily backup exists, or note the current time if you have Point-in-Time Recovery. Free-plan projects have no downloadable backups, so use B.

**B. A dump you keep yourself** (requires PostgreSQL client tools 15+; this machine has PostgreSQL 17 under `C:\Program Files\PostgreSQL\17\bin`):

Get the connection string from Dashboard → *Connect* → "Session pooler" or "Direct connection" and use the database password. Then run:

```bash
# schema + data of the app tables, plus the bucket rows the migration edits
pg_dump "postgresql://postgres.<project-ref>:<password>@<host>:5432/postgres" \
  --schema=public --table=storage.buckets \
  --format=custom --file=gridline-before-0006.dump
```

Or with the Supabase CLI: `supabase db dump --db-url "<connection string>" -f before-0006-schema.sql`, plus a second run with `--data-only -f before-0006-data.sql`.

Notes:
- Uploaded files (Storage objects) are **not** in a database dump, and the migration does not touch them.
- Optionally save the current policy list for comparison:
  ```sql
  select tablename, policyname, cmd from pg_policies where schemaname = 'public' order by 1, 2;
  ```

---

## 2. Apply it — exact deploy order

The currently deployed app reads tables directly, and the new app calls the new RPCs. Whichever side changes first, share pages fail until the other catches up. So the new app must be **fully built before** you touch the database, and going live must be **instant**.

**What Vercel's promote options actually do** (checked against Vercel's docs, Oct 2026):

| Option | Rebuild? | Env vars used | Share-link downtime after the migration |
|---|---|---|---|
| **Promote a *staged production* deployment** | **No** ("Vercel will instantly promote the deployment; it doesn't require a rebuild") | Production; it was built as a production deployment | **Seconds** ✅ recommended |
| Promote a *preview* deployment | **Yes**: "triggers a complete rebuild with production environment variables" | Production (preview values are never used in production) | **A full Vercel build**: install + `next build`, typically a few minutes. Check the *Build Duration* of your recent deployments |
| Merge to the production branch (auto-deploy) | Yes, a normal build | Production | A full build, same as above |

So **don't** use "promote a preview" for this. Its rebuild starts only when you click Promote, which is after the migration, and share links stay broken for the whole build.

### Recommended order (staged production deployment)

1. **Build a staged production deployment** of the new code, *before* touching the database. It's built with production env vars but not attached to your domain. Use **one** of:
   - **CLI** (from the project folder, on the `audit-fixes` code): `vercel --prod --skip-domain`. It prints the deployment URL.
   - **Dashboard:** *Settings* → *Environments* → *Production* → *Branch Tracking* → turn **off** "Auto-assign Custom Production Domains". Then merge or push to your production branch. The resulting production deployment is **Staged**, not Current.

   Wait until it shows **Ready**. Open its own deployment URL and check `/login`: there should be no "Continue in demo mode" button, which proves it was built in live mode (see §0.3). Its share pages will fail until step 2; that's expected.
2. **Apply the migration.** Use **one** of these:
   - **SQL editor** (Dashboard → *SQL Editor*): paste the whole of `supabase/migrations/0006_share_link_security.sql` and click *Run*. It must end with `COMMIT` and no error.
   - **psql:**
     ```bash
     psql "<connection string>" -v ON_ERROR_STOP=1 -f supabase/migrations/0006_share_link_security.sql
     ```
   - **`supabase db push`**: only if 0001–0005 were also applied with the CLI. If you applied them by hand in the SQL editor, the CLI has no migration history and would try to re-run 0001. In that case use one of the two options above. The file has its own `begin; … commit;`, and the CLI may print a harmless "transaction already in progress" warning (untested here).

   If anything fails, the whole migration is rolled back automatically. Fix the cause and re-run.
3. **Immediately promote the staged deployment.** In the dashboard: *Deployments* → the staged deployment → **⋯** → **Promote**. Or run `vercel promote <deployment-url>`. It's instant, with no rebuild.
4. **If you used the dashboard toggle in step 1, turn "Auto-assign Custom Production Domains" back on.** Otherwise every future production deployment will also wait for a manual promote.
5. **Verify** (see §3).
6. **Smoke test** in a private window: open an existing share link and leave a comment. Then check that a link with comments off shows no comment button.

**If you can't use a staged deployment,** the next-best order is: merge to the production branch first, and wait for that production build to reach *Ready*. Share links stay working during the build, because the old deployment keeps serving until the new one is ready. The moment it goes live, share links break until you apply the migration, so apply it **right then**. Downtime is the minutes it takes you to run the SQL. This is better than promoting a preview, whose rebuild happens *after* the migration.

**Reviewers who already have a share page open must refresh it.** Their tab is still running the old code: after step 2 it can't read new data, and anything they submit fails with "Something went wrong… please try again". A refresh loads the new version, and nothing they had already submitted is lost. Owner dashboards don't need a refresh.

If an RPC call returns "function … not found" right after applying, reload PostgREST's schema cache once (Supabase normally does this automatically):

```sql
notify pgrst, 'reload schema';
```

---

## 3. Verify each rule

Run the check script:

```bash
psql "<connection string>" -v ON_ERROR_STOP=1 -f supabase/verify/0006_verify.sql
```

It prints `PASS 1` … `PASS 14` and finishes with `ALL 0006 CHECKS PASSED — rolling back, nothing was saved`. The first broken rule stops it with `ERROR: FAIL n: …`.

The script works on a live database because it creates its own fixtures (a `verify-0006-owner@example.invalid` user, two clients, posts and links) **inside a transaction that it rolls back**. No rows, notifications or Realtime events remain. In the SQL editor you'll usually only see the final result row and not the `PASS` notices; that final row is the success signal.

| # | Rule checked | How |
|---|---|---|
| 1 | Anonymous direct table reads return nothing, even with the old `x-share-token` header | `set local role anon`, count rows in all shared tables |
| 2 | Anonymous direct inserts into `comments`/`approvals` are refused | Expects RLS error `42501` |
| 3 | `resolve_share` returns the **token's** client (not another one), only completed posts + their media, no `owner_id`, no emails, real flags | Inspects the JSON |
| 4 | A view-only link reports `allow_comments = false`, `allow_approval = false` | Inspects `link` |
| 5 | Unknown / disabled / expired tokens are refused with `not_found` / `inactive` / `expired` | Expects the specific error |
| 6 | **Comments off** and **approvals off** are enforced server-side; allowed actions still work | `comments_disabled`, `approvals_disabled` |
| 7 | A token can't reach drafts or another client's posts | `not_found` |
| 8 | Reviewer comments are always `general`, `resolved = false`, trimmed, and the email isn't returned | Inspects the RPC result |
| 9 | Approval with a message → 1 approval + 1 companion `change_request` comment + status updated by trigger + **exactly one** owner notification + **one** rate-limit submission | Counts rows as `postgres` |
| 10 | `anon` can't call the internal helpers or touch `share_submissions` | Expects `42501` |
| 11 | 61st submission in 10 min → `rate_limited`; 301st in 24 h → `rate_limited`; rows older than 24 h don't count and are purged | Fills the log, then submits |
| 12 | Every `public` SECURITY DEFINER function has `search_path = ''` | `pg_proc.proconfig` |
| 13 | Bucket limits are set and buckets are still public | `storage.buckets` |
| 14 | Owners still see their own data through RLS | Acts as `authenticated` with the fixture owner's JWT claims |

**Quick read-only spot checks** you can run any time:

```sql
-- No "shared" policies remain; owner policies are intact.
select tablename, policyname from pg_policies where schemaname = 'public' order by 1, 2;

-- Who may call the public RPCs (expect anon + authenticated for each).
select routine_name, grantee from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in ('resolve_share', 'submit_share_comment', 'submit_share_approval')
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

**What changes for users**
- Links with comments or approvals off now really are view-only (the buttons disappear and the server refuses them).
- Reviewers no longer see calendar content packages, nor other reviewers' email addresses.
- Disabled and expired links now show their own messages instead of "not found".
- Uploads over the size limits or of other file types are refused by Storage. The app already applies the same limits in the browser, so normal use is unaffected.

---

## 4. Roll back

Use this only if the new behaviour causes a problem you can't fix forward. It re-opens the issues above.

1. **Run the rollback** (one transaction):
   ```bash
   psql "<connection string>" -v ON_ERROR_STOP=1 -f supabase/rollback/0006_rollback.sql
   ```
   Or paste the file into the SQL editor. It:
   - drops the three RPCs, the helpers and `share_submissions`
   - restores the 0001 shared policies and the 0005 header-based triggers
   - restores the original helper functions (`search_path = public`)
   - removes the bucket limits
2. **Immediately go back to the previous app version:** Vercel → *Deployments* → the pre-0006 production deployment → **Instant Rollback** (or `vercel rollback <deployment-url>`). Instant Rollback reassigns your domains to that existing build without a rebuild, so it takes seconds. A deployment that has already served production cannot be "promoted" again; it must be a rollback. Share pages fail between steps 1 and 2, exactly as during the deploy.
3. Ask reviewers with an open share page to refresh.
4. If you use the Supabase CLI migration history, mark 0006 as not applied: `supabase migration repair --status reverted 0006`.

What survives a rollback:
- Comments and approvals submitted after 0006 are ordinary rows, so they stay.
- Only the rate-limit log (`share_submissions`) is dropped, which doesn't matter.

Restoring the §1 backup is a last resort, because it also discards every change made after the backup.

---

## 5. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Every share link shows "Preview not found" | The app and database are out of step: new app with old database, or the other way round. Finish §2 step 3, or run the rollback and redeploy the old app |
| `function public.resolve_share(...) does not exist` | Migration not applied, or PostgREST's cache is stale → `notify pgrst, 'reload schema';` |
| `permission denied for function resolve_share` | Grants missing → re-run the "Function privileges" block at the end of the migration |
| Reviewer sees "Too many responses…" | The link hit 60 submissions in 10 minutes or 300 in 24 hours. It clears on its own, or check the activity with the last spot-check query |
| Upload fails with a size or type error | The file exceeds the bucket limits listed at the top of this document. This is intended |

---

## References (Vercel behaviour, checked Oct 2026)

- [Promoting Deployments](https://vercel.com/docs/deployments/promoting-a-deployment): preview promotion = complete rebuild; staged production promotion = instant, no rebuild; Instant Rollback = domain reassignment, no rebuild.
- [Promoting a preview deployment to production](https://vercel.com/docs/deployments/promote-preview-to-production): "triggers a complete rebuild with production environment variables".
- [Deploying a staged production build (CLI)](https://vercel.com/docs/cli/deploying-from-cli#deploying-a-staged-production-build): `vercel --prod --skip-domain`, then `vercel promote`.
