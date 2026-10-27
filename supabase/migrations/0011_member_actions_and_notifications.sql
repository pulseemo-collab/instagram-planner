-- Member actions and notification housekeeping (builds on 0010).
--
-- * profiles.status gains 'suspended': the account is kept but sees nothing
--   (is_active_member() only accepts 'approved', so every RLS policy already
--   blocks it — same as pending).
-- * suspend_member / restore_member / remove_member: owner-only, never on
--   the owner or the caller. Remove deletes the account from auth.users like
--   reject_member.
-- * Deleting a profile (remove_member, reject_member, or a delete in the
--   Supabase dashboard) no longer cascades the team's data away: a BEFORE
--   DELETE trigger moves the person's clients to the owner and keeps the
--   team's review notifications. It REFUSES to delete the owner, or anyone
--   while no owner exists (there would be nobody to move the clients to).
-- * Removed members are remembered in former_members, so their uploaded
--   files (still used by the clients that moved to the owner) can be cleaned
--   up later by the team — exact paths only, once nothing references them.
-- * "X is waiting for approval" notifications disappear for everyone as soon
--   as that account stops being pending, however that happens (app, SQL,
--   Table Editor). Existing stale ones are deleted here.
-- * Notifications older than 30 days that every recipient has read are
--   deleted whenever someone marks a notification read.
--
-- Backward-compatible with the 0010 app: it treats any status other than
-- 'approved' as pending (waiting screen), and nothing it calls changes.
--
-- One transaction. Rollback: supabase/rollback/0011_rollback.sql.

begin;

-- ---------------------------------------------------------------------------
-- 1. Suspended accounts
-- ---------------------------------------------------------------------------

alter table public.profiles drop constraint profiles_status_check;
alter table public.profiles add constraint profiles_status_check
  check (status in ('pending', 'approved', 'suspended'));

-- Removed team members (their ids name Storage folders the team may still
-- need to clean up). Read only through SECURITY DEFINER functions.
create table public.former_members (
  id uuid primary key,
  email text not null,
  removed_at timestamptz not null default now()
);
alter table public.former_members enable row level security;
revoke all on public.former_members from anon, authenticated;

-- Folders of approved, suspended and removed members: files there may still
-- be referenced by team data. Pending or unknown accounts never qualify.
create or replace function public.is_team_folder(folder text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
      select 1 from public.profiles
      where id::text = folder and status in ('approved', 'suspended')
    )
    or exists (select 1 from public.former_members where id::text = folder);
$$;

-- Which of the given folders the app's cleanup may delete from (team members
-- only; the Storage delete policy checks the same rule again).
create or replace function public.team_media_folders(p_folders text[])
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(f), '{}')
  from unnest(p_folders) f
  where public.is_active_member() and public.is_team_folder(f);
$$;

-- ---------------------------------------------------------------------------
-- 2. Deleting a profile keeps the team's data
-- ---------------------------------------------------------------------------

create or replace function public.handle_profile_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
begin
  if old.role = 'owner' then
    raise exception 'Refused: % is the workspace owner and can''t be deleted. Make another account the owner first (profiles.role in the Table Editor), then delete this one.', old.email;
  end if;
  select id into v_owner from public.profiles where role = 'owner';
  if v_owner is null then
    raise exception 'Refused: there is no workspace owner, so % can''t be deleted (their clients would be lost). Appoint an owner first (profiles.role in the Table Editor).', old.email;
  end if;

  -- Without this, ON DELETE CASCADE would delete every client they created.
  update public.clients set owner_id = v_owner where owner_id = old.id;
  -- Review notifications are team-wide; recipient_id only names the creator.
  update public.notifications set recipient_id = null where recipient_id = old.id;
  if old.status in ('approved', 'suspended') then
    insert into public.former_members (id, email) values (old.id, old.email)
      on conflict (id) do nothing;
  end if;
  return old;
end;
$$;

