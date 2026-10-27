-- Verification for migration 0006 (share-link security).
--
-- SAFE TO RUN ON A REAL DATABASE: everything happens inside one transaction
-- that is ROLLED BACK at the end. It creates its own throwaway fixtures
-- (an owner, two clients, posts, links), acts as the `anon` role the way a
-- public reviewer's request does, and asserts each rule. Nothing persists:
-- no rows, no notifications, no Realtime events (rolled-back transactions are
-- never broadcast).
--
-- Run with psql to see every PASS line:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/verify/0006_verify.sql
-- The first failing rule stops the script with "FAIL n: …".
-- See docs/DEPLOY_GUIDE.md (Appendix B) for what each check proves.

begin;

-- ---------------------------------------------------------------------------
-- Fixtures (as the migration owner / postgres)
-- ---------------------------------------------------------------------------

insert into auth.users (id, email)
  values ('00060000-0000-4000-8000-00000000000a', 'verify-0006-owner@example.invalid');

-- From 0010 on, new accounts start PENDING; approve this script's owner so
-- its checks run as an approved team member. Other fixture users stay
-- pending ("another, non-member user"). A no-op before 0010.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'profiles' and column_name = 'status') then
    execute 'update public.profiles set status = ''approved'' where id = $1'
      using '00060000-0000-4000-8000-00000000000a'::uuid;
  end if;
end $$;
-- The profile row is created by the on_auth_user_created trigger.

insert into public.clients (id, owner_id, name, slug, instagram_username) values
  ('00060000-0000-4000-8000-0000000000c1', '00060000-0000-4000-8000-00000000000a', 'Verify Client A', 'verify-0006-a', 'verify_0006_a'),
  ('00060000-0000-4000-8000-0000000000c2', '00060000-0000-4000-8000-00000000000a', 'Verify Client B', 'verify-0006-b', 'verify_0006_b');

insert into public.posts (id, client_id, name, stage) values
  ('00060000-0000-4000-8000-0000000000a1', '00060000-0000-4000-8000-0000000000c1', 'A: real post', 'post'),
  ('00060000-0000-4000-8000-0000000000a2', '00060000-0000-4000-8000-0000000000c1', 'A: designer draft', 'content'),
  ('00060000-0000-4000-8000-0000000000b1', '00060000-0000-4000-8000-0000000000c2', 'B: real post', 'post');

insert into public.post_media (post_id, url) values
  ('00060000-0000-4000-8000-0000000000a1', 'https://example.invalid/real.jpg'),
  ('00060000-0000-4000-8000-0000000000a2', 'https://example.invalid/draft.jpg');

insert into public.comments (post_id, author_name, author_email, body) values
  ('00060000-0000-4000-8000-0000000000a1', 'Earlier Reviewer', 'private@example.invalid', 'Earlier note');

insert into public.share_links (id, client_id, token, allow_comments, allow_approval, is_active, expires_at) values
  ('00060000-0000-4000-8000-0000000000f1', '00060000-0000-4000-8000-0000000000c1', 'verify0006-full-access',   true,  true,  true,  null),
  ('00060000-0000-4000-8000-0000000000f2', '00060000-0000-4000-8000-0000000000c1', 'verify0006-view-only',     false, false, true,  null),
  ('00060000-0000-4000-8000-0000000000f3', '00060000-0000-4000-8000-0000000000c1', 'verify0006-comments-only', true,  false, true,  null),
  ('00060000-0000-4000-8000-0000000000f4', '00060000-0000-4000-8000-0000000000c1', 'verify0006-disabled',      true,  true,  false, null),
  ('00060000-0000-4000-8000-0000000000f5', '00060000-0000-4000-8000-0000000000c1', 'verify0006-expired',       true,  true,  true,  now() - interval '1 day');

-- ===========================================================================
-- From here on: act as an anonymous public reviewer.
-- ===========================================================================
set local role anon;

-- 1. Direct table reads return nothing, even with the old x-share-token header.
do $$
begin
  perform set_config('request.headers', '{"x-share-token": "verify0006-full-access"}', true);
  if (select count(*) from public.clients) <> 0
     or (select count(*) from public.posts) <> 0
     or (select count(*) from public.post_media) <> 0
     or (select count(*) from public.comments) <> 0
     or (select count(*) from public.approvals) <> 0 then
    raise exception 'FAIL 1: anon can still read tables directly';
  end if;
  perform set_config('request.headers', '', true);
  raise notice 'PASS 1: anonymous direct table reads return nothing (old header ignored)';
