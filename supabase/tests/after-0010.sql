-- Checks 0010 on the rows inserted by before-0010.sql. Also re-run after a
-- rollback + re-apply cycle.

do $$
begin
  if exists (
    select 1 from public.profiles
    where id in ('0000010a-0000-4000-8000-0000000000a1', '0000010a-0000-4000-8000-0000000000a2')
      and (status <> 'approved' or role <> 'member' or approved_at is null)
  ) then
    raise exception 'FAIL existing accounts: not approved members after 0010';
  end if;
  if (select email_confirmed from public.profiles where id = '0000010a-0000-4000-8000-0000000000a1') is not true
     or (select email_confirmed from public.profiles where id = '0000010a-0000-4000-8000-0000000000a2') is not false then
    raise exception 'FAIL existing accounts: email_confirmed not synced from auth.users';
  end if;
  if not exists (select 1 from public.notification_reads
                 where notification_id = '0000010e-0000-4000-8000-0000000000e1'
                   and user_id = '0000010a-0000-4000-8000-0000000000a1')
     or exists (select 1 from public.notification_reads
                where notification_id = '0000010e-0000-4000-8000-0000000000e2') then
    raise exception 'FAIL existing notifications: read state not carried over';
  end if;
  if (select audience from public.notifications where id = '0000010e-0000-4000-8000-0000000000e1') <> 'team' then
    raise exception 'FAIL existing notifications: not team-wide';
  end if;
  if exists (select 1 from public.profiles where role = 'owner'
             and id in ('0000010a-0000-4000-8000-0000000000a1', '0000010a-0000-4000-8000-0000000000a2')) then
    raise exception 'FAIL existing accounts: the migration must not pick an owner';
  end if;
  raise notice 'PASS existing accounts: approved members, emails synced, read state kept, no owner picked';
end $$;
