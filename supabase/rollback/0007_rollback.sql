-- Rollback for supabase/migrations/0007_atomic_writes_and_review_activity.sql
--
-- Restores the exact 0006 state: drops the atomic-write RPCs and puts back
-- the 0006 versions of the review triggers and submit_share_approval (copied
-- verbatim from 0006). Kept OUTSIDE supabase/migrations/. Redeploy the app
-- version that matches 0006 right after running it (the 0007 app calls these
-- RPCs). To go back further, run 0006_rollback.sql afterwards.

begin;

drop function if exists public.set_post_media(uuid, jsonb);
drop function if exists public.reorder_posts(uuid, uuid[]);
drop function if exists public.reorder_highlights(uuid, uuid[]);

-- 0006 version of submit_share_approval
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


-- 0006 versions of the review triggers
create or replace function public.handle_review_approval()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(current_setting('gridline.review_client', true), '') <> new.client_id::text then
    return new;
  end if;

  update public.posts
    set approval_status = new.status::text::public.approval_status
    where id = new.post_id and client_id = new.client_id;

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
    -- Companion of a change-request approval, which already notified the
    -- owner — only mirror the status here.
    update public.posts set approval_status = 'changes_requested' where id = new.post_id;
  else
    perform public.notify_review_event(
      public.client_owner(cid),
      cid,
      new.post_id,
      'review_feedback_received',
      new.author_name || ' left feedback',
      new.body
    );
  end if;
  return new;
end;
$$;


commit;
