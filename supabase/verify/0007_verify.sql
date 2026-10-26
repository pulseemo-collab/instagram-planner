-- Verification for migration 0007 (atomic writes + reviewer activity).
--
-- SAFE TO RUN ON A REAL DATABASE: one transaction, ROLLED BACK at the end,
-- with its own throwaway fixtures. Requires 0006 and 0007.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/verify/0007_verify.sql
--
-- Prints PASS 1 … PASS 9; the first broken rule stops with "FAIL n: …".

begin;

-- ---------------------------------------------------------------------------
-- Fixtures: an owner with one client, two posts, two highlights, one link;
-- and an unrelated second user.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('00070000-0000-4000-8000-00000000000a', 'verify-0007-owner@example.invalid'),
  ('00070000-0000-4000-8000-00000000000b', 'verify-0007-stranger@example.invalid');

insert into public.clients (id, owner_id, name, slug, instagram_username) values
  ('00070000-0000-4000-8000-0000000000c1', '00070000-0000-4000-8000-00000000000a', 'Verify 0007 Client', 'verify-0007', 'verify_0007');

insert into public.posts (id, client_id, name, stage, grid_position) values
  ('00070000-0000-4000-8000-0000000000a1', '00070000-0000-4000-8000-0000000000c1', 'Post one', 'post', 0),
  ('00070000-0000-4000-8000-0000000000a2', '00070000-0000-4000-8000-0000000000c1', 'Post two', 'post', 1);

insert into public.post_media (post_id, url, position) values
  ('00070000-0000-4000-8000-0000000000a1', 'https://example.invalid/original-0.jpg', 0),
  ('00070000-0000-4000-8000-0000000000a1', 'https://example.invalid/original-1.jpg', 1);

insert into public.highlights (id, client_id, title, position) values
  ('00070000-0000-4000-8000-0000000000e1', '00070000-0000-4000-8000-0000000000c1', 'First', 0),
  ('00070000-0000-4000-8000-0000000000e2', '00070000-0000-4000-8000-0000000000c1', 'Second', 1);

insert into public.share_links (client_id, token) values
  ('00070000-0000-4000-8000-0000000000c1', 'verify0007-full-access');

-- ---------------------------------------------------------------------------
-- Reviewer actions (anon)
-- ---------------------------------------------------------------------------
set local role anon;

do $$
begin
  perform public.submit_share_comment('verify0007-full-access', '00070000-0000-4000-8000-0000000000a1',
                                      'Rita', null, 'Standalone feedback');
  perform public.submit_share_approval('verify0007-full-access', '00070000-0000-4000-8000-0000000000a2',
                                       'Rita', null, 'approved', 'Ship it');
end $$;

reset role;

-- 1. Standalone reviewer comment → one activity entry + one notification.
do $$
begin
  if (select count(*) from public.activity
      where client_id = '00070000-0000-4000-8000-0000000000c1'
        and type = 'comment_received' and description = 'Rita left a comment') <> 1 then
    raise exception 'FAIL 1: expected one comment_received activity entry';
  end if;
  if (select count(*) from public.notifications where message = 'Standalone feedback') <> 1 then
    raise exception 'FAIL 1: expected one feedback notification';
  end if;
  raise notice 'PASS 1: a reviewer comment creates one activity entry and one notification';
end $$;

-- 2. Approval with message → one approval_received entry; its companion
--    comment exists but adds no second entry or notification.
do $$
begin
  if (select count(*) from public.activity
      where client_id = '00070000-0000-4000-8000-0000000000c1'
        and type = 'approval_received' and description = 'Rita approved a post') <> 1 then
    raise exception 'FAIL 2: expected one approval_received activity entry';
  end if;
  if (select count(*) from public.comments
      where post_id = '00070000-0000-4000-8000-0000000000a2' and body = 'Ship it') <> 1 then
    raise exception 'FAIL 2: companion comment missing';
  end if;
  if (select count(*) from public.activity
      where client_id = '00070000-0000-4000-8000-0000000000c1') <> 2 then
    raise exception 'FAIL 2: companion comment added an extra activity entry';
  end if;
  if (select count(*) from public.notifications where message = 'Ship it') <> 1 then
    raise exception 'FAIL 2: expected exactly one notification for the approval';
  end if;
  if (select approval_status from public.posts where id = '00070000-0000-4000-8000-0000000000a2') <> 'approved' then
    raise exception 'FAIL 2: reviewer approval did not update the post status';
  end if;
  raise notice 'PASS 2: approval → one activity entry, one notification, status updated';
end $$;

-- ---------------------------------------------------------------------------
-- Owner actions (authenticated as the fixture owner)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub": "00070000-0000-4000-8000-00000000000a", "role": "authenticated"}', true);
set local role authenticated;

-- 3. An owner-recorded approval moves the status in the same statement,
--    without a notification or activity entry.
do $$
begin
  insert into public.approvals (client_id, post_id, reviewer_name, status)
  values ('00070000-0000-4000-8000-0000000000c1', '00070000-0000-4000-8000-0000000000a1', 'Owner', 'changes_requested');
  if (select approval_status from public.posts where id = '00070000-0000-4000-8000-0000000000a1') <> 'changes_requested' then
    raise exception 'FAIL 3: owner approval did not update the post status';
  end if;
  raise notice 'PASS 3: owner approvals update the post status atomically';
