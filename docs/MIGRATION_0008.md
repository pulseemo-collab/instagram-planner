# Migration 0008 — Duplicate a client in one transaction

> **Status: not applied anywhere.** 0008 ships **together with 0006 and 0007 in one deploy**, applied in order (0006 → 0007 → 0008). Backup, staged-deployment order, env-var checks and smoke test: [MIGRATION_0006.md](MIGRATION_0006.md). All of it will be folded into one combined deploy guide at the end of the audit fixes.

**Files**

| File | Purpose |
|---|---|
| `supabase/migrations/0008_duplicate_client.sql` | The migration (one transaction) |
| `supabase/verify/0008_verify.sql` | 8 checks. Rolled back; see the lock note below |
| `supabase/rollback/0008_rollback.sql` | Drops the function (back to the 0007 state) |

**Fixes audit #20.** `duplicate_client(client)` copies a client with its highlights, posts (calendar content packages included) and post media, all in **one transaction**, with fresh ids.

- **Before:** the browser reloaded the whole workspace, then inserted rows one request at a time. That was slow, and a failure partway through left a half-copied client.
- **Same copy set as before:** comments, approvals, share links and activity are **not** copied.
- **Media files are shared by URL, not duplicated.** Storage cleanup only removes a file once no row references it.
- **Long names fit their limits:** name and username are trimmed so the " copy"/".copy" suffix fits within 120 and 60 characters. Before, duplicating a client with a long name failed. Demo mode trims the same way.
- **SECURITY INVOKER:** it runs as the signed-in owner, so RLS decides access, and only `authenticated` may execute it.

> I tested this on a throwaway local PostgreSQL 17 cluster with Supabase stubs, never against your project:
> - On a fresh database, 0001→0008 applied cleanly and all of 0006's, 0007's and 0008's checks passed.
> - After the 0008 rollback, 0007's checks still passed. Re-applying 0008 passed again.
> - The full chain rollback 0008 → 0007 → 0006 restored the pre-0006 state.
> - A deliberately broken 0008 run left the database untouched.
>
> The verify script caught one real problem during development. A single-statement version (posts and media in sibling CTEs) was rejected by the `post_media` RLS check, which can't see posts inserted by a sibling CTE. The final version uses two statements.

---

## Apply

As the third step of the combined deploy, after 0006 and 0007:

```bash
psql "<connection string>" -v ON_ERROR_STOP=1 -f supabase/migrations/0008_duplicate_client.sql
```

**App compatibility:** the app from this branch calls `duplicate_client` when you duplicate a client in live mode. Until 0008 is applied, that one action fails with an error toast; nothing else is affected.

## Verify

```bash
psql "<connection string>" -v ON_ERROR_STOP=1 -f supabase/verify/0008_verify.sql
```

> **Lock note:** check 7 proves atomicity. It adds a temporary `NOT VALID` check constraint to `post_media`, which takes an exclusive lock on that table until the script's final rollback. That's well under a second, but run it at a quiet moment on production. Everything is rolled back.

| # | Rule checked |
|---|---|
| 1 | Returns a new client: fresh id and slug, "… copy" name and ".copy" username, same owner and profile fields |
| 2 | Highlights, posts (incl. content packages) and media are copied faithfully, with fresh ids and media attached to the matching new posts |
| 3 | Comments, approvals, share links and activity are not copied |
| 4 | A 120-character name and 60-character username are trimmed so the suffix fits |
| 5 | Another signed-in user gets `not_found` |
| 6 | `anon` cannot execute it |
| 7 | A failure partway through (a forced constraint violation on a copied media row) leaves no client, post or highlight behind |
| 8 | Every `public` SECURITY DEFINER function still has `search_path = ''` |

## Roll back

```bash
psql "<connection string>" -v ON_ERROR_STOP=1 -f supabase/rollback/0008_rollback.sql
```

This drops the function. Clients already duplicated are ordinary rows and stay. Because 0006–0008 ship together, a full rollback means running `0008_rollback.sql` → `0007_rollback.sql` → `0006_rollback.sql`, **in that order**, then doing an Instant Rollback of the app on Vercel ([MIGRATION_0006.md](MIGRATION_0006.md) §4).
