-- Forces 0008 to fail: duplicate_client exists with a different return type.
create function public.duplicate_client(p_client_id uuid)
returns integer language sql as 'select 1';
