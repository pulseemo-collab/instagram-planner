-- Verification for migration 0011 (member actions + notification housekeeping).
--
-- SAFE TO RUN ON A REAL DATABASE: one transaction, ROLLED BACK at the end,
-- with its own throwaway fixtures. If your project already has an owner,
-- it is demoted INSIDE this transaction only (so a fixture owner can be
-- created) and restored by the rollback.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/verify/0011_verify.sql
--
-- Prints PASS 1 … PASS 10; the first broken rule stops with "FAIL n: …".

begin;

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres — the same path as the Supabase dashboard)
-- ---------------------------------------------------------------------------

update public.profiles set role = 'member' where role = 'owner';

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00110000-0000-4000-8000-0000000000a0', 'verify-0011-owner@example.invalid',   now(), '{"display_name": "Owner"}'),
  ('00110000-0000-4000-8000-0000000000a1', 'verify-0011-member@example.invalid',  now(), '{"display_name": "Member"}'),
  ('00110000-0000-4000-8000-0000000000a2', 'verify-0011-leaver@example.invalid',  now(), '{"display_name": "Leaver"}'),
  ('00110000-0000-4000-8000-0000000000a3', 'verify-0011-pending@example.invalid', now(), '{"display_name": "Pending"}'),
  ('00110000-0000-4000-8000-0000000000a4', 'verify-0011-later@example.invalid',   now(), '{"display_name": "Later"}');

update public.profiles set role = 'owner', status = 'approved', approved_at = now()
  where id = '00110000-0000-4000-8000-0000000000a0';
update public.profiles set status = 'approved', approved_at = now()
  where id in ('00110000-0000-4000-8000-0000000000a1', '00110000-0000-4000-8000-0000000000a2');

-- The leaver created a client and is the recorded recipient of a review notice.
insert into public.clients (id, owner_id, name, slug, instagram_username) values
  ('00110000-0000-4000-8000-0000000000c1', '00110000-0000-4000-8000-0000000000a2', 'Verify 0011 Client', 'verify-0011', 'verify_0011');
insert into public.notifications (id, recipient_id, client_id, type, title, message, audience) values
  ('00110000-0000-4000-8000-0000000000e1', '00110000-0000-4000-8000-0000000000a2',
   '00110000-0000-4000-8000-0000000000c1', 'review_approved', 'Approved', 'Verify 0011 review notice', 'team');

-- 1. Sign-up notices resolve themselves once the account isn't pending —
--    whatever changed it (here: a direct update, like the Table Editor).
do $$
begin
  if exists (select 1 from public.notifications where type = 'member_signup'
             and subject_user_id in ('00110000-0000-4000-8000-0000000000a0',
                                     '00110000-0000-4000-8000-0000000000a1',
                                     '00110000-0000-4000-8000-0000000000a2')) then
    raise exception 'FAIL 1: approving/appointing in the dashboard left the "waiting for approval" notice';
  end if;
  if (select count(*) from public.notifications where type = 'member_signup'
      and subject_user_id in ('00110000-0000-4000-8000-0000000000a3', '00110000-0000-4000-8000-0000000000a4')) <> 2 then
    raise exception 'FAIL 1: notices of still-pending accounts must stay';
  end if;
  raise notice 'PASS 1: sign-up notices disappear when the account stops being pending (any path)';
end $$;

-- 2. 'suspended' is a valid status, but never for the owner.
do $$
begin
  begin
    update public.profiles set status = 'suspended' where id = '00110000-0000-4000-8000-0000000000a0';
    raise exception 'FAIL 2: the owner was suspended';
  exception when check_violation then null;
  end;
  raise notice 'PASS 2: the owner can''t be suspended';
end $$;

-- ---------------------------------------------------------------------------
-- As a MEMBER: no owner actions
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub": "00110000-0000-4000-8000-0000000000a1", "role": "authenticated"}', true);
set local role authenticated;

