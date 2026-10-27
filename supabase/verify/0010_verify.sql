-- Verification for migration 0010 (team workspace + owner approval).
--
-- SAFE TO RUN ON A REAL DATABASE: one transaction, ROLLED BACK at the end,
-- with its own throwaway fixtures. If your project already has an owner,
-- it is demoted INSIDE this transaction only (so a fixture owner can be
-- created) and restored by the rollback.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/verify/0010_verify.sql
--
-- Prints PASS 1 … PASS 11; the first broken rule stops with "FAIL n: …".

begin;

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres — the same path as the Supabase dashboard)
-- ---------------------------------------------------------------------------

update public.profiles set role = 'member' where role = 'owner';

-- Signing up creates the profile (pending) via the auth.users trigger.
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00100000-0000-4000-8000-0000000000a0', 'verify-0010-owner@example.invalid',   now(), '{"display_name": "Owner"}'),
  ('00100000-0000-4000-8000-0000000000a1', 'verify-0010-member@example.invalid',  now(), '{"display_name": "Member"}'),
  ('00100000-0000-4000-8000-0000000000a2', 'verify-0010-pending@example.invalid', now(), '{"display_name": "Pending"}'),
  ('00100000-0000-4000-8000-0000000000a3', 'verify-0010-reject@example.invalid',  now(), '{"display_name": "Reject Me"}'),
  ('00100000-0000-4000-8000-0000000000a4', 'verify-0010-other@example.invalid',   now(), '{"display_name": "Other"}');

-- 1. New accounts start as pending members, and the owner is told about them.
do $$
begin
  if exists (select 1 from public.profiles
             where id::text like '00100000-%' and (status <> 'pending' or role <> 'member' or approved_at is not null)) then
    raise exception 'FAIL 1: new accounts must start as pending members';
  end if;
  if (select count(*) from public.notifications
      where type = 'member_signup' and audience = 'owner'
        and subject_user_id::text like '00100000-%') <> 5 then
    raise exception 'FAIL 1: expected one owner-only sign-up notification per new account';
  end if;
  raise notice 'PASS 1: new accounts start pending; one owner-only sign-up notification each';
end $$;

-- The dashboard path: appoint the owner and approve one member.
update public.profiles set role = 'owner', status = 'approved', approved_at = now()
  where id = '00100000-0000-4000-8000-0000000000a0';
update public.profiles set status = 'approved', approved_at = now()
  where id = '00100000-0000-4000-8000-0000000000a1';

insert into public.clients (id, owner_id, name, slug, instagram_username) values
  ('00100000-0000-4000-8000-0000000000c1', '00100000-0000-4000-8000-0000000000a0', 'Verify 0010 Client', 'verify-0010', 'verify_0010');
insert into public.posts (id, client_id, name, stage) values
  ('00100000-0000-4000-8000-0000000000b1', '00100000-0000-4000-8000-0000000000c1', 'Team post', 'post');
insert into public.share_links (client_id, token) values
  ('00100000-0000-4000-8000-0000000000c1', 'verify0010-share-link');

-- 2. Exactly one owner, and an owner must be approved.
do $$
begin
  begin
    update public.profiles set role = 'owner' where id = '00100000-0000-4000-8000-0000000000a1';
    raise exception 'FAIL 2: a second owner was accepted';
  exception when unique_violation then null;
  end;
  begin
    update public.profiles set role = 'owner', status = 'pending' where id = '00100000-0000-4000-8000-0000000000a0';
    raise exception 'FAIL 2: a pending owner was accepted';
  exception when check_violation then null;
  end;
  raise notice 'PASS 2: at most one owner, always approved';
end $$;

-- ---------------------------------------------------------------------------
-- As the PENDING account
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub": "00100000-0000-4000-8000-0000000000a2", "role": "authenticated"}', true);
set local role authenticated;

