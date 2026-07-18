-- Gridline Studio — post package names
-- Adds a display name to posts for the calendar "post package" workflow.
-- Additive and non-destructive: existing rows default to '' and the UI falls
-- back to the caption for unnamed legacy posts. RLS is unchanged (column-level
-- access follows the existing posts policies).

alter table posts
  add column if not exists name text not null default '';

comment on column posts.name is
  'Working title of the post package (e.g. "Post 1"); optional for legacy rows.';