do $$
declare fn text;
begin
  foreach fn in array array['suspend_member', 'restore_member', 'remove_member'] loop
    begin
      execute format('select public.%I(%L)', fn, '00110000-0000-4000-8000-0000000000a2');
      raise exception 'FAIL 3: a member ran %', fn;
    exception when raise_exception then if sqlerrm <> 'not_owner' then raise; end if;
    end;
  end loop;
  begin
    update public.profiles set status = 'suspended' where id = '00110000-0000-4000-8000-0000000000a2';
    if (select status from public.profiles where id = '00110000-0000-4000-8000-0000000000a2') = 'suspended' then
      raise exception 'FAIL 3: a member suspended someone through the API';
    end if;
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS 3: members can''t suspend, restore or remove anyone';
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- As the OWNER
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub": "00110000-0000-4000-8000-0000000000a0", "role": "authenticated"}', true);
set local role authenticated;

-- 4. Never on the owner/caller; only on the right kind of account.
do $$
begin
  begin
    perform public.suspend_member('00110000-0000-4000-8000-0000000000a0');
    raise exception 'FAIL 4: the owner suspended themself';
  exception when raise_exception then if sqlerrm <> 'not_allowed' then raise; end if;
  end;
  begin
    perform public.remove_member('00110000-0000-4000-8000-0000000000a0');
    raise exception 'FAIL 4: the owner removed themself';
  exception when raise_exception then if sqlerrm <> 'not_allowed' then raise; end if;
  end;
  begin
    perform public.suspend_member('00110000-0000-4000-8000-0000000000a3'); -- pending
    raise exception 'FAIL 4: a pending account was suspended';
  exception when raise_exception then if sqlerrm <> 'not_found' then raise; end if;
  end;
  begin
    perform public.remove_member('00110000-0000-4000-8000-0000000000a3'); -- pending: use reject
    raise exception 'FAIL 4: a pending account was removed';
  exception when raise_exception then if sqlerrm <> 'not_found' then raise; end if;
  end;
  begin
    perform public.restore_member('00110000-0000-4000-8000-0000000000a1'); -- not suspended
    raise exception 'FAIL 4: restored an account that wasn''t suspended';
  exception when raise_exception then if sqlerrm <> 'not_found' then raise; end if;
  end;
  raise notice 'PASS 4: actions refuse the owner/caller and the wrong account states';
end $$;

-- 5. Suspend: the account is kept, sees nothing, creates nothing.
do $$
begin
  perform public.suspend_member('00110000-0000-4000-8000-0000000000a1');
  if (select status from public.profiles where id = '00110000-0000-4000-8000-0000000000a1') <> 'suspended' then
    raise exception 'FAIL 5: suspend_member didn''t suspend';
  end if;
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub": "00110000-0000-4000-8000-0000000000a1", "role": "authenticated"}', true);
set local role authenticated;
do $$
declare t text; n bigint;
begin
  foreach t in array array['clients', 'posts', 'post_media', 'highlights', 'comments', 'approvals',
                           'share_links', 'activity', 'notifications', 'notification_reads'] loop
    execute format('select count(*) from public.%I', t) into n;
    if n <> 0 then raise exception 'FAIL 5: suspended account can read % row(s) of %', n, t; end if;
  end loop;
  if (select count(*) from public.profiles) <> 1 then
    raise exception 'FAIL 5: suspended account can read other profiles';
  end if;
  begin
    insert into public.clients (owner_id, name, slug, instagram_username)
      values ('00110000-0000-4000-8000-0000000000a1', 'Sneaky', 'sneaky-0011', 'sneaky_0011');
    raise exception 'FAIL 5: suspended account created a client';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.restore_member('00110000-0000-4000-8000-0000000000a1');
    raise exception 'FAIL 5: a suspended account restored itself';
  exception when raise_exception then if sqlerrm <> 'not_owner' then raise; end if;
  end;
  raise notice 'PASS 5: a suspended account is kept but sees and creates nothing';