-- 3. A pending account can read nothing but its own profile, and create nothing.
do $$
declare t text; n bigint;
begin
  foreach t in array array['clients', 'posts', 'post_media', 'highlights', 'comments', 'approvals',
                           'share_links', 'activity', 'notifications', 'notification_reads'] loop
    execute format('select count(*) from public.%I', t) into n;
    if n <> 0 then raise exception 'FAIL 3: pending account can read % row(s) of %', n, t; end if;
  end loop;
  if (select count(*) from public.profiles) <> 1
     or (select id from public.profiles) <> '00100000-0000-4000-8000-0000000000a2' then
    raise exception 'FAIL 3: pending account can read other profiles';
  end if;
  begin
    insert into public.clients (owner_id, name, slug, instagram_username)
      values ('00100000-0000-4000-8000-0000000000a2', 'Sneaky', 'sneaky', 'sneaky');
    raise exception 'FAIL 3: pending account created a client';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS 3: pending accounts see only their own profile and can create nothing';
end $$;

-- 4. Nobody can change their own role or status through the API — not even
--    with spoofed JWT claims or headers (current_user stays 'authenticated').
do $$
begin
  perform set_config('request.jwt.claims',
    '{"sub": "00100000-0000-4000-8000-0000000000a2", "role": "service_role"}', true);
  perform set_config('request.headers', '{"x-role": "postgres", "authorization": "Bearer service_role"}', true);
  begin
    update public.profiles set status = 'approved' where id = '00100000-0000-4000-8000-0000000000a2';
    raise exception 'FAIL 4: a pending user approved themselves';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set role = 'owner' where id = '00100000-0000-4000-8000-0000000000a2';
    raise exception 'FAIL 4: a user made themselves owner';
  exception when insufficient_privilege then null;
  end;
  -- Spoofed claims/headers don't change the database role. (A client can't
  -- run SET ROLE either: PostgREST never executes client-supplied SQL; the
  -- role comes only from the JWT's signed "role" claim.)
  if current_user <> 'authenticated' then raise exception 'FAIL 4: current_user changed to %', current_user; end if;
  -- Editing your own name is still allowed.
  update public.profiles set display_name = 'Renamed' where id = '00100000-0000-4000-8000-0000000000a2';
  perform set_config('request.jwt.claims',
    '{"sub": "00100000-0000-4000-8000-0000000000a2", "role": "authenticated"}', true);
  perform set_config('request.headers', '', true);
  raise notice 'PASS 4: role/status changes refused for API callers, even with spoofed claims/headers';
end $$;

reset role;

