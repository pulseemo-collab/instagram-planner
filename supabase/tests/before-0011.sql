-- State before 0011: a stale "waiting for approval" notice for an account
-- that is no longer pending (made owner/approved in the Table Editor while
-- the notice stayed open), plus a genuinely pending sign-up whose notice
-- must survive. after-0011.sql checks the migration cleaned up only the
-- stale one.

insert into auth.users (id, email, email_confirmed_at) values
  ('0000011a-0000-4000-8000-0000000000a1', 'still-pending@example.invalid', now());

-- Existing approved member from before-0010.sql, with a leftover notice.
insert into public.notifications (id, audience, type, title, message, subject_user_id) values
  ('0000011e-0000-4000-8000-0000000000e1', 'owner', 'member_signup',
   'existing-confirmed is waiting for approval', 'existing-confirmed@example.invalid',
   '0000010a-0000-4000-8000-0000000000a1');