end $$;
reset role;

-- 6. Restore lets them back in.
select set_config('request.jwt.claims', '{"sub": "00110000-0000-4000-8000-0000000000a0", "role": "authenticated"}', true);
set local role authenticated;
do $$ begin perform public.restore_member('00110000-0000-4000-8000-0000000000a1'); end $$;
reset role;
select set_config('request.jwt.claims', '{"sub": "00110000-0000-4000-8000-0000000000a1", "role": "authenticated"}', true);
set local role authenticated;
do $$
begin
  if not exists (select 1 from public.clients where id = '00110000-0000-4000-8000-0000000000c1') then
    raise exception 'FAIL 6: a restored member still can''t see the team''s clients';
  end if;
  raise notice 'PASS 6: restore gives access back';
end $$;
reset role;

-- 7. Remove: account gone, their client moves to the owner, the team keeps
--    the review notice, and their Storage folder stays cleanable.
select set_config('request.jwt.claims', '{"sub": "00110000-0000-4000-8000-0000000000a0", "role": "authenticated"}', true);
set local role authenticated;
do $$ begin perform public.remove_member('00110000-0000-4000-8000-0000000000a2'); end $$;
reset role;
do $$
begin
  if exists (select 1 from auth.users where id = '00110000-0000-4000-8000-0000000000a2')
     or exists (select 1 from public.profiles where id = '00110000-0000-4000-8000-0000000000a2') then
    raise exception 'FAIL 7: the removed account still exists';
  end if;
  if (select owner_id from public.clients where id = '00110000-0000-4000-8000-0000000000c1')
     is distinct from '00110000-0000-4000-8000-0000000000a0' then
    raise exception 'FAIL 7: the removed member''s client was not moved to the owner';
  end if;
  if not exists (select 1 from public.notifications
                 where id = '00110000-0000-4000-8000-0000000000e1' and recipient_id is null) then
    raise exception 'FAIL 7: the team''s review notice was lost with the removed member';
  end if;
  if not public.is_team_folder('00110000-0000-4000-8000-0000000000a2') then
    raise exception 'FAIL 7: the removed member''s Storage folder can no longer be cleaned up';
  end if;
  raise notice 'PASS 7: remove deletes the account; clients move to the owner; notices and file cleanup kept';
end $$;

-- 8. Deleting the owner, or anyone while there is no owner, is refused.
do $$
begin
  begin
    delete from auth.users where id = '00110000-0000-4000-8000-0000000000a0';
    raise exception 'FAIL 8: the owner''s account was deleted';
  exception when raise_exception then
    if sqlerrm not like 'Refused: % is the workspace owner%' then raise; end if;
  end;
  update public.profiles set role = 'member' where id = '00110000-0000-4000-8000-0000000000a0';
  begin
    delete from auth.users where id = '00110000-0000-4000-8000-0000000000a1';
    raise exception 'FAIL 8: an account was deleted while there was no owner';
  exception when raise_exception then
    if sqlerrm not like 'Refused: there is no workspace owner%' then raise; end if;
  end;
  update public.profiles set role = 'owner' where id = '00110000-0000-4000-8000-0000000000a0';
  if not exists (select 1 from public.profiles where id = '00110000-0000-4000-8000-0000000000a1') then
    raise exception 'FAIL 8: a refused delete still removed the profile';
  end if;
  raise notice 'PASS 8: deleting the owner, or anyone without an owner, is refused';
end $$;