-- 4b. Second layer: even if UPDATE on those columns were granted by mistake,
--     the guard trigger refuses (it checks current_user, which a client can't set).
grant update (role, status, approved_at) on public.profiles to authenticated;
set local role authenticated;
do $$
begin
  begin
    update public.profiles set status = 'approved' where id = '00100000-0000-4000-8000-0000000000a2';
    raise exception 'FAIL 4b: the guard trigger let an API caller approve themselves';
  exception when raise_exception then
    if sqlerrm <> 'role_change_not_allowed' then raise; end if;
  end;
  raise notice 'PASS 4b: the guard trigger blocks role/status changes from API roles on its own';
end $$;
reset role;
revoke update (role, status, approved_at) on public.profiles from authenticated;

-- ---------------------------------------------------------------------------
-- As an approved MEMBER
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub": "00100000-0000-4000-8000-0000000000a1", "role": "authenticated"}', true);
set local role authenticated;

-- 5. Members share the owner's workspace, but can't delete clients.
do $$
declare n int;
begin
  if not exists (select 1 from public.clients where id = '00100000-0000-4000-8000-0000000000c1')
     or not exists (select 1 from public.posts where id = '00100000-0000-4000-8000-0000000000b1') then
    raise exception 'FAIL 5: member can''t see the owner''s client';
  end if;
  update public.clients set bio = 'edited by member' where id = '00100000-0000-4000-8000-0000000000c1';
  delete from public.clients where id = '00100000-0000-4000-8000-0000000000c1';
  get diagnostics n = row_count;
  if n <> 0 or not exists (select 1 from public.clients where id = '00100000-0000-4000-8000-0000000000c1') then
    raise exception 'FAIL 5: a member deleted a client';
  end if;
  insert into public.clients (owner_id, name, slug, instagram_username)
    values ('00100000-0000-4000-8000-0000000000a1', 'Member client', 'member-client', 'member_client');
  begin
    insert into public.clients (owner_id, name, slug, instagram_username)
      values ('00100000-0000-4000-8000-0000000000a0', 'Spoofed creator', 'spoofed', 'spoofed');
    raise exception 'FAIL 5: a member created a client in someone else''s name';
  exception when insufficient_privilege then null;
  end;
  if (public.duplicate_client('00100000-0000-4000-8000-0000000000c1')).owner_id <> '00100000-0000-4000-8000-0000000000a1' then
    raise exception 'FAIL 5: duplicate_client should record the duplicating member';
  end if;
  raise notice 'PASS 5: members see/edit/duplicate team clients; deleting a client is refused';
end $$;

-- 6. Members can't approve or reject, and don't see sign-up notifications.
do $$
begin
  begin
    perform public.approve_member('00100000-0000-4000-8000-0000000000a2');
    raise exception 'FAIL 6: a member approved an account';
  exception when raise_exception then if sqlerrm <> 'not_owner' then raise; end if;
  end;
  begin
    perform public.reject_member('00100000-0000-4000-8000-0000000000a3');
    raise exception 'FAIL 6: a member rejected an account';
  exception when raise_exception then if sqlerrm <> 'not_owner' then raise; end if;
  end;
  if exists (select 1 from public.notifications where type = 'member_signup') then
    raise exception 'FAIL 6: a member can see sign-up notifications';
  end if;
  if exists (select 1 from public.profiles where status = 'pending') then
    raise exception 'FAIL 6: a member can see pending accounts';
  end if;
  raise notice 'PASS 6: approving/rejecting and sign-up details are owner-only';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- A reviewer event (anonymous share link) → team notification
-- ---------------------------------------------------------------------------
set local role anon;
do $$
begin
  perform public.submit_share_comment('verify0010-share-link', '00100000-0000-4000-8000-0000000000b1',
                                      'Rita', null, 'Verify 0010 team notice');
  if (public.resolve_share('verify0010-share-link')) -> 'client' ->> 'name' <> 'Verify 0010 Client' then
    raise exception 'FAIL 7: share link no longer resolves';
  end if;
end $$;
reset role;

-- 7. Team notifications reach every member; read state is per person.
select set_config('request.jwt.claims', '{"sub": "00100000-0000-4000-8000-0000000000a1", "role": "authenticated"}', true);
set local role authenticated;
do $$
begin
  if not exists (select 1 from public.notifications where message = 'Verify 0010 team notice' and audience = 'team') then
    raise exception 'FAIL 7: member doesn''t see the team notification';
  end if;
  perform public.mark_notifications_read(
    array(select id from public.notifications where message = 'Verify 0010 team notice'));
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub": "00100000-0000-4000-8000-0000000000a0", "role": "authenticated"}', true);
set local role authenticated;
do $$
begin
  if not exists (select 1 from public.notifications where message = 'Verify 0010 team notice') then
    raise exception 'FAIL 7: owner doesn''t see the team notification';
  end if;
  if exists (select 1 from public.notification_reads) and exists (
       select 1 from public.notification_reads where user_id <> '00100000-0000-4000-8000-0000000000a0') then
    raise exception 'FAIL 7: the owner can see someone else''s read state';
  end if;
end $$;
reset role;

-- Checked with full visibility: the member's read exists, the owner's doesn't.
do $$
declare notice_id uuid := (select id from public.notifications where message = 'Verify 0010 team notice');
begin
  if not exists (select 1 from public.notification_reads
                 where notification_id = notice_id and user_id = '00100000-0000-4000-8000-0000000000a1')
     or exists (select 1 from public.notification_reads
                where notification_id = notice_id and user_id = '00100000-0000-4000-8000-0000000000a0') then
    raise exception 'FAIL 7: read state is not per person';
  end if;
  raise notice 'PASS 7: share links still work; team notifications reach everyone; read state is per person';
end $$;

select set_config('request.jwt.claims', '{"sub": "00100000-0000-4000-8000-0000000000a0", "role": "authenticated"}', true);
set local role authenticated;

-- ---------------------------------------------------------------------------
-- As the OWNER
-- ---------------------------------------------------------------------------

-- 8. The owner sees pending sign-ups and approves them.
do $$
begin
  if (select count(*) from public.profiles where status = 'pending' and id::text like '00100000-%') <> 3 then
    raise exception 'FAIL 8: owner should see the 3 pending fixture accounts';
  end if;
  if (select count(*) from public.notifications where type = 'member_signup' and subject_user_id::text like '00100000-%') <> 5 then
    raise exception 'FAIL 8: owner should see the sign-up notifications';
  end if;
  perform public.approve_member('00100000-0000-4000-8000-0000000000a2');
  if (select status from public.profiles where id = '00100000-0000-4000-8000-0000000000a2') <> 'approved' then
    raise exception 'FAIL 8: approve_member didn''t approve';
  end if;
  begin
    perform public.approve_member('00100000-0000-4000-8000-0000000000a2'); -- already approved
    raise exception 'FAIL 8: approving twice succeeded';
  exception when raise_exception then if sqlerrm <> 'not_found' then raise; end if;
  end;
  raise notice 'PASS 8: the owner sees pending accounts and approves them';
end $$;

-- 9. Reject deletes a pending account completely; approved accounts can't be rejected.
do $$
begin
  perform public.reject_member('00100000-0000-4000-8000-0000000000a3');
  begin
    perform public.reject_member('00100000-0000-4000-8000-0000000000a1'); -- approved member
    raise exception 'FAIL 9: an approved member was rejected';
  exception when raise_exception then if sqlerrm <> 'not_found' then raise; end if;
  end;
  begin
    perform public.reject_member('00100000-0000-4000-8000-0000000000a0'); -- the owner
    raise exception 'FAIL 9: the owner was rejected';
  exception when raise_exception then if sqlerrm <> 'not_found' then raise; end if;
  end;
  raise notice 'PASS 9a: only pending accounts can be rejected';
end $$;
reset role;

do $$
begin
  if exists (select 1 from auth.users where id = '00100000-0000-4000-8000-0000000000a3')
     or exists (select 1 from public.profiles where id = '00100000-0000-4000-8000-0000000000a3')
     or exists (select 1 from public.notifications where subject_user_id = '00100000-0000-4000-8000-0000000000a3') then
    raise exception 'FAIL 9: the rejected account (auth user, profile or sign-up notice) still exists';
  end if;
  raise notice 'PASS 9: reject removes the auth user, the profile and its sign-up notification';
end $$;

-- 10. Storage: deletes allowed only in approved members' folders.
do $$
begin
  if not public.is_team_folder('00100000-0000-4000-8000-0000000000a1')
     or public.is_team_folder('00100000-0000-4000-8000-0000000000a4')   -- still pending
     or public.is_team_folder('not-a-uuid')
     or public.is_team_folder(null) then
    raise exception 'FAIL 10: is_team_folder misclassifies a folder';
  end if;
  if not exists (select 1 from pg_policies
                 where schemaname = 'storage' and tablename = 'objects' and policyname = 'media team delete'
                   and qual like '%is_team_folder%' and qual like '%is_active_member%') then
    raise exception 'FAIL 10: storage delete policy missing or not scoped to team folders';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'storage' and policyname like 'media owner %') then
    raise exception 'FAIL 10: old per-owner storage policies still present';
  end if;
  raise notice 'PASS 10: storage deletes are limited to approved members'' folders';
end $$;

-- 11. Anonymous callers can't use the owner actions; functions stay hardened.
set local role anon;
do $$
begin
  begin
    perform public.approve_member('00100000-0000-4000-8000-0000000000a4');
    raise exception 'FAIL 11: anon executed approve_member';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.reject_member('00100000-0000-4000-8000-0000000000a4');
    raise exception 'FAIL 11: anon executed reject_member';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$
declare offenders text;
begin
  select string_agg(p.proname, ', ') into offenders
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and not coalesce(p.proconfig @> array['search_path=""'], false);
  if offenders is not null then raise exception 'FAIL 11: definer functions without empty search_path: %', offenders; end if;
  if (select prosecdef from pg_proc where proname = 'guard_profile_privileges') then
    raise exception 'FAIL 11: the guard must be SECURITY INVOKER (current_user is the caller''s role)';
  end if;
  raise notice 'PASS 11: anon can''t approve/reject; definer functions hardened; guard is invoker';
end $$;

select 'ALL 0010 CHECKS PASSED — rolling back, nothing was saved' as result;

rollback;
