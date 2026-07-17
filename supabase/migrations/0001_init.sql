-- Gridline Studio — initial schema
-- Run with the Supabase CLI (`supabase db push`) or paste into the SQL editor.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type post_type as enum ('image', 'carousel', 'reel');
create type post_status as enum ('draft', 'scheduled', 'published');
create type approval_status as enum ('not_sent', 'awaiting_approval', 'approved', 'changes_requested');
create type profile_theme as enum ('light', 'dark');
create type account_type as enum ('personal', 'creator', 'business');
create type media_type as enum ('image', 'video');
create type comment_type as enum ('general', 'change_request');
create type reviewer_decision as enum ('approved', 'changes_requested');

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (application user record, mirrors auth.users)
-- ---------------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------

create table clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  slug text not null,
  instagram_username text not null check (char_length(instagram_username) between 1 and 60),
  profile_name text not null default '',
  avatar_url text,
  category text,
  bio text not null default '',
  website text,
  threads_username text,
  note text,
  is_private boolean not null default false,
  is_verified boolean not null default false,
  account_type account_type not null default 'business',
  posts_count integer not null default 0 check (posts_count >= 0),
  followers_count integer not null default 0 check (followers_count >= 0),
  following_count integer not null default 0 check (following_count >= 0),
  theme profile_theme not null default 'light',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug)
);

create index clients_owner_idx on clients (owner_id, updated_at desc);

create trigger clients_updated_at before update on clients
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- highlights
-- ---------------------------------------------------------------------------

create table highlights (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 30),
  cover_url text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index highlights_client_idx on highlights (client_id, position);

create trigger highlights_updated_at before update on highlights
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- posts
-- ---------------------------------------------------------------------------

