-- Forces 0010 to fail after it added the profile columns and policies:
-- the notification_reads table already exists.
create table public.notification_reads (x int);
