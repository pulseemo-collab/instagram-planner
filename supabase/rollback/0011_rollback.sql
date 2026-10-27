-- Rollback for supabase/migrations/0011_member_actions_and_notifications.sql
--
-- Restores the exact 0010 state. Kept OUTSIDE supabase/migrations/. Roll the
-- app back too — the 0011 app calls functions this drops.
--
-- What is lost: suspended accounts become PENDING again (they still see
-- nothing, and reappear under "Waiting for approval"); the list of removed
-- members, so their old Storage folders can no longer be cleaned up from the
-- app. Notifications 0011 deleted (resolved sign-ups, 30-day purge) can't be
-- brought back. Clients already moved to the owner stay with the owner.
-- Without the delete trigger, deleting an account cascades its clients again.

begin;

drop trigger if exists notification_reads_purge on public.notification_reads;
drop function if exists public.purge_after_read();
drop function if exists public.purge_read_notifications();
drop index if exists public.notifications_created_idx;

drop trigger if exists profiles_resolve_signup on public.profiles;
drop function if exists public.resolve_member_signup();

drop function if exists public.suspend_member(uuid);
drop function if exists public.restore_member(uuid);
drop function if exists public.remove_member(uuid);

drop trigger if exists profiles_before_delete on public.profiles;
drop function if exists public.handle_profile_delete();

drop function if exists public.team_media_folders(text[]);
-- 0010 version (verbatim)
create or replace function public.is_team_folder(folder text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id::text = folder and status = 'approved');
$$;
drop table if exists public.former_members;

update public.profiles set status = 'pending' where status = 'suspended';
alter table public.profiles drop constraint profiles_status_check;
alter table public.profiles add constraint profiles_status_check
  check (status in ('pending', 'approved'));

commit;
