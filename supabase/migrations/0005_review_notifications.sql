-- Client review notifications.
--
-- Adds a `notifications` table for the workspace owner plus SECURITY DEFINER
-- triggers that run when a reviewer submits an approval or comment through a
-- valid share token. The triggers (not the anonymous client) update the post's
-- approval status and create the owner notification, so a public reviewer can
-- never pick a notification recipient or touch arbitrary post fields.
-- Additive only — no changes to previously applied migrations or existing rows.

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------

create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles (id) on delete cascade,
  client_id uuid not null references clients (id) on delete cascade,
  post_id uuid references posts (id) on delete cascade,
  type text not null check (
    type in ('review_changes_requested', 'review_approved', 'review_feedback_received')
  ),
  title text not null check (char_length(title) between 1 and 200),
  message text not null default '' check (char_length(message) <= 2000),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_recipient_idx on notifications (recipient_id, is_read, created_at desc);
create index notifications_post_idx on notifications (post_id);

alter table notifications enable row level security;

-- Recipients read and mark-read their own notifications; nobody inserts or
-- deletes directly — rows are created only by the SECURITY DEFINER helpers.
create policy "notifications recipient read" on notifications for select
  using (recipient_id = auth.uid());
create policy "notifications recipient update" on notifications for update
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function client_owner(cid uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select owner_id from clients where id = cid;
$$;

-- Retry-safe notification insert: an identical event created within the last
-- 30 seconds (same recipient/post/message) is treated as a duplicate. The
-- check is deliberately type-agnostic — an approval note is also stored as a
-- comment, and the mirrored message must not notify twice.
create or replace function notify_review_event(
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

-- ---------------------------------------------------------------------------
-- Reviewer approval → post status + owner notification
-- ---------------------------------------------------------------------------

create or replace function handle_review_approval()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Only reviewer submissions arriving through a valid share token for this
  -- client drive status changes and notifications; owner inserts pass through.
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

create trigger approvals_review_event after insert on approvals
  for each row execute function handle_review_approval();

-- ---------------------------------------------------------------------------
-- Reviewer comment → status (change requests) / notification (feedback)
-- ---------------------------------------------------------------------------

create or replace function handle_review_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  cid := post_client(new.post_id);
  if cid is null or current_share_client() is distinct from cid then return new; end if;

  if new.comment_type = 'change_request' then
    -- Change requests are submitted together with an approval row, which
    -- already notifies the owner — only mirror the status here.
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

create trigger comments_review_event after insert on comments
  for each row execute function handle_review_comment();

-- ---------------------------------------------------------------------------
-- Realtime: stream notification inserts to the signed-in recipient
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
     )
  then
    alter publication supabase_realtime add table notifications;
  end if;
end $$;