end $$;

-- 2. Direct inserts are refused by RLS.
do $$
begin
  begin
    insert into public.comments (post_id, author_name, body)
      values ('00060000-0000-4000-8000-0000000000a1', 'Direct', 'direct insert');
    raise exception 'FAIL 2: anon inserted a comment directly';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.approvals (client_id, post_id, reviewer_name, status)
      values ('00060000-0000-4000-8000-0000000000c1', '00060000-0000-4000-8000-0000000000a1', 'Direct', 'approved');
    raise exception 'FAIL 2: anon inserted an approval directly';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS 2: direct anonymous inserts into comments/approvals are refused';
end $$;

-- 3. resolve_share returns the token's own client, completed posts only, no emails.
do $$
declare r jsonb;
begin
  r := public.resolve_share('verify0006-full-access');
  if r -> 'client' ->> 'name' is distinct from 'Verify Client A' then
    raise exception 'FAIL 3: wrong client: %', r -> 'client' ->> 'name';
  end if;
  if r -> 'client' ? 'owner_id' then raise exception 'FAIL 3: owner_id exposed'; end if;
  if jsonb_array_length(r -> 'posts') <> 1 or r -> 'posts' -> 0 ->> 'name' <> 'A: real post' then
    raise exception 'FAIL 3: posts should be only the completed post, got %', r -> 'posts';
  end if;
  if jsonb_array_length(r -> 'media') <> 1 then raise exception 'FAIL 3: draft media exposed'; end if;
  if jsonb_array_length(r -> 'comments') <> 1 then raise exception 'FAIL 3: expected 1 comment'; end if;
  if jsonb_path_exists(r, '$.comments[*].author_email') or jsonb_path_exists(r, '$.approvals[*].reviewer_email') then
    raise exception 'FAIL 3: reviewer emails exposed';
  end if;
  if (r -> 'link' ->> 'allow_comments')::boolean is not true or (r -> 'link' ->> 'allow_approval')::boolean is not true then
    raise exception 'FAIL 3: full-access flags wrong: %', r -> 'link';
  end if;
  raise notice 'PASS 3: resolve_share → own client, completed posts only, no emails, real flags';
end $$;

-- 4. Link flags are reported as stored.
do $$
declare r jsonb;
begin
  r := public.resolve_share('verify0006-view-only');
  if (r -> 'link' ->> 'allow_comments')::boolean or (r -> 'link' ->> 'allow_approval')::boolean then
    raise exception 'FAIL 4: view-only link reported as %', r -> 'link';
  end if;
  raise notice 'PASS 4: view-only link reports allow_comments = false, allow_approval = false';
end $$;

-- 5. Unknown / disabled / expired tokens are refused with the right code.
do $$
declare
  t text;
  expected text;
begin
  foreach t in array array['verify0006-no-such-token', 'verify0006-disabled', 'verify0006-expired'] loop
    expected := case t when 'verify0006-disabled' then 'inactive'
                       when 'verify0006-expired' then 'expired' else 'not_found' end;
    begin
      perform public.resolve_share(t);
      raise exception 'FAIL 5: % resolved', t;
    exception when raise_exception then
      if sqlerrm <> expected then raise exception 'FAIL 5: % gave % (expected %)', t, sqlerrm, expected; end if;
    end;
  end loop;
  raise notice 'PASS 5: not_found / inactive / expired tokens are refused';
end $$;

-- 6. "Comments off" and "approvals off" are enforced server-side.
do $$
begin
  begin
    perform public.submit_share_comment('verify0006-view-only', '00060000-0000-4000-8000-0000000000a1', 'Rita', null, 'Hello');
    raise exception 'FAIL 6: comment accepted on a comments-off link';
  exception when raise_exception then
    if sqlerrm <> 'comments_disabled' then raise; end if;
  end;
  begin
    perform public.submit_share_approval('verify0006-comments-only', '00060000-0000-4000-8000-0000000000a1', 'Rita', null, 'approved');
    raise exception 'FAIL 6: approval accepted on an approvals-off link';
  exception when raise_exception then
    if sqlerrm <> 'approvals_disabled' then raise; end if;
  end;
  -- The comments-only link does accept comments.
  perform public.submit_share_comment('verify0006-comments-only', '00060000-0000-4000-8000-0000000000a1', 'Rita', null, 'Comment on a comments-only link');
  raise notice 'PASS 6: comments-off and approvals-off are enforced; allowed actions still work';
