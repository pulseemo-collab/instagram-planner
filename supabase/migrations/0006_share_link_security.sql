-- Share-link security for public reviewers (audit issues #2, #3, #5, #7, #8).
--
-- Reviewers no longer touch tables directly. The `x-share-token` header and
-- the "shared read/insert" policies are replaced by three SECURITY DEFINER
-- RPCs that take the token as an argument and enforce everything server-side:
--
--   resolve_share(share_token)          reviewer bundle: real link flags,
--                                       client looked up BY TOKEN, completed
--                                       posts only, no reviewer emails
--   submit_share_comment(...)           requires allow_comments
--   submit_share_approval(...)          requires allow_approval; also stores
--                                       the message as a companion comment
--                                       (when comments are allowed) as part of
--                                       the SAME submission
--
-- Both submit RPCs are rate limited per share link (60 per rolling 10 minutes,
-- 300 per 24 hours) and always insert comments with resolved = false.
--
-- Every SECURITY DEFINER function uses `set search_path = ''` with
-- schema-qualified names, including the pre-existing ones re-created below.
-- Storage buckets stay public but get server-side size and MIME limits.
--
-- The whole migration runs in one transaction: a failure applies nothing.
-- Deploy the matching app version immediately after applying (see
-- docs/DEPLOY_GUIDE.md). Rollback: supabase/rollback/0006_rollback.sql.

begin;

-- ---------------------------------------------------------------------------
-- 1. Remove direct anonymous table access
-- ---------------------------------------------------------------------------

drop policy if exists "clients shared read" on public.clients;
drop policy if exists "highlights shared read" on public.highlights;
drop policy if exists "posts shared read" on public.posts;
drop policy if exists "post_media shared read" on public.post_media;
drop policy if exists "comments shared read" on public.comments;
drop policy if exists "comments shared insert" on public.comments;
drop policy if exists "approvals shared read" on public.approvals;
drop policy if exists "approvals shared insert" on public.approvals;

-- ---------------------------------------------------------------------------
-- 2. Harden pre-existing SECURITY DEFINER helpers (same behavior, empty
--    search_path, schema-qualified). `create or replace` keeps their grants,
--    which the owner RLS policies rely on.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create or replace function public.owns_client(cid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.clients where id = cid and owner_id = auth.uid());
$$;

create or replace function public.post_client(pid uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select client_id from public.posts where id = pid;
$$;

create or replace function public.share_token_client(share_token text)
returns uuid language sql security definer stable set search_path = '' as $$
  select client_id from public.share_links
  where token = share_token
    and is_active
    and (expires_at is null or expires_at > now());
$$;

create or replace function public.client_owner(cid uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select owner_id from public.clients where id = cid;
$$;

create or replace function public.notify_review_event(
  recipient uuid, cid uuid, pid uuid, ntype text, ntitle text, nmessage text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if recipient is null then return; end if;
  if exists (
    select 1 from public.notifications
    where recipient_id = recipient
      and post_id is not distinct from pid
      and message = nmessage
      and created_at > now() - interval '30 seconds'
  ) then return; end if;
  insert into public.notifications (recipient_id, client_id, post_id, type, title, message)
  values (recipient, cid, pid, ntype, ntitle, nmessage);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Rate-limit log (only reachable through the definer functions below)
-- ---------------------------------------------------------------------------

create table public.share_submissions (
  id uuid primary key default gen_random_uuid(),
  share_link_id uuid not null references public.share_links (id) on delete cascade,
  kind text not null check (kind in ('comment', 'approval')),
  created_at timestamptz not null default now()
);

create index share_submissions_link_idx on public.share_submissions (share_link_id, created_at desc);

alter table public.share_submissions enable row level security;
-- No policies: anon/authenticated can never read or write it directly.
revoke all on public.share_submissions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Internal helpers (not callable by clients)
-- ---------------------------------------------------------------------------

-- Valid link for a token, or an exception whose message is the error code
-- the app maps to a ShareError: not_found | inactive | expired.
create or replace function public.share_link_check(share_token text)
returns public.share_links language plpgsql stable security definer set search_path = '' as $$
declare
  link public.share_links;
begin
  select * into link from public.share_links where token = share_token;
  if not found then raise exception 'not_found'; end if;
  if not link.is_active then raise exception 'inactive'; end if;
  if link.expires_at is not null and link.expires_at <= now() then raise exception 'expired'; end if;
  return link;
end;
$$;

-- A token only grants access to completed posts of its own client.
create or replace function public.share_assert_post(p_client_id uuid, p_post_id uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.posts
    where id = p_post_id and client_id = p_client_id and stage = 'post'
  ) then
    raise exception 'not_found';
  end if;
end;
$$;

-- Records one reviewer submission, or raises 'rate_limited' when the link has
-- reached 60 submissions in the last 10 minutes or 300 in the last 24 hours.
create or replace function public.share_rate_limit(p_link_id uuid, p_kind text)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  recent integer;
  daily integer;
begin
  -- Serialize submissions per link so concurrent requests can't overshoot.
  perform 1 from public.share_links where id = p_link_id for update;

  delete from public.share_submissions
  where share_link_id = p_link_id and created_at < now() - interval '24 hours';

  select count(*) filter (where created_at > now() - interval '10 minutes'), count(*)
    into recent, daily
  from public.share_submissions
  where share_link_id = p_link_id;

  if recent >= 60 or daily >= 300 then raise exception 'rate_limited'; end if;

  insert into public.share_submissions (share_link_id, kind) values (p_link_id, p_kind);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Public RPCs
-- ---------------------------------------------------------------------------

create or replace function public.resolve_share(share_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  link public.share_links;
begin
  link := public.share_link_check(share_token);
  return jsonb_build_object(
    'link', jsonb_build_object(
      'id', link.id,
      'client_id', link.client_id,
      'is_active', link.is_active,
      'expires_at', link.expires_at,
      'allow_comments', link.allow_comments,
      'allow_approval', link.allow_approval,
      'created_at', link.created_at
    ),
    'client', (
      select to_jsonb(c) - 'owner_id' from public.clients c where c.id = link.client_id
    ),
    'highlights', coalesce((
      select jsonb_agg(to_jsonb(h) order by h.position)
      from public.highlights h where h.client_id = link.client_id
    ), '[]'::jsonb),
    'posts', coalesce((
      select jsonb_agg(to_jsonb(p))
      from public.posts p where p.client_id = link.client_id and p.stage = 'post'
    ), '[]'::jsonb),
    'media', coalesce((
      select jsonb_agg(to_jsonb(m))
      from public.post_media m
      join public.posts p on p.id = m.post_id
      where p.client_id = link.client_id and p.stage = 'post'
    ), '[]'::jsonb),
    'comments', coalesce((
      select jsonb_agg(to_jsonb(cm) - 'author_email')
      from public.comments cm
      join public.posts p on p.id = cm.post_id
      where p.client_id = link.client_id and p.stage = 'post'
    ), '[]'::jsonb),
    'approvals', coalesce((
      select jsonb_agg(to_jsonb(a) - 'reviewer_email')
      from public.approvals a
      join public.posts p on p.id = a.post_id
      where a.client_id = link.client_id and p.stage = 'post'
    ), '[]'::jsonb)
  );
end;
$$;

-- Standalone reviewer feedback. Only 'general' comments: change requests
-- come with an approval decision (submit_share_approval), so a link with
-- approvals off can never change a post's approval status.
create or replace function public.submit_share_comment(
  share_token text,
  p_post_id uuid,
  p_author_name text,
  p_author_email text,
  p_body text
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  link public.share_links;
  inserted public.comments;
begin
  link := public.share_link_check(share_token);
  if not link.allow_comments then raise exception 'comments_disabled'; end if;
  perform public.share_assert_post(link.client_id, p_post_id);
  perform public.share_rate_limit(link.id, 'comment');

  -- Marks this transaction as a verified reviewer submission for the
  -- notification triggers (transaction-local; never set by owner writes).
  perform set_config('gridline.review_client', link.client_id::text, true);

  insert into public.comments (post_id, author_name, author_email, body, comment_type, resolved)
  values (
    p_post_id,
    btrim(p_author_name),
    nullif(btrim(p_author_email), ''),
    btrim(p_body),
    'general',
    false
  )
  returning * into inserted;

  return to_jsonb(inserted) - 'author_email';
end;
$$;

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

-- ---------------------------------------------------------------------------
-- 6. Review triggers: identify reviewer submissions by the transaction flag
--    set in the RPCs above (replaces the 0005 header check).
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- 7. Function privileges
-- ---------------------------------------------------------------------------

revoke execute on function public.share_link_check(text) from public, anon, authenticated;
revoke execute on function public.share_assert_post(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.share_rate_limit(uuid, text) from public, anon, authenticated;

revoke execute on function public.resolve_share(text) from public;
revoke execute on function public.submit_share_comment(text, uuid, text, text, text) from public;
revoke execute on function public.submit_share_approval(text, uuid, text, text, text, text) from public;
grant execute on function public.resolve_share(text) to anon, authenticated;
grant execute on function public.submit_share_comment(text, uuid, text, text, text) to anon, authenticated;
grant execute on function public.submit_share_approval(text, uuid, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Storage limits (buckets stay public for now)
--    Mirrors src/lib/uploads.ts: images 12 MB, videos 25 MB.
-- ---------------------------------------------------------------------------

update storage.buckets
  set file_size_limit = 12582912,  -- 12 MB
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
  where id in ('avatars', 'highlights');

update storage.buckets
  set file_size_limit = 26214400,  -- 25 MB
      allowed_mime_types = array[
        'image/jpeg', 'image/png', 'image/webp',
        'video/mp4', 'video/webm', 'video/quicktime'
      ]
  where id = 'post-media';

commit;
