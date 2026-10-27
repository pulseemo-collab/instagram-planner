-- Rollback for supabase/migrations/0006_share_link_security.sql
--
-- Restores the exact pre-0006 state (0001 + 0005 definitions). Kept OUTSIDE
-- supabase/migrations/ so `supabase db push` never runs it. After running it,
-- redeploy the pre-0006 app version — the 0006 app relies on the RPCs that
-- this script drops. See docs/DEPLOY_GUIDE.md §5.
--
-- NOTE: this re-opens the issues 0006 fixed (link flags not enforced,
-- reviewer emails and draft posts readable with a token, no rate limit).

begin;

-- Public RPCs and internal helpers
drop function if exists public.resolve_share(text);
drop function if exists public.submit_share_comment(text, uuid, text, text, text);
drop function if exists public.submit_share_approval(text, uuid, text, text, text, text);
drop function if exists public.share_rate_limit(uuid, text);
drop function if exists public.share_assert_post(uuid, uuid);
drop function if exists public.share_link_check(text);

-- Rate-limit log
drop table if exists public.share_submissions;

-- Original helper definitions (search_path = public)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create or replace function public.owns_client(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from clients where id = cid and owner_id = auth.uid());
$$;

create or replace function public.post_client(pid uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select client_id from posts where id = pid;
$$;

create or replace function public.share_token_client(share_token text)
returns uuid language sql security definer stable set search_path = public as $$
  select client_id from share_links
  where token = share_token
    and is_active
    and (expires_at is null or expires_at > now());
$$;

create or replace function public.client_owner(cid uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select owner_id from clients where id = cid;
$$;

create or replace function public.notify_review_event(
  recipient uuid, cid uuid, pid uuid, ntype text, ntitle text, nmessage text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if recipient is null then return; end if;
  if exists (
    select 1 from notifications
    where recipient_id = recipient
      and post_id is not distinct from pid
      and message = nmessage
      and created_at > now() - interval '30 seconds'
  ) then return; end if;
  insert into notifications (recipient_id, client_id, post_id, type, title, message)
  values (recipient, cid, pid, ntype, ntitle, nmessage);
end;
$$;

-- Original (header-based) review triggers from 0005
create or replace function public.handle_review_approval()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_share_client() is distinct from new.client_id then return new; end if;

  update posts
    set approval_status = new.status::text::approval_status
    where id = new.post_id and client_id = new.client_id;

  perform notify_review_event(
    client_owner(new.client_id),
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
returns trigger language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  cid := post_client(new.post_id);
  if cid is null or current_share_client() is distinct from cid then return new; end if;

  if new.comment_type = 'change_request' then
    update posts set approval_status = 'changes_requested' where id = new.post_id;
  else
    perform notify_review_event(
      client_owner(cid),
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

-- Original shared policies from 0001
create policy "clients shared read" on public.clients for select
  using (id = current_share_client());
create policy "highlights shared read" on public.highlights for select
  using (client_id = current_share_client());
create policy "posts shared read" on public.posts for select
  using (client_id = current_share_client());
create policy "post_media shared read" on public.post_media for select
  using (post_client(post_id) = current_share_client());
create policy "comments shared read" on public.comments for select
  using (post_client(post_id) = current_share_client());
create policy "comments shared insert" on public.comments for insert
  with check (post_client(post_id) = current_share_client());
create policy "approvals shared read" on public.approvals for select
  using (client_id = current_share_client());
create policy "approvals shared insert" on public.approvals for insert
  with check (client_id = current_share_client());

-- Storage limits back to unlimited
update storage.buckets
  set file_size_limit = null, allowed_mime_types = null
  where id in ('avatars', 'highlights', 'post-media');

commit;
