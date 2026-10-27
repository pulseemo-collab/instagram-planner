-- Forces 0007 to fail after set_post_media / reorder_posts were created:
-- reorder_highlights exists with a different return type.
create function public.reorder_highlights(p_client_id uuid, p_ordered_ids uuid[])
returns integer language sql as 'select 1';