create table posts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  type post_type not null default 'image',
  caption text not null default '',
  location text,
  alt_text text,
  hashtags text[] not null default '{}',
  status post_status not null default 'draft',
  approval_status approval_status not null default 'not_sent',
  scheduled_at timestamptz,
  published_at timestamptz,
  is_pinned boolean not null default false,
  grid_position integer not null default 0,
  likes_count integer not null default 0 check (likes_count >= 0),
  comments_count integer not null default 0 check (comments_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index posts_client_idx on posts (client_id, grid_position);
create index posts_scheduled_idx on posts (scheduled_at) where scheduled_at is not null;
create index posts_approval_idx on posts (approval_status);

create trigger posts_updated_at before update on posts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- post_media
-- ---------------------------------------------------------------------------

create table post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts (id) on delete cascade,
  media_type media_type not null default 'image',
  url text not null,
  thumbnail_url text,
  width integer,
  height integer,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index post_media_post_idx on post_media (post_id, position);

-- ---------------------------------------------------------------------------
-- comments (writable by anonymous reviewers through share links)
-- ---------------------------------------------------------------------------

create table comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts (id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 80),
  author_email text check (author_email is null or author_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  body text not null check (char_length(body) between 1 and 2000),
  comment_type comment_type not null default 'general',
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index comments_post_idx on comments (post_id, created_at desc);

-- ---------------------------------------------------------------------------
-- approvals
-- ---------------------------------------------------------------------------

create table approvals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  post_id uuid not null references posts (id) on delete cascade,
  reviewer_name text not null check (char_length(reviewer_name) between 1 and 80),
  reviewer_email text check (reviewer_email is null or reviewer_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  status reviewer_decision not null,
  message text check (message is null or char_length(message) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index approvals_client_idx on approvals (client_id, created_at desc);
create index approvals_post_idx on approvals (post_id);

create trigger approvals_updated_at before update on approvals
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- share_links
-- ---------------------------------------------------------------------------

create table share_links (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  token text not null unique check (char_length(token) >= 16),
  is_active boolean not null default true,
  expires_at timestamptz,
  allow_comments boolean not null default true,
  allow_approval boolean not null default true,
  created_at timestamptz not null default now()
);

create index share_links_client_idx on share_links (client_id);
create index share_links_token_idx on share_links (token) where is_active;

-- ---------------------------------------------------------------------------
-- activity
-- ---------------------------------------------------------------------------

create table activity (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  type text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create index activity_client_idx on activity (client_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Share-token helper used by public policies. SECURITY DEFINER so anonymous
-- visitors can validate a token without read access to share_links itself.
-- ---------------------------------------------------------------------------

create or replace function share_token_client(share_token text)
returns uuid language sql security definer stable set search_path = public as $$
  select client_id from share_links
  where token = share_token
    and is_active
    and (expires_at is null or expires_at > now());
$$;

-- The token arrives via the `request.share_token` setting (set per request by
-- the app through the `x-share-token` header → PostgREST GUC passthrough), or
-- via explicit RPCs below.

create or replace function current_share_client()
returns uuid language sql stable as $$
  select share_token_client(nullif(current_setting('request.headers', true)::json ->> 'x-share-token', ''));
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table profiles enable row level security;
alter table clients enable row level security;
alter table highlights enable row level security;
alter table posts enable row level security;
alter table post_media enable row level security;
alter table comments enable row level security;
alter table approvals enable row level security;
alter table share_links enable row level security;
alter table activity enable row level security;

-- profiles: user manages own row
create policy "profiles own read" on profiles for select using (auth.uid() = id);
create policy "profiles own update" on profiles for update using (auth.uid() = id);

-- clients: owner full access; public read through a valid share token
create policy "clients owner all" on clients for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "clients shared read" on clients for select
  using (id = current_share_client());

-- helper predicate: does the current user own the client of this row?
create or replace function owns_client(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from clients where id = cid and owner_id = auth.uid());
$$;

-- highlights
create policy "highlights owner all" on highlights for all
  using (owns_client(client_id)) with check (owns_client(client_id));
create policy "highlights shared read" on highlights for select
  using (client_id = current_share_client());

-- posts
create policy "posts owner all" on posts for all
  using (owns_client(client_id)) with check (owns_client(client_id));
create policy "posts shared read" on posts for select
  using (client_id = current_share_client());

-- post_media
create or replace function post_client(pid uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select client_id from posts where id = pid;
$$;

create policy "post_media owner all" on post_media for all
  using (owns_client(post_client(post_id))) with check (owns_client(post_client(post_id)));
create policy "post_media shared read" on post_media for select
  using (post_client(post_id) = current_share_client());

-- comments: owners manage; reviewers insert/read via share token
create policy "comments owner all" on comments for all
  using (owns_client(post_client(post_id))) with check (owns_client(post_client(post_id)));
create policy "comments shared read" on comments for select
  using (post_client(post_id) = current_share_client());
create policy "comments shared insert" on comments for insert
  with check (post_client(post_id) = current_share_client());

-- approvals: owners read; reviewers insert via share token
create policy "approvals owner all" on approvals for all
  using (owns_client(client_id)) with check (owns_client(client_id));
create policy "approvals shared read" on approvals for select
  using (client_id = current_share_client());
create policy "approvals shared insert" on approvals for insert
  with check (client_id = current_share_client());

-- share_links: owner only (public resolution goes through share_token_client)
create policy "share_links owner all" on share_links for all
  using (owns_client(client_id)) with check (owns_client(client_id));

-- activity: owner only
create policy "activity owner all" on activity for all
  using (owns_client(client_id)) with check (owns_client(client_id));

-- ---------------------------------------------------------------------------
-- Storage buckets + policies
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', true),
  ('highlights', 'highlights', true),
  ('post-media', 'post-media', true)
on conflict (id) do nothing;

-- Object keys are namespaced as `<user_id>/<file>`; owners manage their
-- folder, everyone may read (buckets are public for shared previews).
create policy "media owner write" on storage.objects for insert
  with check (
    bucket_id in ('avatars', 'highlights', 'post-media')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "media owner update" on storage.objects for update
  using (
    bucket_id in ('avatars', 'highlights', 'post-media')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "media owner delete" on storage.objects for delete
  using (
    bucket_id in ('avatars', 'highlights', 'post-media')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "media public read" on storage.objects for select
  using (bucket_id in ('avatars', 'highlights', 'post-media'));
