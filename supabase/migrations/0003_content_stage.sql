-- Gridline Studio — content/post lifecycle stage
-- Splits the workflow into designer "content" packages and scheduler-created
-- "post" records while reusing the posts/post_media tables. Additive and
-- non-destructive: every existing row is a completed post. RLS is unchanged.

create type content_stage as enum ('content', 'post');

alter table posts
  add column if not exists stage content_stage not null default 'post';

create index if not exists posts_stage_idx on posts (client_id, stage);

comment on column posts.stage is
  'content = designer package (name + media only); post = completed Instagram post.';
