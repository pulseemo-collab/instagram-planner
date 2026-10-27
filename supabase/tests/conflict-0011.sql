-- Forces 0011 to fail after it changed the status constraint: the
-- former_members table already exists.
create table public.former_members (x int);
