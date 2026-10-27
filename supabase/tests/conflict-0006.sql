-- Forces 0006 to fail at step 3 (after it dropped policies and re-created
-- helpers): the share_submissions table already exists.
create table public.share_submissions (x int);
