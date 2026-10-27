-- Verification for migration 0008 (duplicate_client).
--
-- SAFE TO RUN ON A REAL DATABASE: one transaction, ROLLED BACK at the end,
-- with its own throwaway fixtures. Requires 0006–0008.
-- Note: check 7 adds a temporary NOT VALID constraint to post_media, which
-- holds a brief exclusive lock on that table until the rollback (well under
-- a second) — run it at a quiet moment on production.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/verify/0008_verify.sql
--
-- Prints PASS 1 … PASS 8; the first broken rule stops with "FAIL n: …".

begin;

insert into auth.users (id, email) values
  ('00080000-0000-4000-8000-00000000000a', 'verify-0008-owner@example.invalid'),
  ('00080000-0000-4000-8000-00000000000b', 'verify-0008-stranger@example.invalid');

-- From 0010 on, new accounts start PENDING; approve this script's owner so
-- its checks run as an approved team member. Other fixture users stay
-- pending ("another, non-member user"). A no-op before 0010.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'profiles' and column_name = 'status') then
    execute 'update public.profiles set status = ''approved'' where id = $1'
      using '00080000-0000-4000-8000-00000000000a'::uuid;
  end if;
end $$;

insert into public.clients (id, owner_id, name, slug, instagram_username, bio, theme, followers_count) values
  ('00080000-0000-4000-8000-0000000000c1', '00080000-0000-4000-8000-00000000000a',
   'Dup Source', 'dup-source', 'dup_source', 'Bio line', 'dark', 4200),
  ('00080000-0000-4000-8000-0000000000c2', '00080000-0000-4000-8000-00000000000a',
   repeat('L', 120), 'long-name', repeat('u', 60), '', 'light', 0);

insert into public.highlights (client_id, title, cover_url, position) values
  ('00080000-0000-4000-8000-0000000000c1', 'Travel', 'https://example.invalid/h1.jpg', 0),
  ('00080000-0000-4000-8000-0000000000c1', 'Studio', null, 1);

insert into public.posts (id, client_id, name, stage, type, approval_status, grid_position, is_pinned, hashtags) values
  ('00080000-0000-4000-8000-0000000000a1', '00080000-0000-4000-8000-0000000000c1', 'Carousel', 'post', 'carousel', 'approved', 0, true, '{one,two}'),
  ('00080000-0000-4000-8000-0000000000a2', '00080000-0000-4000-8000-0000000000c1', 'Draft package', 'content', 'image', 'not_sent', 1, false, '{}');

insert into public.post_media (post_id, media_type, url, thumbnail_url, cover_source, cover_timestamp, position) values
  ('00080000-0000-4000-8000-0000000000a1', 'image', 'https://example.invalid/a1-0.jpg', null, null, null, 0),
  ('00080000-0000-4000-8000-0000000000a1', 'video', 'https://example.invalid/a1-1.mp4', 'https://example.invalid/a1-1.jpg', 'frame', 2.5, 1),
  ('00080000-0000-4000-8000-0000000000a2', 'image', 'https://example.invalid/a2-0.jpg', null, null, null, 0);

insert into public.comments (post_id, author_name, body) values
  ('00080000-0000-4000-8000-0000000000a1', 'Reviewer', 'Not copied');
insert into public.approvals (client_id, post_id, reviewer_name, status) values
  ('00080000-0000-4000-8000-0000000000c1', '00080000-0000-4000-8000-0000000000a1', 'Reviewer', 'approved');
insert into public.share_links (client_id, token) values
  ('00080000-0000-4000-8000-0000000000c1', 'verify0008-source-link');

-- Remember the copies made below (temp table, gone at rollback).
create temp table verify_0008_copy (id uuid);
grant all on verify_0008_copy to authenticated;

-- ---------------------------------------------------------------------------
-- As the owner
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub": "00080000-0000-4000-8000-00000000000a", "role": "authenticated"}', true);
set local role authenticated;

-- 1. The new client row: fresh id/slug, suffixed name/username, same profile.
do $$
declare c public.clients;
begin
  c := public.duplicate_client('00080000-0000-4000-8000-0000000000c1');
  insert into verify_0008_copy values (c.id);
  if c.id = '00080000-0000-4000-8000-0000000000c1' or c.slug = 'dup-source'
     or c.name <> 'Dup Source copy' or c.instagram_username <> 'dup_source.copy'
     or c.owner_id <> '00080000-0000-4000-8000-00000000000a'
     or c.bio <> 'Bio line' or c.theme <> 'dark' or c.followers_count <> 4200 then
    raise exception 'FAIL 1: unexpected copy %', row_to_json(c);
  end if;
  raise notice 'PASS 1: duplicate_client returns a new client with the copied profile';
end $$;