end $$;

-- 7. A token only reaches its own client's completed posts.
do $$
declare
  pid uuid;
begin
  foreach pid in array array['00060000-0000-4000-8000-0000000000a2', '00060000-0000-4000-8000-0000000000b1']::uuid[] loop
    begin
      perform public.submit_share_comment('verify0006-full-access', pid, 'Rita', null, 'Out of scope');
      raise exception 'FAIL 7: comment accepted on out-of-scope post %', pid;
    exception when raise_exception then
      if sqlerrm <> 'not_found' then raise; end if;
    end;
  end loop;
  raise notice 'PASS 7: drafts and other clients'' posts are out of reach';
end $$;

-- 8. Reviewer comments are always unresolved and never echo the email.
do $$
declare r jsonb;
begin
  r := public.submit_share_comment('verify0006-full-access', '00060000-0000-4000-8000-0000000000a1',
                                   '  Rita  ', 'rita@example.invalid', '  Nice  ');
  if (r ->> 'resolved')::boolean or r ? 'author_email' or r ->> 'author_name' <> 'Rita' or r ->> 'body' <> 'Nice'
     or r ->> 'comment_type' <> 'general' then
    raise exception 'FAIL 8: unexpected comment row %', r;
  end if;
  raise notice 'PASS 8: reviewer comments are general, unresolved, trimmed, email not returned';
end $$;

-- 9a. An approval with a message (submitted now; checked below as postgres).
do $$
begin
  perform public.submit_share_approval('verify0006-full-access', '00060000-0000-4000-8000-0000000000a1',
                                       'Rita', 'rita@example.invalid', 'changes_requested', 'Please brighten it');
end $$;

-- 10. Internal helpers and the rate-limit log are off-limits.
do $$
begin
  begin
    perform public.share_rate_limit('00060000-0000-4000-8000-0000000000f1', 'comment');
    raise exception 'FAIL 10: anon can call share_rate_limit';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.share_link_check('verify0006-full-access');
    raise exception 'FAIL 10: anon can call share_link_check';
  exception when insufficient_privilege then null;
  end;
  begin
    perform count(*) from public.share_submissions;
    raise exception 'FAIL 10: anon can read share_submissions';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS 10: internal helpers and share_submissions are not accessible to anon';
end $$;

-- ===========================================================================
-- Back to the migration owner for checks that need full visibility.
-- ===========================================================================
reset role;

-- 9b. Approval + companion comment + status + one notification + ONE submission.
do $$
declare
  link uuid := '00060000-0000-4000-8000-0000000000f1';
  post uuid := '00060000-0000-4000-8000-0000000000a1';
begin
  if (select count(*) from public.approvals where post_id = post and message = 'Please brighten it') <> 1 then
    raise exception 'FAIL 9: approval row missing';
  end if;
  if (select count(*) from public.comments
      where post_id = post and body = 'Please brighten it' and comment_type = 'change_request') <> 1 then
    raise exception 'FAIL 9: companion change_request comment missing or duplicated';
  end if;
  if (select approval_status from public.posts where id = post) <> 'changes_requested' then
    raise exception 'FAIL 9: trigger did not update approval_status';
  end if;
  if (select count(*) from public.notifications where post_id = post and message = 'Please brighten it') <> 1 then
    raise exception 'FAIL 9: expected exactly one owner notification for the approval';
  end if;
  -- Full-access link: comment (check 8) + approval with companion (9a) = 2.
  if (select count(*) from public.share_submissions where share_link_id = link) <> 2 then
    raise exception 'FAIL 9: approval + companion comment should count as one submission (got % total)',
      (select count(*) from public.share_submissions where share_link_id = link);
  end if;
  raise notice 'PASS 9: approval stores companion comment, updates status, notifies once, counts once';
end $$;

