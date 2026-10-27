-- Team workspace with owner approval (builds on 0009).
--
-- One shared workspace for the whole platform: every APPROVED account works
-- on the same clients, posts, calendar, share links and notifications.
-- Exactly one account is the OWNER (chosen in the Supabase dashboard — see
-- docs/DEPLOY_GUIDE.md "Appointing the owner").
--
--   profiles.role    'member' | 'owner'   (at most one owner, always approved)
--   profiles.status  'pending' | 'approved'
--
-- * Existing accounts become approved members; new sign-ups start PENDING
--   and can read nothing but their own profile (RLS, not just the UI).
-- * Nobody can change a role or status from the app or the API: the API
--   roles have no UPDATE privilege on those columns, and a guard trigger
--   refuses any change whose statement runs as `anon` / `authenticated`
--   (the database role of every PostgREST request — not spoofable by JWT
--   claims or headers). The dashboard, the service-role key and the
--   approve function below run as other roles.
-- * approve_member / reject_member: owner-only. Reject deletes the pending
--   account from auth.users (profile, sessions, identities cascade) so the
--   person can sign up again — done here in Postgres, no service-role key
--   in the app.
-- * Permissions: members can do everything except delete clients and
--   manage the team (owner only).
-- * Notifications are team-wide with per-user read state
--   (notification_reads). New sign-ups notify the owner only.
-- * Storage: approved members upload to their own folder; deletes are
--   allowed in any approved member's folder (team cleanup), never others.
-- * duplicate_client (0009) now records the duplicating member as creator.
-- * Share links (0006 RPCs) are unchanged.
--
-- One transaction. Rollback: supabase/rollback/0010_rollback.sql.

begin;

-- ---------------------------------------------------------------------------
-- 1. Roles and approval status
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column role text not null default 'member' check (role in ('owner', 'member')),
  -- 'approved' only while adding the column, so EXISTING accounts are approved…
  add column status text not null default 'approved' check (status in ('pending', 'approved')),
  add column approved_at timestamptz,
  add column email_confirmed boolean not null default false;

update public.profiles set approved_at = now();
update public.profiles p
  set email_confirmed = (u.email_confirmed_at is not null)
  from auth.users u
  where u.id = p.id;

-- …and every account created from now on starts pending.
alter table public.profiles alter column status set default 'pending';

alter table public.profiles
  add constraint profiles_owner_is_approved check (role <> 'owner' or status = 'approved');
-- At most one owner on the whole platform.
create unique index profiles_single_owner on public.profiles ((true)) where role = 'owner';

-- ---------------------------------------------------------------------------
-- 2. Membership helpers (used by RLS)
-- ---------------------------------------------------------------------------

create or replace function public.is_active_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'approved');
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'owner' and status = 'approved'
  );
$$;

-- Storage folders are named after the uploading user's id.
create or replace function public.is_team_folder(folder text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id::text = folder and status = 'approved');
$$;

-- Same name, team meaning: every policy that used "the caller owns this
-- client" now means "the caller is an approved team member" (one shared
-- workspace), so highlights, posts, media, comments, approvals, share links
-- and activity follow automatically.
create or replace function public.owns_client(cid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_active_member() and exists (select 1 from public.clients where id = cid);
$$;

-- ---------------------------------------------------------------------------
-- 3. Nobody changes their own role/status from the app or the API
-- ---------------------------------------------------------------------------

revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

-- SECURITY INVOKER on purpose: current_user must be the role running the
-- statement ('authenticated' for API requests). Inside a SECURITY DEFINER
-- function it would be the function owner instead.
create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' and (new.role <> 'member' or new.status <> 'pending' or new.approved_at is not null) then
      raise exception 'role_change_not_allowed';
    end if;
    if tg_op = 'UPDATE' and (
      new.id <> old.id
      or new.role is distinct from old.role
      or new.status is distinct from old.status
      or new.approved_at is distinct from old.approved_at
      or new.email_confirmed is distinct from old.email_confirmed
    ) then
      raise exception 'role_change_not_allowed';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_guard_privileges before insert or update on public.profiles
  for each row execute function public.guard_profile_privileges();

drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update" on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);
-- Members see the team; the owner also sees pending sign-ups.
create policy "profiles team read" on public.profiles for select
  using (public.is_owner() or (public.is_active_member() and status = 'approved'));

-- ---------------------------------------------------------------------------
-- 4. Clients: shared by the team; only the owner deletes
-- ---------------------------------------------------------------------------

drop policy if exists "clients owner all" on public.clients;
create policy "clients team read" on public.clients for select
  using (public.is_active_member());
create policy "clients team insert" on public.clients for insert
  with check (public.is_active_member() and owner_id = auth.uid());
create policy "clients team update" on public.clients for update
  using (public.is_active_member()) with check (public.is_active_member());
create policy "clients owner delete" on public.clients for delete
  using (public.is_owner());

-- ---------------------------------------------------------------------------
-- 5. Notifications: team-wide, read state per person
-- ---------------------------------------------------------------------------

alter table public.notifications
  alter column recipient_id drop not null,
  alter column client_id drop not null,
  add column audience text not null default 'team' check (audience in ('team', 'owner')),
  add column subject_user_id uuid references public.profiles (id) on delete cascade;

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (
  type in ('review_changes_requested', 'review_approved', 'review_feedback_received', 'member_signup')
);

create table public.notification_reads (
  notification_id uuid not null references public.notifications (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);
create index notification_reads_user_idx on public.notification_reads (user_id);

-- Keep what each recipient had already read.
insert into public.notification_reads (notification_id, user_id, read_at)
  select id, recipient_id, created_at from public.notifications
  where is_read and recipient_id is not null;

alter table public.notification_reads enable row level security;
create policy "notification_reads own" on public.notification_reads for all
  using (user_id = auth.uid() and public.is_active_member())
  with check (user_id = auth.uid() and public.is_active_member());

drop policy if exists "notifications recipient read" on public.notifications;
drop policy if exists "notifications recipient update" on public.notifications;
create policy "notifications team read" on public.notifications for select
  using (
    (audience = 'team' and public.is_active_member())
    or (audience = 'owner' and public.is_owner())
  );

-- Mark visible notifications read for the caller (all, or the given ids).
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns void language sql volatile security invoker set search_path = '' as $$
  insert into public.notification_reads (notification_id, user_id)
  select n.id, auth.uid() from public.notifications n
  where p_ids is null or n.id = any (p_ids)
  on conflict do nothing;
$$;

-- Review events (0005/0006 triggers) now notify the whole team. The
-- signature is unchanged; `recipient` is kept as the client's creator.
create or replace function public.notify_review_event(
  recipient uuid, cid uuid, pid uuid, ntype text, ntitle text, nmessage text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.notifications
    where audience = 'team'
      and client_id is not distinct from cid
      and post_id is not distinct from pid
      and message = nmessage
      and created_at > now() - interval '30 seconds'
  ) then return; end if;
  insert into public.notifications (recipient_id, client_id, post_id, type, title, message, audience)
  values (recipient, cid, pid, ntype, ntitle, nmessage, 'team');
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Sign-ups: pending profile; the owner is notified once the email is
--    confirmed (immediately when confirmation is off)
-- ---------------------------------------------------------------------------

create or replace function public.notify_member_signup(p_user_id uuid)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (audience, type, title, message, subject_user_id)
  select 'owner', 'member_signup',
         left(coalesce(nullif(p.display_name, ''), p.email) || ' is waiting for approval', 200),
         p.email, p.id
  from public.profiles p
  where p.id = p_user_id and p.status = 'pending'
    and not exists (
      select 1 from public.notifications n
      where n.subject_user_id = p.id and n.type = 'member_signup'
    );
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, display_name, email_confirmed)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.email_confirmed_at is not null
  );
  if new.email_confirmed_at is not null then
    perform public.notify_member_signup(new.id);
  end if;
  return new;
