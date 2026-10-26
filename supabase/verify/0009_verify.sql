-- Verification for migration 0009 (timezone-free content days).
--
-- SAFE TO RUN ON A REAL DATABASE: one transaction, ROLLED BACK at the end,
-- with its own throwaway fixtures. Requires 0006–0009. Checks 1 and 7 also
-- inspect your real data (read-only).
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/verify/0009_verify.sql
--
-- Prints PASS 1 … PASS 7; the first broken rule stops with "FAIL n: …".

begin;

-- 1. The column exists as a plain date.
do $$
begin
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'posts' and column_name = 'scheduled_day')
     is distinct from 'date' then
    raise exception 'FAIL 1: posts.scheduled_day missing or not a date';
  end if;
  raise notice 'PASS 1: posts.scheduled_day is a timezone-free date column';
end $$;

insert into auth.users (id, email) values
  ('00090000-0000-4000-8000-00000000000a', 'verify-0009-owner@example.invalid');
insert into public.clients (id, owner_id, name, slug, instagram_username) values
  ('00090000-0000-4000-8000-0000000000c1', '00090000-0000-4000-8000-00000000000a', 'Verify 0009', 'verify-0009', 'verify_0009');

select set_config('request.jwt.claims', '{"sub": "00090000-0000-4000-8000-00000000000a", "role": "authenticated"}', true);
set local role authenticated;

-- 2. A content package stores a day; that day reads back unchanged in any session time zone.
do $$
declare d date;
begin
  insert into public.posts (id, client_id, name, stage, scheduled_day) values
    ('00090000-0000-4000-8000-0000000000a1', '00090000-0000-4000-8000-0000000000c1', 'Content', 'content', '2026-08-01');
  perform set_config('timezone', 'Pacific/Auckland', true);
  select scheduled_day into d from public.posts where id = '00090000-0000-4000-8000-0000000000a1';
  if d <> '2026-08-01' then raise exception 'FAIL 2: day changed in Pacific/Auckland: %', d; end if;
  perform set_config('timezone', 'America/Los_Angeles', true);
  select scheduled_day into d from public.posts where id = '00090000-0000-4000-8000-0000000000a1';
  if d <> '2026-08-01' then raise exception 'FAIL 2: day changed in America/Los_Angeles: %', d; end if;
  raise notice 'PASS 2: a content day is the same date in every time zone';
end $$;

-- 3. Only content packages may have a day.
do $$
begin
  begin
    insert into public.posts (client_id, name, stage, scheduled_day) values
      ('00090000-0000-4000-8000-0000000000c1', 'Post with a day', 'post', '2026-08-01');
    raise exception 'FAIL 3: a completed post accepted scheduled_day';
  exception when check_violation then null;
  end;
  raise notice 'PASS 3: completed posts cannot have scheduled_day';
end $$;

-- 4. Content packages may not carry a publishing time.
do $$
begin
  begin
    insert into public.posts (client_id, name, stage, scheduled_at) values
      ('00090000-0000-4000-8000-0000000000c1', 'Content with a time', 'content', now());
    raise exception 'FAIL 4: a content package accepted scheduled_at';
  exception when check_violation then null;
  end;
  raise notice 'PASS 4: content packages cannot have scheduled_at';
end $$;

-- 5. Converting content into a post swaps the day for a time (as the app does);
--    keeping the day while becoming a post is refused.
do $$
begin
  begin
    update public.posts set stage = 'post', scheduled_at = '2026-08-01 18:00+02'
      where id = '00090000-0000-4000-8000-0000000000a1';
    raise exception 'FAIL 5: became a post while keeping scheduled_day';
  exception when check_violation then null;
  end;
  update public.posts
    set stage = 'post', scheduled_day = null, scheduled_at = '2026-08-01 18:00+02'
    where id = '00090000-0000-4000-8000-0000000000a1';
  raise notice 'PASS 5: content → post conversion swaps the day for a publishing time';
end $$;

-- 6. duplicate_client copies content days.
do $$
declare copy_id uuid;
begin
  insert into public.posts (client_id, name, stage, scheduled_day) values
    ('00090000-0000-4000-8000-0000000000c1', 'Content to copy', 'content', '2026-09-15');
  copy_id := (public.duplicate_client('00090000-0000-4000-8000-0000000000c1')).id;
  if (select scheduled_day from public.posts where client_id = copy_id and name = 'Content to copy')
     is distinct from '2026-09-15' then
    raise exception 'FAIL 6: duplicate_client did not copy scheduled_day';
  end if;
  raise notice 'PASS 6: duplicate_client copies content days';
end $$;

reset role;

-- 7. Your data satisfies the rule (read-only), and definer functions stay hardened.
do $$
declare offenders text;
begin
  if exists (select 1 from public.posts where stage = 'content' and scheduled_at is not null)
     or exists (select 1 from public.posts where stage = 'post' and scheduled_day is not null) then
    raise exception 'FAIL 7: existing rows break the content-day/post-time rule';
  end if;
  select string_agg(p.proname, ', ') into offenders
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and not coalesce(p.proconfig @> array['search_path=""'], false);
  if offenders is not null then raise exception 'FAIL 7: definer functions without empty search_path: %', offenders; end if;
  raise notice 'PASS 7: no row breaks the rule; definer functions keep search_path = ''''';
end $$;

select 'ALL 0009 CHECKS PASSED — rolling back, nothing was saved' as result;

rollback;