end $$;

-- 4. set_post_media replaces the list with positions 0..n-1.
do $$
declare positions text;
begin
  perform public.set_post_media('00070000-0000-4000-8000-0000000000a1',
    '[{"media_type": "image", "url": "https://example.invalid/new-a.jpg", "width": 1080, "height": 1350},
      {"media_type": "video", "url": "https://example.invalid/new-b.mp4", "thumbnail_url": "https://example.invalid/new-b.jpg",
       "cover_source": "frame", "cover_timestamp": 1.5}]'::jsonb);
  select string_agg(position || '=' || url, ', ' order by position) into positions
  from public.post_media where post_id = '00070000-0000-4000-8000-0000000000a1';
  if positions is distinct from '0=https://example.invalid/new-a.jpg, 1=https://example.invalid/new-b.mp4' then
    raise exception 'FAIL 4: unexpected media after set_post_media: %', positions;
  end if;
  raise notice 'PASS 4: set_post_media replaces the media list in order';
end $$;

-- 5. A failing set_post_media changes nothing (atomic).
do $$
begin
  begin
    perform public.set_post_media('00070000-0000-4000-8000-0000000000a1',
      '[{"media_type": "image", "url": "https://example.invalid/would-replace.jpg"},
        {"media_type": "not-a-type", "url": "https://example.invalid/bad.jpg"}]'::jsonb);
    raise exception 'FAIL 5: invalid media_type was accepted';
  exception when invalid_text_representation then null;
  end;
  if (select count(*) from public.post_media
      where post_id = '00070000-0000-4000-8000-0000000000a1' and url like '%new-%') <> 2 then
    raise exception 'FAIL 5: a failed set_post_media left the media list changed';
  end if;
  raise notice 'PASS 5: a failed set_post_media leaves the existing media untouched';
end $$;

-- 6. Reorders apply in one statement and ignore ids from other clients.
do $$
begin
  perform public.reorder_posts('00070000-0000-4000-8000-0000000000c1',
    array['00070000-0000-4000-8000-0000000000a2', '00070000-0000-4000-8000-0000000000a1',
          '00070000-0000-4000-8000-00000000dead']::uuid[]);
  perform public.reorder_highlights('00070000-0000-4000-8000-0000000000c1',
    array['00070000-0000-4000-8000-0000000000e2', '00070000-0000-4000-8000-0000000000e1']::uuid[]);
  if (select grid_position from public.posts where id = '00070000-0000-4000-8000-0000000000a2') <> 0
     or (select grid_position from public.posts where id = '00070000-0000-4000-8000-0000000000a1') <> 1
     or (select position from public.highlights where id = '00070000-0000-4000-8000-0000000000e2') <> 0
     or (select position from public.highlights where id = '00070000-0000-4000-8000-0000000000e1') <> 1 then
    raise exception 'FAIL 6: reorder did not apply';
  end if;
  raise notice 'PASS 6: reorder_posts / reorder_highlights apply the new order';
end $$;

-- 7. Another signed-in user can't touch the owner's media or order.
select set_config('request.jwt.claims', '{"sub": "00070000-0000-4000-8000-00000000000b", "role": "authenticated"}', true);
do $$
begin
  begin
    perform public.set_post_media('00070000-0000-4000-8000-0000000000a1', '[]'::jsonb);
    raise exception 'FAIL 7: a stranger replaced the owner''s media';
  exception when raise_exception then
    if sqlerrm <> 'not_found' then raise; end if;
  end;
  perform public.reorder_posts('00070000-0000-4000-8000-0000000000c1',
    array['00070000-0000-4000-8000-0000000000a1', '00070000-0000-4000-8000-0000000000a2']::uuid[]);
  raise notice 'PASS 7a: a stranger gets not_found from set_post_media';
end $$;

reset role;

do $$
begin
  if (select grid_position from public.posts where id = '00070000-0000-4000-8000-0000000000a2') <> 0 then
    raise exception 'FAIL 7: a stranger''s reorder changed the owner''s posts';
  end if;
  if (select count(*) from public.post_media where post_id = '00070000-0000-4000-8000-0000000000a1') <> 2 then
    raise exception 'FAIL 7: owner media changed';
  end if;
  raise notice 'PASS 7: RLS keeps other users away from the owner''s media and order';
end $$;

-- 8. Anonymous callers can't execute the owner RPCs at all.
set local role anon;
do $$
begin
  begin
    perform public.set_post_media('00070000-0000-4000-8000-0000000000a1', '[]'::jsonb);
    raise exception 'FAIL 8: anon executed set_post_media';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.reorder_posts('00070000-0000-4000-8000-0000000000c1', array[]::uuid[]);
    raise exception 'FAIL 8: anon executed reorder_posts';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS 8: anon cannot execute set_post_media / reorder_*';
end $$;
reset role;

-- 9. Every public SECURITY DEFINER function still has an empty search_path.
do $$
declare offenders text;
begin
  select string_agg(p.proname, ', ') into offenders
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and not coalesce(p.proconfig @> array['search_path=""'], false);
  if offenders is not null then raise exception 'FAIL 9: definer functions without empty search_path: %', offenders; end if;
  raise notice 'PASS 9: all public SECURITY DEFINER functions use search_path = ''''';
end $$;

select 'ALL 0007 CHECKS PASSED — rolling back, nothing was saved' as result;

rollback;