-- 9. Storage folders: team (approved, suspended, removed) yes; pending/unknown no.
update public.profiles set status = 'suspended' where id = '00110000-0000-4000-8000-0000000000a1';
select set_config('request.jwt.claims', '{"sub": "00110000-0000-4000-8000-0000000000a0", "role": "authenticated"}', true);
set local role authenticated;
do $$
declare folders text[];
begin
  folders := public.team_media_folders(array[
    '00110000-0000-4000-8000-0000000000a0',  -- owner
    '00110000-0000-4000-8000-0000000000a1',  -- suspended
    '00110000-0000-4000-8000-0000000000a2',  -- removed
    '00110000-0000-4000-8000-0000000000a3',  -- pending
    '00110000-0000-4000-8000-0000000000ff',  -- unknown
    'not-a-uuid'
  ]);
  if folders is distinct from array['00110000-0000-4000-8000-0000000000a0',
                                    '00110000-0000-4000-8000-0000000000a1',
                                    '00110000-0000-4000-8000-0000000000a2'] then
    raise exception 'FAIL 9: team_media_folders returned %', folders;
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub": "00110000-0000-4000-8000-0000000000a1", "role": "authenticated"}', true);
set local role authenticated;
do $$
begin
  if cardinality(public.team_media_folders(array['00110000-0000-4000-8000-0000000000a0'])) <> 0 then
    raise exception 'FAIL 9: a suspended account may clean up files';
  end if;
end $$;
reset role;
set local role anon;
do $$
declare fn text;
begin
  foreach fn in array array['suspend_member', 'restore_member', 'remove_member'] loop
    begin
      execute format('select public.%I(%L)', fn, '00110000-0000-4000-8000-0000000000a1');
      raise exception 'FAIL 9: anon ran %', fn;
    exception when insufficient_privilege then null;
    end;
  end loop;
  begin
    perform public.team_media_folders(array['x']);
    raise exception 'FAIL 9: anon ran team_media_folders';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS 9: file cleanup is limited to team folders; anon can''t run the new functions';
end $$;
reset role;
update public.profiles set status = 'approved' where id = '00110000-0000-4000-8000-0000000000a1';

-- 10. Read notifications older than 30 days are purged once every recipient
--     has read them; newer or partly-unread ones stay.
insert into public.notifications (id, client_id, type, title, message, audience, created_at) values
  ('00110000-0000-4000-8000-0000000000f1', '00110000-0000-4000-8000-0000000000c1', 'review_approved',
   'Old', 'Verify 0011 old notice', 'team', now() - interval '40 days'),
  ('00110000-0000-4000-8000-0000000000f2', '00110000-0000-4000-8000-0000000000c1', 'review_approved',
   'Recent', 'Verify 0011 recent notice', 'team', now() - interval '5 days');
-- Everyone except the fixture member has already read both.
insert into public.notification_reads (notification_id, user_id)
  select n.id, p.id
  from public.notifications n cross join public.profiles p
  where n.id in ('00110000-0000-4000-8000-0000000000f1', '00110000-0000-4000-8000-0000000000f2')
    and p.status = 'approved' and p.id <> '00110000-0000-4000-8000-0000000000a1';
do $$
begin
  if (select count(*) from public.notifications
      where id in ('00110000-0000-4000-8000-0000000000f1', '00110000-0000-4000-8000-0000000000f2')) <> 2 then
    raise exception 'FAIL 10: purged a notice someone hasn''t read yet';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub": "00110000-0000-4000-8000-0000000000a1", "role": "authenticated"}', true);
set local role authenticated;
do $$
begin
  perform public.mark_notifications_read(null);
  begin
    perform public.purge_read_notifications();
    raise exception 'FAIL 10: an API caller ran the purge directly';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$
begin
  if exists (select 1 from public.notifications where id = '00110000-0000-4000-8000-0000000000f1') then
    raise exception 'FAIL 10: a fully read notice older than 30 days was kept';
  end if;
  if not exists (select 1 from public.notifications where id = '00110000-0000-4000-8000-0000000000f2') then
    raise exception 'FAIL 10: a read notice younger than 30 days was purged';
  end if;
  raise notice 'PASS 10: fully read notices older than 30 days are purged; newer ones stay';
end $$;

select 'ALL 0011 CHECKS PASSED — rolling back, nothing was saved' as result;

rollback;
