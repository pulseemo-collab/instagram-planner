-- Duplicate a client in one transaction (audit #20; builds on 0007).
--
--   duplicate_client(client) → the new client row
--
-- Copies the client, its highlights, posts (content packages included) and
-- post media — the same set the app copied before (no comments, approvals,
-- share links or activity) — with fresh ids. Previously the browser reloaded
-- the whole workspace and inserted rows one by one: slow, and a failure part
-- way through left a half-copied client.
--
-- SECURITY INVOKER: runs as the signed-in owner, so RLS decides what may be
-- read and written (only the owner can see the source client). Media files
-- are shared by URL, not copied; Storage cleanup only removes a file once no
-- row references it.
--
-- One transaction. Rollback: supabase/rollback/0008_rollback.sql.

begin;

create or replace function public.duplicate_client(p_client_id uuid)
returns public.clients
language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_source public.clients;
  v_copy public.clients;
  v_post_ids jsonb;
begin
  -- Under RLS only the owner sees the client.
  select * into v_source from public.clients where id = p_client_id;
  if not found then raise exception 'not_found'; end if;

  insert into public.clients (
    owner_id, name, slug, instagram_username, profile_name, avatar_url, category,
    bio, website, threads_username, note, is_private, is_verified, account_type,
    posts_count, followers_count, following_count, theme
  ) values (
    v_source.owner_id,
    -- Trimmed so the suffix never breaks the 120 / 60 character limits.
    left(v_source.name, 115) || ' copy',
    left(v_source.slug, 40) || '-copy-' || left(replace(gen_random_uuid()::text, '-', ''), 6),
    left(v_source.instagram_username, 55) || '.copy',
    v_source.profile_name, v_source.avatar_url, v_source.category,
    v_source.bio, v_source.website, v_source.threads_username, v_source.note,
    v_source.is_private, v_source.is_verified, v_source.account_type,
    v_source.posts_count, v_source.followers_count, v_source.following_count, v_source.theme
  )
  returning * into v_copy;

  insert into public.highlights (client_id, title, cover_url, position)
  select v_copy.id, h.title, h.cover_url, h.position
  from public.highlights h
  where h.client_id = v_source.id;

  -- Posts, then their media, as two statements sharing an old→new id map.
  -- (One statement with CTEs doesn't work: the post_media RLS check can't see
  -- posts inserted by a sibling CTE of the same statement.)
  select coalesce(jsonb_object_agg(p.id, gen_random_uuid()), '{}'::jsonb) into v_post_ids
  from public.posts p
  where p.client_id = v_source.id;

  insert into public.posts (
    id, client_id, name, stage, type, caption, location, alt_text, hashtags, status,
    approval_status, scheduled_at, published_at, is_pinned, grid_position,
    likes_count, comments_count
  )
  select
    (v_post_ids ->> p.id::text)::uuid, v_copy.id, p.name, p.stage, p.type, p.caption,
    p.location, p.alt_text, p.hashtags, p.status, p.approval_status, p.scheduled_at,
    p.published_at, p.is_pinned, p.grid_position, p.likes_count, p.comments_count
  from public.posts p
  where p.client_id = v_source.id;

  insert into public.post_media (
    post_id, media_type, url, thumbnail_url, cover_source, cover_timestamp, width, height, position
  )
  select
    (v_post_ids ->> m.post_id::text)::uuid, m.media_type, m.url, m.thumbnail_url,
    m.cover_source, m.cover_timestamp, m.width, m.height, m.position
  from public.post_media m
  join public.posts p on p.id = m.post_id
  where p.client_id = v_source.id;

  return v_copy;
end;
$$;

revoke execute on function public.duplicate_client(uuid) from public, anon;
grant execute on function public.duplicate_client(uuid) to authenticated;

commit;
