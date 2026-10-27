-- Atomic writes + live-mode reviewer activity (audit #10, #11; builds on 0006).
--
--   set_post_media(post, media)        replace a post's media list in ONE
--                                      transaction (was delete-then-insert
--                                      from the browser: a failed insert left
--                                      the post with no media)
--   reorder_posts(client, ids)         grid / highlight order in one UPDATE
--   reorder_highlights(client, ids)    (was one request per row, unchecked)
--
-- These three are SECURITY INVOKER: they run as the signed-in owner, so the
-- existing owner RLS policies decide what they may touch.
--
-- Review triggers (replacing the 0006 versions):
--   * every approval row now moves the post's approval_status in the same
--     statement — owner-recorded ones too — so a status can never disagree
--     with the approval that set it;
--   * reviewer submissions (identified by the 0006 transaction flag) also
--     write an owner activity entry, matching demo mode's wording;
--   * the companion comment created with an approval message is flagged and
--     adds no second notification or activity entry.
--
-- One transaction; every SECURITY DEFINER function keeps search_path = ''.
-- Requires 0006. Rollback: supabase/rollback/0007_rollback.sql.

begin;

-- ---------------------------------------------------------------------------
-- 1. Atomic owner writes (SECURITY INVOKER — RLS applies)
-- ---------------------------------------------------------------------------

create or replace function public.set_post_media(p_post_id uuid, p_media jsonb)
returns setof public.post_media
language plpgsql volatile security invoker set search_path = '' as $$
begin
  -- Under RLS only the post's owner can see it.
  if not exists (select 1 from public.posts where id = p_post_id) then
    raise exception 'not_found';
  end if;

  delete from public.post_media where post_id = p_post_id;

  return query
  insert into public.post_media
    (post_id, media_type, url, thumbnail_url, cover_source, cover_timestamp, width, height, position)
  select
    p_post_id, m.media_type::public.media_type, m.url, m.thumbnail_url,
    m.cover_source, m.cover_timestamp, m.width, m.height, (m.ord - 1)::integer
  from rows from (
    jsonb_to_recordset(coalesce(p_media, '[]'::jsonb)) as (
      media_type text, url text, thumbnail_url text, cover_source text,
      cover_timestamp double precision, width integer, height integer
    )
  ) with ordinality as m(media_type, url, thumbnail_url, cover_source, cover_timestamp, width, height, ord)
  order by m.ord
  returning *;
end;
$$;

create or replace function public.reorder_posts(p_client_id uuid, p_ordered_ids uuid[])
returns void language sql volatile security invoker set search_path = '' as $$
  update public.posts p
    set grid_position = o.ord - 1
  from unnest(p_ordered_ids) with ordinality as o(id, ord)
  where p.id = o.id and p.client_id = p_client_id;
$$;

create or replace function public.reorder_highlights(p_client_id uuid, p_ordered_ids uuid[])
returns void language sql volatile security invoker set search_path = '' as $$
  update public.highlights h
    set position = o.ord - 1
  from unnest(p_ordered_ids) with ordinality as o(id, ord)
  where h.id = o.id and h.client_id = p_client_id;
$$;

revoke execute on function public.set_post_media(uuid, jsonb) from public, anon;
revoke execute on function public.reorder_posts(uuid, uuid[]) from public, anon;
revoke execute on function public.reorder_highlights(uuid, uuid[]) from public, anon;
grant execute on function public.set_post_media(uuid, jsonb) to authenticated;
grant execute on function public.reorder_posts(uuid, uuid[]) to authenticated;
grant execute on function public.reorder_highlights(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Review triggers
-- ---------------------------------------------------------------------------

create or replace function public.handle_review_approval()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Every approval moves the post's status in the same statement.
  update public.posts
    set approval_status = new.status::text::public.approval_status
    where id = new.post_id and client_id = new.client_id;

  -- Notification + activity only for verified reviewer submissions (0006 flag).
  if coalesce(current_setting('gridline.review_client', true), '') <> new.client_id::text then
    return new;
  end if;

  perform public.notify_review_event(
    public.client_owner(new.client_id),
    new.client_id,
    new.post_id,
    case when new.status = 'approved' then 'review_approved' else 'review_changes_requested' end,
    new.reviewer_name || case when new.status = 'approved'
      then ' approved the post' else ' requested changes' end,
    coalesce(new.message, case when new.status = 'approved'
      then 'The post is ready.' else 'Open the post to see the request.' end)
  );

  insert into public.activity (client_id, type, description)
  values (
    new.client_id,
    case when new.status = 'approved' then 'approval_received' else 'changes_requested' end,
    new.reviewer_name || case when new.status = 'approved'
      then ' approved a post' else ' requested changes on a post' end
  );
  return new;
end;
$$;

create or replace function public.handle_review_comment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare cid uuid;
begin
  cid := public.post_client(new.post_id);
  if cid is null or coalesce(current_setting('gridline.review_client', true), '') <> cid::text then
    return new;
  end if;

  if new.comment_type = 'change_request' then
    update public.posts set approval_status = 'changes_requested' where id = new.post_id;
  end if;

  -- The comment mirroring an approval message is covered by the approval's
  -- own notification and activity entry.
  if coalesce(current_setting('gridline.review_companion', true), '') = 'on' then
    return new;
  end if;

  if new.comment_type = 'general' then
    perform public.notify_review_event(
      public.client_owner(cid),
      cid,
      new.post_id,
      'review_feedback_received',
      new.author_name || ' left feedback',
      new.body
    );
    insert into public.activity (client_id, type, description)
    values (cid, 'comment_received', new.author_name || ' left a comment');
  end if;
  return new;
end;
$$;

-- Same as 0006, plus the companion flag set right before the mirrored comment.
create or replace function public.submit_share_approval(
  share_token text,
  p_post_id uuid,
  p_reviewer_name text,
  p_reviewer_email text,
  p_status text,
  p_message text default null
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  link public.share_links;
  inserted public.approvals;
begin
  link := public.share_link_check(share_token);
  if not link.allow_approval then raise exception 'approvals_disabled'; end if;
  perform public.share_assert_post(link.client_id, p_post_id);
  -- One submission covers the approval AND its companion comment.
  perform public.share_rate_limit(link.id, 'approval');

  perform set_config('gridline.review_client', link.client_id::text, true);

  insert into public.approvals (client_id, post_id, reviewer_name, reviewer_email, status, message)
  values (
    link.client_id,
    p_post_id,
    btrim(p_reviewer_name),
    nullif(btrim(p_reviewer_email), ''),
    p_status::public.reviewer_decision,
    nullif(btrim(p_message), '')
  )
  returning * into inserted;

  -- The message also appears in the post's comment thread, unless the link
  -- has comments switched off (it is still kept on the approval itself).
  if inserted.message is not null and link.allow_comments then
    perform set_config('gridline.review_companion', 'on', true);
    insert into public.comments (post_id, author_name, author_email, body, comment_type, resolved)
    values (
      p_post_id,
      inserted.reviewer_name,
      inserted.reviewer_email,
      inserted.message,
      (case when inserted.status = 'changes_requested' then 'change_request' else 'general' end)::public.comment_type,
      false
    );
  end if;

  return to_jsonb(inserted) - 'reviewer_email';
end;
$$;

commit;
