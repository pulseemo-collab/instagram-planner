-- Checks 0011 on the rows inserted by before-0011.sql. Also re-run after a
-- rollback + re-apply cycle (re-applying 0010 approves every existing
-- account, so the pending fixture may no longer be pending then).

do $$
begin
  if exists (
    select 1 from public.notifications n
    where n.type = 'member_signup'
      and not exists (select 1 from public.profiles p where p.id = n.subject_user_id and p.status = 'pending')
  ) then
    raise exception 'FAIL stale sign-up notice: still there for an account that is no longer pending';
  end if;
  if exists (select 1 from public.profiles
             where id = '0000011a-0000-4000-8000-0000000000a1' and status = 'pending')
     and not exists (select 1 from public.notifications
                     where type = 'member_signup' and subject_user_id = '0000011a-0000-4000-8000-0000000000a1') then
    raise exception 'FAIL pending sign-up notice: removed although the account is still pending';
  end if;
  raise notice 'PASS stale sign-up notices removed, pending ones kept';
end $$;
