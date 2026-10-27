-- Forces 0009 to fail after it added the column and backfilled content:
-- one of its constraint names is already taken.
alter table public.posts add constraint posts_scheduled_day_content_only check (true);
