-- Accounts and data as they exist before 0010: two existing accounts (one
-- with a confirmed email), a client, and one read + one unread notification.
-- after-0010.sql checks the migration made them approved members and kept
-- the read state.

insert into auth.users (id, email, email_confirmed_at) values
  ('0000010a-0000-4000-8000-0000000000a1', 'existing-confirmed@example.invalid', now()),
  ('0000010a-0000-4000-8000-0000000000a2', 'existing-unconfirmed@example.invalid', null);

insert into public.clients (id, owner_id, name, slug, instagram_username) values
  ('0000010c-0000-4000-8000-0000000000c1', '0000010a-0000-4000-8000-0000000000a1',
   'Existing client', 'existing-client', 'existing_client');

insert into public.notifications (id, recipient_id, client_id, type, title, message, is_read) values
  ('0000010e-0000-4000-8000-0000000000e1', '0000010a-0000-4000-8000-0000000000a1',
   '0000010c-0000-4000-8000-0000000000c1', 'review_approved', 'Old read', 'read before 0010', true),
  ('0000010e-0000-4000-8000-0000000000e2', '0000010a-0000-4000-8000-0000000000a1',
   '0000010c-0000-4000-8000-0000000000c1', 'review_approved', 'Old unread', 'unread before 0010', false);