create trigger profiles_before_delete before delete on public.profiles
  for each row execute function public.handle_profile_delete();

-- ---------------------------------------------------------------------------
-- 3. Owner actions
-- ---------------------------------------------------------------------------

create or replace function public.suspend_member(p_user_id uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.is_owner() then raise exception 'not_owner'; end if;
  if p_user_id = auth.uid() then raise exception 'not_allowed'; end if;
  update public.profiles set status = 'suspended'
    where id = p_user_id and role = 'member' and status = 'approved';
  if not found then raise exception 'not_found'; end if;
end;
$$;

create or replace function public.restore_member(p_user_id uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.is_owner() then raise exception 'not_owner'; end if;
  update public.profiles
    set status = 'approved', approved_at = coalesce(approved_at, now())
    where id = p_user_id and role = 'member' and status = 'suspended';
  if not found then raise exception 'not_found'; end if;
end;
$$;

-- Deletes a member's account completely (profile, sessions and identities
-- cascade from auth.users); the delete trigger above moves their clients to
-- the owner first. Pending accounts are rejected with reject_member instead.
create or replace function public.remove_member(p_user_id uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.is_owner() then raise exception 'not_owner'; end if;
  if p_user_id = auth.uid() then raise exception 'not_allowed'; end if;
  if not exists (
    select 1 from public.profiles
    where id = p_user_id and role = 'member' and status in ('approved', 'suspended')
  ) then
    raise exception 'not_found';
  end if;
  delete from auth.users where id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Sign-up notifications resolve themselves
-- ---------------------------------------------------------------------------

-- Fires on every change of the row (any column list, any caller), so a
-- status/role edit in the Table Editor counts too.
create or replace function public.resolve_member_signup()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.notifications
    where type = 'member_signup' and subject_user_id = new.id;
  return null;
end;
$$;

create trigger profiles_resolve_signup after update on public.profiles
  for each row when (new.status <> 'pending')
  execute function public.resolve_member_signup();

-- Stale ones from before this migration (e.g. an account made owner in the
-- Table Editor while its notice was still open).
delete from public.notifications n
  where n.type = 'member_signup'
    and not exists (
      select 1 from public.profiles p where p.id = n.subject_user_id and p.status = 'pending'
    );

-- ---------------------------------------------------------------------------
-- 5. Read notifications older than 30 days are deleted
-- ---------------------------------------------------------------------------

create index notifications_created_idx on public.notifications (created_at);

-- A notification goes once it is older than 30 days and every current
-- recipient (approved members for 'team', the owner for 'owner') has read it.
create or replace function public.purge_read_notifications()
returns void language sql volatile security definer set search_path = '' as $$
  delete from public.notifications n
  where n.created_at < now() - interval '30 days'
    and not exists (
      select 1 from public.profiles p
      where p.status = 'approved'
        and (n.audience = 'team' or p.role = 'owner')
        and not exists (
          select 1 from public.notification_reads r
          where r.notification_id = n.id and r.user_id = p.id
        )
    );
$$;

-- There is no scheduler: the purge runs whenever something is marked read.
create or replace function public.purge_after_read()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.purge_read_notifications();
  return null;
end;
$$;

create trigger notification_reads_purge after insert on public.notification_reads
  for each statement execute function public.purge_after_read();

-- ---------------------------------------------------------------------------
-- 6. Function privileges
-- ---------------------------------------------------------------------------

revoke execute on function public.suspend_member(uuid) from public, anon;
revoke execute on function public.restore_member(uuid) from public, anon;
revoke execute on function public.remove_member(uuid) from public, anon;
revoke execute on function public.team_media_folders(text[]) from public, anon;
revoke execute on function public.purge_read_notifications() from public, anon, authenticated;
grant execute on function public.suspend_member(uuid) to authenticated;
grant execute on function public.restore_member(uuid) to authenticated;
grant execute on function public.remove_member(uuid) to authenticated;
grant execute on function public.team_media_folders(text[]) to authenticated;

commit;
