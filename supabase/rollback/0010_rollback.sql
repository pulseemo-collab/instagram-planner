-- Rollback for supabase/migrations/0010_team_workspace.sql
--
-- Restores the exact 0009 state: per-account workspaces again (each account
-- sees only the clients it created), recipient-based notifications, and the
-- pre-0010 helper functions, policies and grants (copied verbatim from
-- 0001 / 0005 / 0006 / 0009). Kept OUTSIDE supabase/migrations/. Roll the app
-- back too (docs/DEPLOY_GUIDE.md §5) — the 0010 app calls functions this drops.
--
-- What is lost: roles/approval status, sign-up notifications, and per-user
-- read state beyond each notification's original recipient. Accounts that
-- were still pending become ordinary accounts again.

begin;

-- Owner actions, sign-up notifications, read tracking
drop trigger if exists on_auth_user_confirmed on auth.users;
drop function if exists public.handle_user_confirmed();
drop function if exists public.approve_member(uuid);
drop function if exists public.reject_member(uuid);
drop function if exists public.mark_notifications_read(uuid[]);

-- Storage policies (0001 versions)
drop policy if exists "media member write" on storage.objects;
drop policy if exists "media member update" on storage.objects;
drop policy if exists "media team delete" on storage.objects;
create policy "media owner write" on storage.objects for insert
  with check (
    bucket_id in ('avatars', 'highlights', 'post-media')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "media owner update" on storage.objects for update
  using (
    bucket_id in ('avatars', 'highlights', 'post-media')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "media owner delete" on storage.objects for delete
  using (
    bucket_id in ('avatars', 'highlights', 'post-media')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Notifications back to one recipient each
drop policy if exists "notifications team read" on public.notifications;
update public.notifications n
  set is_read = exists (
    select 1 from public.notification_reads r
    where r.notification_id = n.id and r.user_id = n.recipient_id
  )
  where n.recipient_id is not null;
delete from public.notifications where recipient_id is null or client_id is null;
drop table if exists public.notification_reads;
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (
    type in ('review_changes_requested', 'review_approved', 'review_feedback_received')
  );
alter table public.notifications
  drop column if exists subject_user_id,
  drop column if exists audience,
  alter column recipient_id set not null,
  alter column client_id set not null;
create policy "notifications recipient read" on public.notifications for select
  using (recipient_id = auth.uid());
create policy "notifications recipient update" on public.notifications for update
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- Clients: owner-only again (0001)
drop policy if exists "clients team read" on public.clients;
drop policy if exists "clients team insert" on public.clients;
drop policy if exists "clients team update" on public.clients;
drop policy if exists "clients owner delete" on public.clients;
create policy "clients owner all" on public.clients for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Profiles: policies, grants and columns
drop policy if exists "profiles team read" on public.profiles;
drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update" on public.profiles for update using (auth.uid() = id);
drop trigger if exists profiles_guard_privileges on public.profiles;
drop function if exists public.guard_profile_privileges();
grant all on public.profiles to anon, authenticated;

-- Pre-0010 functions (verbatim)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create or replace function public.owns_client(cid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.clients where id = cid and owner_id = auth.uid());
$$;

create or replace function public.notify_review_event(
  recipient uuid, cid uuid, pid uuid, ntype text, ntitle text, nmessage text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if recipient is null then return; end if;
  if exists (
    select 1 from public.notifications
    where recipient_id = recipient
      and post_id is not distinct from pid
      and message = nmessage
      and created_at > now() - interval '30 seconds'
  ) then return; end if;
  insert into public.notifications (recipient_id, client_id, post_id, type, title, message)
  values (recipient, cid, pid, ntype, ntitle, nmessage);
end;
$$;

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
    approval_status, scheduled_at, scheduled_day, published_at, is_pinned, grid_position,
    likes_count, comments_count
  )
  select
    (v_post_ids ->> p.id::text)::uuid, v_copy.id, p.name, p.stage, p.type, p.caption,
    p.location, p.alt_text, p.hashtags, p.status, p.approval_status, p.scheduled_at,
    p.scheduled_day, p.published_at, p.is_pinned, p.grid_position, p.likes_count, p.comments_count
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

drop function if exists public.notify_member_signup(uuid);
drop function if exists public.is_team_folder(text);
drop function if exists public.is_owner();
drop function if exists public.is_active_member();

drop index if exists public.profiles_single_owner;
alter table public.profiles
  drop constraint if exists profiles_owner_is_approved,
  drop column if exists email_confirmed,
  drop column if exists approved_at,
  drop column if exists status,
  drop column if exists role;

commit;