end;
$$;

create or replace function public.handle_user_confirmed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    update public.profiles set email_confirmed = true where id = new.id;
    perform public.notify_member_signup(new.id);
  end if;
  return new;
end;
$$;

create trigger on_auth_user_confirmed after update of email_confirmed_at on auth.users
  for each row execute function public.handle_user_confirmed();

-- ---------------------------------------------------------------------------
-- 7. Owner actions
-- ---------------------------------------------------------------------------

create or replace function public.approve_member(p_user_id uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.is_owner() then raise exception 'not_owner'; end if;
  update public.profiles
    set status = 'approved', approved_at = now()
    where id = p_user_id and status = 'pending';
  if not found then raise exception 'not_found'; end if;
end;
$$;

-- Deletes a PENDING account completely (profile, sessions and identities
-- cascade from auth.users), so the person can sign up again from scratch.
-- Pending accounts own no data: RLS lets them create nothing.
create or replace function public.reject_member(p_user_id uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.is_owner() then raise exception 'not_owner'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id and status = 'pending') then
    raise exception 'not_found';
  end if;
  delete from auth.users where id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. duplicate_client: the duplicating member is the copy's creator
--    (0009 version otherwise unchanged)
-- ---------------------------------------------------------------------------

create or replace function public.duplicate_client(p_client_id uuid)
returns public.clients
language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_source public.clients;
  v_copy public.clients;
  v_post_ids jsonb;
begin
  -- Under RLS only approved team members see the client.
  select * into v_source from public.clients where id = p_client_id;
  if not found then raise exception 'not_found'; end if;

  insert into public.clients (
    owner_id, name, slug, instagram_username, profile_name, avatar_url, category,
    bio, website, threads_username, note, is_private, is_verified, account_type,
    posts_count, followers_count, following_count, theme
  ) values (
    auth.uid(),
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

-- ---------------------------------------------------------------------------
-- 9. Storage: own-folder uploads for approved members; team-folder deletes
-- ---------------------------------------------------------------------------

drop policy if exists "media owner write" on storage.objects;
drop policy if exists "media owner update" on storage.objects;
drop policy if exists "media owner delete" on storage.objects;

create policy "media member write" on storage.objects for insert
  with check (
    bucket_id in ('avatars', 'highlights', 'post-media')
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_active_member()
  );
create policy "media member update" on storage.objects for update
  using (
    bucket_id in ('avatars', 'highlights', 'post-media')
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_active_member()
  );
-- Lets a member clean up a teammate's file that no row references any more;
-- folders of pending/rejected or unknown accounts stay untouchable.
create policy "media team delete" on storage.objects for delete
  using (
    bucket_id in ('avatars', 'highlights', 'post-media')
    and public.is_active_member()
    and public.is_team_folder((storage.foldername(name))[1])
  );

-- ---------------------------------------------------------------------------
-- 10. Function privileges
-- ---------------------------------------------------------------------------

revoke execute on function public.approve_member(uuid) from public, anon;
revoke execute on function public.reject_member(uuid) from public, anon;
revoke execute on function public.mark_notifications_read(uuid[]) from public, anon;
revoke execute on function public.notify_member_signup(uuid) from public, anon, authenticated;
grant execute on function public.approve_member(uuid) to authenticated;
grant execute on function public.reject_member(uuid) to authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

commit;
