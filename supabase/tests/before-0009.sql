-- Data as the pre-0009 app stored it: content dropped on 1 Aug 2026 was saved
-- as LOCAL MIDNIGHT in the owner's time zone (posts.scheduled_at).
-- after-0009.sql checks the backfill turned every one into 2026-08-01.

insert into auth.users (id, email) values
  ('0000000a-0000-4000-8000-0000000000f9', 'backfill-owner@example.invalid');
insert into public.clients (id, owner_id, name, slug, instagram_username) values
  ('0000000c-0000-4000-8000-0000000000f9', '0000000a-0000-4000-8000-0000000000f9',
   'Backfill client', 'backfill', 'backfill');

insert into public.posts (client_id, name, stage, scheduled_at) values
  ('0000000c-0000-4000-8000-0000000000f9', 'backfill UTC-11', 'content', '2026-08-01 00:00-11'),
  ('0000000c-0000-4000-8000-0000000000f9', 'backfill UTC-7',  'content', '2026-08-01 00:00-07'),
  ('0000000c-0000-4000-8000-0000000000f9', 'backfill UTC+0',  'content', '2026-08-01 00:00+00'),
  ('0000000c-0000-4000-8000-0000000000f9', 'backfill UTC+2',  'content', '2026-08-01 00:00+02'),
  ('0000000c-0000-4000-8000-0000000000f9', 'backfill UTC+12', 'content', '2026-08-01 00:00+12'),
  ('0000000c-0000-4000-8000-0000000000f9', 'backfill unplaced', 'content', null),
  ('0000000c-0000-4000-8000-0000000000f9', 'backfill real post', 'post', '2026-08-01 18:30+02');