-- 2. Highlights, posts (incl. content packages) and media copied with new ids.
do $$
declare copy_id uuid := (select id from verify_0008_copy);
begin
  if (select string_agg(title || ':' || position, ',' order by position) from public.highlights where client_id = copy_id)
     is distinct from 'Travel:0,Studio:1' then
    raise exception 'FAIL 2: highlights not copied';
  end if;
  if (select string_agg(name || ':' || stage || ':' || type || ':' || approval_status || ':' || is_pinned || ':' || array_to_string(hashtags, '|'),
                        ',' order by grid_position) from public.posts where client_id = copy_id)
     is distinct from 'Carousel:post:carousel:approved:true:one|two,Draft package:content:image:not_sent:false:' then
    raise exception 'FAIL 2: posts not copied faithfully';
  end if;
  if exists (select 1 from public.posts where client_id = copy_id
             and id in ('00080000-0000-4000-8000-0000000000a1', '00080000-0000-4000-8000-0000000000a2')) then
    raise exception 'FAIL 2: copied posts reuse source ids';
  end if;
  if (select string_agg(p.name || '#' || m.position || '=' || m.url || '|' || coalesce(m.cover_source, '-') || '|' || coalesce(m.cover_timestamp::text, '-'),
                        ',' order by p.name, m.position)
      from public.post_media m join public.posts p on p.id = m.post_id where p.client_id = copy_id)
     is distinct from 'Carousel#0=https://example.invalid/a1-0.jpg|-|-,Carousel#1=https://example.invalid/a1-1.mp4|frame|2.5,Draft package#0=https://example.invalid/a2-0.jpg|-|-' then
    raise exception 'FAIL 2: media not copied to the matching new posts';
  end if;
  raise notice 'PASS 2: highlights, posts and media copied with fresh ids and correct links';
end $$;

-- 3. Comments, approvals, share links and activity are not copied.
do $$
declare copy_id uuid := (select id from verify_0008_copy);
begin
  if exists (select 1 from public.comments c join public.posts p on p.id = c.post_id where p.client_id = copy_id)
     or exists (select 1 from public.approvals where client_id = copy_id)
     or exists (select 1 from public.share_links where client_id = copy_id)
     or exists (select 1 from public.activity where client_id = copy_id) then
    raise exception 'FAIL 3: review history or share links were copied';
  end if;
  raise notice 'PASS 3: comments, approvals, share links and activity stay with the source';
end $$;

-- 4. Long names still fit their limits after the suffix.
do $$
declare c public.clients;
begin
  c := public.duplicate_client('00080000-0000-4000-8000-0000000000c2');
  if char_length(c.name) > 120 or right(c.name, 5) <> ' copy'
     or char_length(c.instagram_username) > 60 or right(c.instagram_username, 5) <> '.copy' then
    raise exception 'FAIL 4: long name/username not trimmed: % / %', c.name, c.instagram_username;
  end if;
  raise notice 'PASS 4: long names are trimmed to fit with the suffix';
end $$;

-- 5. Another user can't duplicate the owner's client.
select set_config('request.jwt.claims', '{"sub": "00080000-0000-4000-8000-00000000000b", "role": "authenticated"}', true);
do $$
begin
  begin
    perform public.duplicate_client('00080000-0000-4000-8000-0000000000c1');
    raise exception 'FAIL 5: a stranger duplicated the client';
  exception when raise_exception then
    if sqlerrm <> 'not_found' then raise; end if;
  end;
  raise notice 'PASS 5: other users get not_found';
end $$;

-- 6. Anonymous callers can't execute it.
set local role anon;
do $$
begin
  begin
    perform public.duplicate_client('00080000-0000-4000-8000-0000000000c1');
    raise exception 'FAIL 6: anon executed duplicate_client';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS 6: anon cannot execute duplicate_client';
end $$;

-- 7. A failure part way through leaves no partial copy (atomic).
reset role;
insert into public.post_media (post_id, url, position)
  values ('00080000-0000-4000-8000-0000000000a2', 'https://example.invalid/poison.jpg', 1);
-- NOT VALID: the existing poison row is allowed, a copied one is not.
alter table public.post_media
  add constraint verify_0008_poison check (url <> 'https://example.invalid/poison.jpg') not valid;
select set_config('request.jwt.claims', '{"sub": "00080000-0000-4000-8000-00000000000a", "role": "authenticated"}', true);
set local role authenticated;
do $$
declare
  before_clients int := (select count(*) from public.clients);
  before_posts int := (select count(*) from public.posts);
  before_highlights int := (select count(*) from public.highlights);
begin
  begin
    perform public.duplicate_client('00080000-0000-4000-8000-0000000000c1');
    raise exception 'FAIL 7: the poisoned copy succeeded';
  exception when check_violation then null;
  end;
  if (select count(*) from public.clients) <> before_clients
     or (select count(*) from public.posts) <> before_posts
     or (select count(*) from public.highlights) <> before_highlights then
    raise exception 'FAIL 7: a failed duplicate left partial rows behind';
  end if;
  raise notice 'PASS 7: a failed duplicate leaves nothing behind';
end $$;
reset role;

-- 8. Every public SECURITY DEFINER function still has an empty search_path.
do $$
declare offenders text;
begin
  select string_agg(p.proname, ', ') into offenders
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and not coalesce(p.proconfig @> array['search_path=""'], false);
  if offenders is not null then raise exception 'FAIL 8: definer functions without empty search_path: %', offenders; end if;
  raise notice 'PASS 8: all public SECURITY DEFINER functions use search_path = ''''';
end $$;

select 'ALL 0008 CHECKS PASSED — rolling back, nothing was saved' as result;

rollback;