-- 11. Rate limits: 60 per rolling 10 minutes, 300 per 24 hours, old rows purged.
do $$
declare link uuid := '00060000-0000-4000-8000-0000000000f1';
begin
  -- 10-minute window
  delete from public.share_submissions where share_link_id = link;
  insert into public.share_submissions (share_link_id, kind)
    select link, 'comment' from generate_series(1, 60);
  begin
    perform set_config('role', 'anon', true);
    perform public.submit_share_comment('verify0006-full-access', '00060000-0000-4000-8000-0000000000a1', 'Rita', null, 'Over the 10-minute limit');
    raise exception 'FAIL 11: 61st submission in 10 minutes accepted';
  exception when raise_exception then
    if sqlerrm <> 'rate_limited' then raise; end if;
  end;
  perform set_config('role', 'postgres', true);

  -- 24-hour window (rows older than 10 minutes, younger than 24 h)
  delete from public.share_submissions where share_link_id = link;
  insert into public.share_submissions (share_link_id, kind, created_at)
    select link, 'comment', now() - interval '1 hour' from generate_series(1, 300);
  begin
    perform set_config('role', 'anon', true);
    perform public.submit_share_comment('verify0006-full-access', '00060000-0000-4000-8000-0000000000a1', 'Rita', null, 'Over the daily limit');
    raise exception 'FAIL 11: 301st submission in 24 hours accepted';
  exception when raise_exception then
    if sqlerrm <> 'rate_limited' then raise; end if;
  end;
  perform set_config('role', 'postgres', true);

  -- Rows older than 24 h do not count and are purged.
  delete from public.share_submissions where share_link_id = link;
  insert into public.share_submissions (share_link_id, kind, created_at)
    select link, 'comment', now() - interval '25 hours' from generate_series(1, 300);
  perform set_config('role', 'anon', true);
  perform public.submit_share_comment('verify0006-full-access', '00060000-0000-4000-8000-0000000000a1', 'Rita', null, 'Old rows are ignored');
  perform set_config('role', 'postgres', true);
  if (select count(*) from public.share_submissions where share_link_id = link) <> 1 then
    raise exception 'FAIL 11: rows older than 24 h were not purged';
  end if;
  raise notice 'PASS 11: 60/10 min and 300/24 h limits enforced; rows older than 24 h purged';
end $$;

-- 12. Every SECURITY DEFINER function in public has an empty search_path.
do $$
declare offenders text;
begin
  select string_agg(p.proname, ', ') into offenders
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and not coalesce(p.proconfig @> array['search_path=""'], false);
  if offenders is not null then raise exception 'FAIL 12: definer functions without empty search_path: %', offenders; end if;
  raise notice 'PASS 12: all public SECURITY DEFINER functions use search_path = ''''';
end $$;

-- 13. Storage buckets have size and MIME limits (and are still public).
do $$
begin
  if exists (
    select 1 from storage.buckets
    where id in ('avatars', 'highlights')
      and (file_size_limit is distinct from 12582912
           or allowed_mime_types is distinct from array['image/jpeg', 'image/png', 'image/webp']
           or not public)
  ) or exists (
    select 1 from storage.buckets
    where id = 'post-media'
      and (file_size_limit is distinct from 26214400
           or not allowed_mime_types @> array['video/mp4', 'video/webm', 'video/quicktime', 'image/jpeg']
           or cardinality(allowed_mime_types) <> 6
           or not public)
  ) or (select count(*) from storage.buckets where id in ('avatars', 'highlights', 'post-media')) <> 3 then
    raise exception 'FAIL 13: bucket limits not as expected';
  end if;
  raise notice 'PASS 13: avatars/highlights 12 MB images only; post-media 25 MB images + video; still public';
end $$;

-- 14. Owners are unaffected: a signed-in owner still sees their own data.
do $$
begin
  perform set_config('request.jwt.claims', '{"sub": "00060000-0000-4000-8000-00000000000a", "role": "authenticated"}', true);
  perform set_config('role', 'authenticated', true);
  if (select count(*) from public.clients where name like 'Verify Client %') <> 2
     or (select count(*) from public.posts where name like 'A: %') <> 2 then
    raise exception 'FAIL 14: owner lost access to their own rows';
  end if;
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  raise notice 'PASS 14: owner access through RLS is unchanged';
end $$;

select 'ALL 0006 CHECKS PASSED — rolling back, nothing was saved' as result;

rollback;
