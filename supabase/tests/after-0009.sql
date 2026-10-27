-- Checks the 0009 backfill of the rows inserted by before-0009.sql. Also run
-- after every rollback + re-apply cycle: the day must never drift.

do $$
declare
  wrong text;
begin
  select string_agg(name || '=' || coalesce(scheduled_day::text, 'null'), ', ') into wrong
  from public.posts
  where client_id = '0000000c-0000-4000-8000-0000000000f9'
    and name like 'backfill UTC%'
    and (scheduled_day is distinct from '2026-08-01' or scheduled_at is not null);
  if wrong is not null then
    raise exception 'FAIL backfill: content not on 2026-08-01: %', wrong;
  end if;

  if (select scheduled_day from public.posts
      where client_id = '0000000c-0000-4000-8000-0000000000f9' and name = 'backfill unplaced') is not null then
    raise exception 'FAIL backfill: unplaced content got a day';
  end if;

  if (select scheduled_at from public.posts
      where client_id = '0000000c-0000-4000-8000-0000000000f9' and name = 'backfill real post')
     is distinct from '2026-08-01 18:30+02'::timestamptz then
    raise exception 'FAIL backfill: a completed post''s publishing time changed';
  end if;

  raise notice 'PASS backfill: every old content day became 2026-08-01; posts untouched';
end $$;
