-- Rollback for supabase/migrations/0008_duplicate_client.sql
--
-- Drops duplicate_client(). Kept OUTSIDE supabase/migrations/. The 0008 app
-- calls this function when duplicating a client, so roll the app back too
-- (see docs/MIGRATION_0006.md §4). To go back further, run
-- 0007_rollback.sql and then 0006_rollback.sql afterwards.
-- Clients already duplicated are ordinary rows and stay.

begin;

drop function if exists public.duplicate_client(uuid);

commit;
